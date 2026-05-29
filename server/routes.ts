import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { fetchFromXApi, fetchFromTrends24, fetchFromGoogleTrends, fetchFromReddit, getMockTrends, type RawTrend } from "./data-sources";
import {
  saveSnapshot,
  calculateVelocity,
  getVolumeHistory,
  cleanOldSnapshots,
  pool,
} from "./snapshot-service";
import { processAdAutomation, getActiveCampaigns, getCampaignLog, getCampaignStats, getBrandPartners, analyzeBidding, getBiddingHistory, startAdScheduler, getSchedulerStatus, triggerManualScan, getApiCallLog, getAlerts, getUnreadAlerts, markAlertRead, markAllAlertsRead, getPricingGraphData, getAdDataForTrend, preloadBrandVideos } from "./ad-engine";
import { isFirestoreConnected, linkVideoToBrand, getBrandVideoContent } from "./firebase-admin";

let liveTrends: RawTrend[] = getMockTrends();
let liveYoutubeTrends: RawTrend[] = [];
let liveRedditTrends: RawTrend[] = [];
let lastFetchSource: "x_api" | "trends24" | "mock" = "mock";

async function refreshTrends(): Promise<void> {
  const xTrends = await fetchFromXApi();
  if (xTrends && xTrends.length > 0) {
    liveTrends = xTrends;
    lastFetchSource = "x_api";
    console.log(`[Trends] Fetched ${xTrends.length} trends from X API`);
  } else {
    const t24Trends = await fetchFromTrends24();
    if (t24Trends && t24Trends.length > 0) {
      liveTrends = t24Trends;
      lastFetchSource = "trends24";
      console.log(`[Trends] Fetched ${t24Trends.length} trends from Trends24`);
    } else {
      liveTrends = getMockTrends();
      lastFetchSource = "mock";
    }
  }

  // Fetch YouTube/Google Trends and Reddit in parallel
  const [ytTrends, rdTrends] = await Promise.all([
    fetchFromGoogleTrends(),
    fetchFromReddit(),
  ]);
  if (ytTrends && ytTrends.length > 0) liveYoutubeTrends = ytTrends;
  if (rdTrends && rdTrends.length > 0) liveRedditTrends = rdTrends;

  await saveSnapshot(liveTrends);

  const ids = liveTrends.map((t) => t.id);
  const velocities = await calculateVelocity(ids);
  for (const trend of liveTrends) {
    const v = velocities.get(trend.id);
    if (v) {
      trend.volumeChange = v.deltaPercent;
      trend.velocity = v.calculatedVelocity;
    }
  }

  for (const trend of liveTrends) {
    const history = await getVolumeHistory(trend.id);
    if (history.length >= 3) {
      trend.volumeHistory = history;
    }
  }

}

const SNAPSHOT_INTERVAL = 5 * 60 * 1000;
const CLEANUP_INTERVAL = 60 * 60 * 1000;

const MOCK_AUTHORS = [
  "TechGuru", "SocialWatcher", "TrendHunter", "DataNerd",
  "CulturePulse", "ViralTracker", "NewsBreaker", "InsightBot",
  "TrendScout", "PulseAI",
];

export async function registerRoutes(app: Express): Promise<Server> {
  await refreshTrends();

  setInterval(refreshTrends, SNAPSHOT_INTERVAL);

  setInterval(cleanOldSnapshots, CLEANUP_INTERVAL);

  startAdScheduler(() => [...liveTrends, ...liveYoutubeTrends, ...liveRedditTrends]);

  preloadBrandVideos();

  function enrichTrendsWithAds(trends: RawTrend[]) {
    return trends.map((trend) => {
      const adData = getAdDataForTrend(trend.keyword, trend.category);
      return {
        ...trend,
        sponsor: adData.sponsor,
        ad_video_url: adData.ad_video_url,
        ad_headline: adData.ad_headline,
        ad_cpm: adData.ad_cpm,
      };
    });
  }

  app.get("/api/trends", (req, res) => {
    const platform = req.query.platform as string | undefined;
    if (platform === "youtube") {
      return res.json({
        trends: enrichTrendsWithAds(liveYoutubeTrends),
        updatedAt: new Date().toISOString(),
        source: "google_trends",
      });
    }
    if (platform === "reddit") {
      return res.json({
        trends: enrichTrendsWithAds(liveRedditTrends),
        updatedAt: new Date().toISOString(),
        source: "reddit",
      });
    }
    res.json({
      trends: enrichTrendsWithAds(liveTrends),
      updatedAt: new Date().toISOString(),
      source: lastFetchSource,
    });
  });

  app.get("/api/trends/:id", (req, res) => {
    const allTrends = [...liveTrends, ...liveYoutubeTrends, ...liveRedditTrends];
    const trend = allTrends.find((t) => t.id === req.params.id);
    if (!trend) {
      return res.status(404).json({ message: "Trend not found" });
    }
    res.json(trend);
  });

  app.get("/api/trends/:id/pulse", async (req, res) => {
    const allTrends = [...liveTrends, ...liveYoutubeTrends, ...liveRedditTrends];
    const trend = allTrends.find((t) => t.id === req.params.id);
    if (!trend) {
      return res.status(404).json({ message: "Trend not found" });
    }

    try {
      const dbPosts = await pool.query(
        `SELECT * FROM pulse_posts WHERE trend_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [req.params.id]
      );

      let posts = dbPosts.rows.map((row) => ({
        id: `db-${row.id}`,
        trendId: row.trend_id,
        author: row.author,
        avatar: row.author.charAt(0),
        platform: row.platform,
        content: row.content,
        timestamp: formatTimeAgo(row.created_at),
        likes: row.likes,
        reposts: row.reposts,
      }));

      if (posts.length < 5) {
        const generated = generatePulsePosts(trend);
        posts = [...posts, ...generated];
      }

      res.json({ posts, trendKeyword: trend.keyword });
    } catch (err) {
      console.error("[Pulse] Query failed:", err);
      const posts = generatePulsePosts(trend);
      res.json({ posts, trendKeyword: trend.keyword });
    }
  });

  app.get("/api/trends/:id/related-keywords", async (req, res) => {
    const allTrends = [...liveTrends, ...liveYoutubeTrends, ...liveRedditTrends];
    const trend = allTrends.find((t) => t.id === req.params.id);
    if (!trend) {
      return res.status(404).json({ message: "Trend not found" });
    }

    try {
      const keyword = trend.keyword.replace(/#/g, "");
      const queries = [
        keyword,
        `${keyword} trending`,
        `${keyword} news`,
      ];

      const allSuggestions = new Set<string>();

      await Promise.all(
        queries.map(async (q) => {
          try {
            const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q)}`;
            const resp = await fetch(url, {
              headers: { "User-Agent": "Mozilla/5.0" },
              signal: AbortSignal.timeout(4000),
            });
            if (resp.ok) {
              const data = await resp.json();
              if (Array.isArray(data) && Array.isArray(data[1])) {
                data[1].forEach((s: string) => {
                  const cleaned = s.trim();
                  if (cleaned.toLowerCase() !== keyword.toLowerCase() && cleaned.length > 1) {
                    allSuggestions.add(cleaned);
                  }
                });
              }
            }
          } catch {
          }
        })
      );

      const results = Array.from(allSuggestions).slice(0, 12);

      if (results.length === 0 && trend.relatedKeywords.length > 0) {
        return res.json({ keywords: trend.relatedKeywords, source: "cached" });
      }

      res.json({ keywords: results, source: "google" });
    } catch (err) {
      console.error("[RelatedKeywords] Error:", err);
      res.json({ keywords: trend.relatedKeywords, source: "fallback" });
    }
  });

  const VALID_PLATFORMS = ["twitter", "instagram", "tiktok", "reddit", "youtube"];

  app.post("/api/pulse", async (req, res) => {
    const { trendId, author, platform, content } = req.body;
    if (!trendId || !author || !content) {
      return res.status(400).json({ message: "trendId, author, and content are required" });
    }
    const safePlatform = VALID_PLATFORMS.includes(platform) ? platform : "twitter";

    try {
      const result = await pool.query(
        `INSERT INTO pulse_posts (trend_id, author, platform, content)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [trendId, author, safePlatform, content]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("[Pulse] Insert failed:", err);
      res.status(500).json({ message: "Failed to create post" });
    }
  });

  app.get("/api/pulse/:postId/comments", async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT * FROM pulse_comments WHERE post_id = $1 ORDER BY created_at ASC`,
        [req.params.postId]
      );
      const rows = result.rows.map((r) => ({
        id: r.id,
        postId: r.post_id,
        trendId: r.trend_id,
        author: r.author,
        avatar: r.author.charAt(0).toUpperCase(),
        content: r.content,
        replyTo: r.reply_to,
        likes: r.likes,
        timestamp: r.created_at,
        mediaUri: r.media_uri ?? null,
        mediaType: r.media_type ?? null,
        link: r.link ?? null,
      }));
      res.json({ comments: rows });
    } catch (err) {
      console.error("[Comments] Query failed:", err);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  app.post("/api/pulse/:postId/comments", async (req, res) => {
    const { trendId, author, content, replyTo, mediaUri, mediaType, link } = req.body;
    if (!trendId || !author || !content) {
      return res.status(400).json({ message: "trendId, author, and content are required" });
    }
    try {
      const result = await pool.query(
        `INSERT INTO pulse_comments (post_id, trend_id, author, content, reply_to, media_uri, media_type, link)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [req.params.postId, trendId, author, content, replyTo ?? null, mediaUri ?? null, mediaType ?? null, link ?? null]
      );
      const r = result.rows[0];
      res.status(201).json({
        id: r.id,
        postId: r.post_id,
        trendId: r.trend_id,
        author: r.author,
        avatar: r.author.charAt(0).toUpperCase(),
        content: r.content,
        replyTo: r.reply_to,
        likes: r.likes,
        timestamp: r.created_at,
        mediaUri: r.media_uri ?? null,
        mediaType: r.media_type ?? null,
        link: r.link ?? null,
      });
    } catch (err) {
      console.error("[Comments] Insert failed:", err);
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  app.post("/api/pulse/comments/:commentId/like", async (req, res) => {
    try {
      const result = await pool.query(
        `UPDATE pulse_comments SET likes = likes + 1 WHERE id = $1 RETURNING likes`,
        [req.params.commentId]
      );
      if (result.rows.length === 0) return res.status(404).json({ message: "Comment not found" });
      res.json({ likes: result.rows[0].likes });
    } catch (err) {
      console.error("[Comments] Like failed:", err);
      res.status(500).json({ message: "Failed to like comment" });
    }
  });

  app.get("/api/consent/:deviceId", async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM analytics_consent WHERE device_id = $1",
        [req.params.deviceId]
      );
      if (result.rows.length === 0) {
        return res.json({ consented: null, needsPrompt: true });
      }
      res.json({ consented: result.rows[0].consented, needsPrompt: false });
    } catch (err) {
      console.error("[Consent] Query failed:", err);
      res.status(500).json({ message: "Failed to check consent" });
    }
  });

  app.post("/api/consent", async (req, res) => {
    const { deviceId, consented } = req.body;
    if (!deviceId || typeof consented !== "boolean") {
      return res.status(400).json({ message: "deviceId and consented (boolean) are required" });
    }

    try {
      await pool.query(
        `INSERT INTO analytics_consent (device_id, consented, consented_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (device_id)
         DO UPDATE SET consented = $2, consented_at = $3`,
        [deviceId, consented, consented ? new Date() : null]
      );
      res.json({ success: true });
    } catch (err) {
      console.error("[Consent] Save failed:", err);
      res.status(500).json({ message: "Failed to save consent" });
    }
  });

  app.get("/api/ads/pricing/:trendId", (req, res) => {
    const trend = liveTrends.find((t) => t.id === req.params.trendId);
    if (!trend) {
      return res.status(404).json({ message: "Trend not found" });
    }

    const cpm = calculateAdCPM(trend.volumeChange, trend.velocity, trend.volume);

    res.json({
      trendId: trend.id,
      keyword: trend.keyword,
      currentCPM: `${cpm.price}`,
      currency: "USD",
      tier: cpm.tier,
      velocity: trend.velocity,
      volumeChange: `${trend.volumeChange}%`,
      volume: trend.volume,
      breakdown: cpm.breakdown,
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/ads/pricing", (_req, res) => {
    const allPricing = liveTrends.map((trend) => {
      const cpm = calculateAdCPM(trend.volumeChange, trend.velocity, trend.volume);
      return {
        trendId: trend.id,
        keyword: trend.keyword,
        currentCPM: `${cpm.price}`,
        tier: cpm.tier,
        velocity: trend.velocity,
        volume: trend.volume,
      };
    });

    allPricing.sort((a, b) => parseFloat(b.currentCPM) - parseFloat(a.currentCPM));

    res.json({
      pricing: allPricing,
      baseCPM: "5.00",
      currency: "USD",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/ads/campaigns", (_req, res) => {
    res.json({
      active: getActiveCampaigns(),
      stats: getCampaignStats(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/ads/campaigns/log", (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    res.json({
      log: getCampaignLog(limit),
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/ads/campaigns/stats", (_req, res) => {
    res.json(getCampaignStats());
  });

  app.get("/api/ads/bidding/:trendId", (req, res) => {
    const allTrends = [...liveTrends, ...liveYoutubeTrends, ...liveRedditTrends];
    const trend = allTrends.find((t) => t.id === req.params.trendId);
    if (!trend) {
      return res.status(404).json({ message: "Trend not found" });
    }
    const analysis = analyzeBidding(trend);
    res.json(analysis);
  });

  app.get("/api/ads/bidding", (_req, res) => {
    const allTrends = [...liveTrends, ...liveYoutubeTrends, ...liveRedditTrends];
    const analyses = allTrends.map((t) => analyzeBidding(t));
    analyses.sort((a, b) => b.calculatedCPM - a.calculatedCPM);
    res.json({
      analyses,
      marketBenchmarks: {
        finance: 6.50, sports: 4.80, tech: 5.50, entertainment: 5.00,
        music: 4.50, news: 4.00, health: 5.80, science: 5.30,
        fashion: 5.60, politics: 4.20,
      },
      tolerance: "120%",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/ads/bidding/history", (req, res) => {
    const limit = parseInt(req.query.limit as string) || 20;
    res.json({ history: getBiddingHistory(limit), timestamp: new Date().toISOString() });
  });

  app.get("/api/ads/bidding/history/graph/:trendId", (req, res) => {
    const allTrends = [...liveTrends, ...liveYoutubeTrends, ...liveRedditTrends];
    const graphData = getPricingGraphData(req.params.trendId, allTrends);
    console.log(`📡 Demande de graphique pour le trend : ${req.params.trendId}`);
    res.json(graphData);
  });

  app.get("/api/ads/alerts", (req, res) => {
    const limit = parseInt(req.query.limit as string) || 30;
    res.json({ alerts: getAlerts(limit), timestamp: new Date().toISOString() });
  });

  app.get("/api/ads/alerts/unread", (_req, res) => {
    res.json(getUnreadAlerts());
  });

  app.post("/api/ads/alerts/:alertId/read", (req, res) => {
    const success = markAlertRead(req.params.alertId);
    res.json({ success });
  });

  app.post("/api/ads/alerts/read-all", (_req, res) => {
    const count = markAllAlertsRead();
    res.json({ markedRead: count });
  });

  app.get("/api/ads/api-calls", (req, res) => {
    const limit = parseInt(req.query.limit as string) || 30;
    res.json({ calls: getApiCallLog(limit), timestamp: new Date().toISOString() });
  });

  app.get("/api/ads/scheduler", (_req, res) => {
    res.json(getSchedulerStatus());
  });

  app.post("/api/ads/scheduler/scan", async (_req, res) => {
    const result = await triggerManualScan(() => [...liveTrends, ...liveYoutubeTrends, ...liveRedditTrends]);
    res.json(result);
  });

  app.get("/api/ads/partners", (_req, res) => {
    res.json({
      partners: getBrandPartners().map((b) => ({
        id: b.id,
        name: b.name,
        categories: b.categories,
        automateBidding: b.automateBidding,
        active: b.active,
        baseBudget: b.baseBudget,
        maxBudget: b.maxBudget,
      })),
    });
  });

  app.get("/api/status", (_req, res) => {
    res.json({
      source: lastFetchSource,
      xApiConfigured: !!process.env.X_API_BEARER_TOKEN,
      firestoreConnected: isFirestoreConnected(),
      trendCount: liveTrends.length,
      snapshotInterval: `${SNAPSHOT_INTERVAL / 1000}s`,
      uptime: process.uptime(),
    });
  });

  app.post("/api/brands/:brandId/video", async (req, res) => {
    const { brandId } = req.params;
    const { videoUrl } = req.body;
    if (!videoUrl) {
      return res.status(400).json({ error: "videoUrl is required" });
    }
    const success = await linkVideoToBrand(brandId, videoUrl);
    if (success) {
      res.json({ success: true, message: `Vidéo liée à ${brandId}` });
    } else {
      res.json({ success: false, message: "Firestore non connecté — vidéo non sauvegardée" });
    }
  });

  app.get("/api/brands/:brandId/video", async (req, res) => {
    const { brandId } = req.params;
    const videoUrl = await getBrandVideoContent(brandId);
    res.json({ brandId, videoUrl });
  });

  app.post("/api/ads/ab-test/optimize", async (_req, res) => {
    const { optimizeABTests } = await import("./firebase-admin");
    const optimized = await optimizeABTests();
    res.json({ success: true, optimized, message: `${optimized} test(s) A/B optimisé(s)` });
  });

  const httpServer = createServer(app);
  return httpServer;
}

function generatePulsePosts(trend: RawTrend) {
  const templates = [
    `${trend.keyword} is absolutely taking over my feed right now.`,
    `Can't believe how fast ${trend.keyword} is growing. ${trend.velocity === "exploding" ? "This is massive!" : "Interesting to watch."}`,
    `Just posted about ${trend.keyword}. The ${trend.category.toLowerCase()} community is buzzing.`,
    `${trend.keyword} with ${(trend.volume / 1_000_000).toFixed(1)}M mentions. We're witnessing something big.`,
    `Hot take on ${trend.keyword}: this trend is ${trend.sentiment === "positive" ? "well-deserved" : "overblown"}.`,
    `Everyone's talking about ${trend.keyword}. Here's my analysis...`,
    `The data on ${trend.keyword} is wild. ${trend.volumeChange > 0 ? "+" : ""}${trend.volumeChange}% in 24h.`,
    `${trend.keyword} just hit trending worldwide. ${trend.relatedKeywords[0] || ""} is closely related.`,
  ];

  const timeOffsets = ["2m ago", "5m ago", "8m ago", "12m ago", "18m ago", "25m ago", "35m ago", "1h ago"];

  return templates.map((content, i) => ({
    id: `gen-${trend.id}-${i}`,
    trendId: trend.id,
    author: MOCK_AUTHORS[i % MOCK_AUTHORS.length],
    avatar: MOCK_AUTHORS[i % MOCK_AUTHORS.length].charAt(0),
    platform: trend.platform[i % trend.platform.length],
    content,
    timestamp: timeOffsets[i],
    likes: Math.floor(Math.random() * 5000) + 100,
    reposts: Math.floor(Math.random() * 2000) + 50,
  }));
}

function calculateAdCPM(
  volumeChange: number,
  velocity: string,
  volume: number
): { price: string; tier: string; breakdown: Record<string, string> } {
  const baseCPM = 5.0;

  const velocityMultiplier = Math.max(0, volumeChange) / 100;
  const velocityPrice = baseCPM * velocityMultiplier;

  let tierMultiplier = 1.0;
  let tier = "Standard";
  if (velocity === "exploding") {
    tierMultiplier = 3.0;
    tier = "Premium";
  } else if (velocity === "rising") {
    tierMultiplier = 1.8;
    tier = "Enhanced";
  } else if (velocity === "stable") {
    tierMultiplier = 1.0;
    tier = "Standard";
  } else {
    tierMultiplier = 0.6;
    tier = "Discount";
  }

  let volumeBonus = 0;
  if (volume > 5_000_000) volumeBonus = 4.0;
  else if (volume > 2_000_000) volumeBonus = 2.5;
  else if (volume > 1_000_000) volumeBonus = 1.5;
  else if (volume > 500_000) volumeBonus = 0.5;

  const total = (baseCPM + velocityPrice + volumeBonus) * tierMultiplier;
  const finalPrice = Math.max(2.0, Math.min(total, 150.0));

  return {
    price: finalPrice.toFixed(2),
    tier,
    breakdown: {
      baseCPM: `$${baseCPM.toFixed(2)}`,
      velocityBonus: `+$${velocityPrice.toFixed(2)} (${volumeChange > 0 ? "+" : ""}${volumeChange}%)`,
      volumeBonus: `+$${volumeBonus.toFixed(2)} (${(volume / 1_000_000).toFixed(1)}M mentions)`,
      tierMultiplier: `×${tierMultiplier} (${tier})`,
      finalCPM: `$${finalPrice.toFixed(2)}`,
    },
  };
}

function formatTimeAgo(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
