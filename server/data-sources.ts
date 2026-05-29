export type Platform = "twitter" | "instagram" | "tiktok" | "reddit" | "youtube";
export type Velocity = "exploding" | "rising" | "stable" | "falling";
export type Sentiment = "positive" | "neutral" | "negative";

export interface RawTrend {
  id: string;
  keyword: string;
  category: string;
  platform: Platform[];
  volume: number;
  volumeChange: number;
  velocity: Velocity;
  rank: number;
  relatedKeywords: string[];
  volumeHistory: number[];
  peakTime: string;
  sentiment: Sentiment;
  region: string;
  source: "x_api" | "trends24" | "mock";
}

const MOCK_TRENDS: RawTrend[] = [
  {
    id: "1", keyword: "#AIRevolution", category: "Technology",
    platform: ["twitter", "reddit"], volume: 2840000, volumeChange: 312,
    velocity: "exploding", rank: 1,
    relatedKeywords: ["#MachineLearning", "#ChatGPT", "#OpenAI", "#DeepMind"],
    volumeHistory: [120, 180, 240, 310, 580, 920, 1450, 2100, 2840],
    peakTime: "2h ago", sentiment: "positive", region: "Global", source: "mock",
  },
  {
    id: "2", keyword: "#SuperBowlLIX", category: "Sports",
    platform: ["twitter", "instagram", "tiktok"], volume: 5120000, volumeChange: 187,
    velocity: "exploding", rank: 2,
    relatedKeywords: ["#NFL", "#Chiefs", "#Eagles", "#Halftime"],
    volumeHistory: [800, 1200, 1600, 2000, 2800, 3600, 4200, 4800, 5120],
    peakTime: "45m ago", sentiment: "positive", region: "US", source: "mock",
  },
  {
    id: "3", keyword: "#ClimateAction2026", category: "Environment",
    platform: ["twitter", "instagram", "reddit"], volume: 1230000, volumeChange: 94,
    velocity: "rising", rank: 3,
    relatedKeywords: ["#GreenEnergy", "#NetZero", "#SolarPower", "#COP31"],
    volumeHistory: [200, 280, 350, 420, 580, 720, 880, 1050, 1230],
    peakTime: "1h ago", sentiment: "neutral", region: "Global", source: "mock",
  },
  {
    id: "4", keyword: "#CryptoWinter", category: "Finance",
    platform: ["twitter", "reddit", "youtube"], volume: 890000, volumeChange: -32,
    velocity: "falling", rank: 4,
    relatedKeywords: ["#Bitcoin", "#Ethereum", "#DeFi", "#NFT"],
    volumeHistory: [1400, 1300, 1200, 1100, 1050, 1000, 960, 920, 890],
    peakTime: "6h ago", sentiment: "negative", region: "Global", source: "mock",
  },
  {
    id: "5", keyword: "#StrangerThings5", category: "Entertainment",
    platform: ["twitter", "instagram", "tiktok"], volume: 3450000, volumeChange: 256,
    velocity: "exploding", rank: 5,
    relatedKeywords: ["#Netflix", "#ElvenThings", "#Hawkins", "#UpsideDown"],
    volumeHistory: [100, 200, 400, 800, 1200, 1800, 2400, 3000, 3450],
    peakTime: "30m ago", sentiment: "positive", region: "Global", source: "mock",
  },
  {
    id: "6", keyword: "#MarsColony", category: "Science",
    platform: ["twitter", "reddit", "youtube"], volume: 680000, volumeChange: 78,
    velocity: "rising", rank: 6,
    relatedKeywords: ["#SpaceX", "#Elon", "#Starship", "#NASA"],
    volumeHistory: [150, 200, 280, 350, 420, 510, 580, 640, 680],
    peakTime: "3h ago", sentiment: "positive", region: "Global", source: "mock",
  },
  {
    id: "7", keyword: "#WorkFromAnywhere", category: "Business",
    platform: ["twitter", "instagram", "reddit"], volume: 420000, volumeChange: 42,
    velocity: "stable", rank: 7,
    relatedKeywords: ["#RemoteWork", "#DigitalNomad", "#FutureOfWork", "#WFH"],
    volumeHistory: [380, 390, 400, 405, 410, 415, 416, 419, 420],
    peakTime: "4h ago", sentiment: "positive", region: "Global", source: "mock",
  },
  {
    id: "8", keyword: "#MentalHealthDay", category: "Health",
    platform: ["twitter", "instagram", "tiktok"], volume: 1840000, volumeChange: 143,
    velocity: "rising", rank: 8,
    relatedKeywords: ["#SelfCare", "#Wellness", "#Therapy", "#Mindfulness"],
    volumeHistory: [300, 450, 600, 780, 950, 1150, 1380, 1600, 1840],
    peakTime: "1.5h ago", sentiment: "positive", region: "Global", source: "mock",
  },
  {
    id: "9", keyword: "#TechLayoffs", category: "Technology",
    platform: ["twitter", "reddit"], volume: 560000, volumeChange: -18,
    velocity: "falling", rank: 9,
    relatedKeywords: ["#BigTech", "#JobMarket", "#Silicon Valley", "#Hiring"],
    volumeHistory: [720, 700, 680, 660, 630, 610, 590, 575, 560],
    peakTime: "8h ago", sentiment: "negative", region: "US", source: "mock",
  },
  {
    id: "10", keyword: "#K-Pop2026", category: "Music",
    platform: ["twitter", "instagram", "tiktok", "youtube"], volume: 2100000, volumeChange: 198,
    velocity: "exploding", rank: 10,
    relatedKeywords: ["#BTS", "#BLACKPINK", "#NewJeans", "#Kpop"],
    volumeHistory: [400, 550, 750, 1000, 1200, 1500, 1750, 1950, 2100],
    peakTime: "1h ago", sentiment: "positive", region: "Global", source: "mock",
  },
];

function addNoise(base: RawTrend[]): RawTrend[] {
  return base.map((t) => ({
    ...t,
    volume: Math.max(1000, t.volume + Math.floor((Math.random() - 0.45) * t.volume * 0.05)),
    volumeChange: t.volumeChange + Math.floor((Math.random() - 0.5) * 20),
  }));
}

export async function fetchFromXApi(): Promise<RawTrend[] | null> {
  const token = process.env.X_API_BEARER_TOKEN;
  if (!token) {
    console.log("[X API] No bearer token configured, using mock data");
    return null;
  }

  const decodedToken = decodeURIComponent(token);

  try {
    const resp = await fetch(
      "https://api.twitter.com/2/tweets/search/recent?query=-is:retweet has:hashtags&max_results=100&tweet.fields=public_metrics,created_at,entities",
      { headers: { Authorization: `Bearer ${decodedToken}` } }
    );

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      console.error(`X API v2 error: ${resp.status} ${resp.statusText} — ${body}`);

      if (resp.status === 401 || resp.status === 403) {
        const v1Resp = await fetch("https://api.twitter.com/1.1/trends/place.json?id=1", {
          headers: { Authorization: `Bearer ${decodedToken}` },
        });
        if (v1Resp.ok) {
          const v1Data = await v1Resp.json();
          const v1Trends = v1Data[0]?.trends;
          if (Array.isArray(v1Trends)) {
            console.log(`[X API] v1.1 fallback succeeded — ${v1Trends.length} trends`);
            return v1Trends.slice(0, 20).map((t: any, i: number) => mapV1Trend(t, i));
          }
        }
      }

      return null;
    }

    const data = await resp.json();
    const tweets = data.data;
    if (!Array.isArray(tweets) || tweets.length === 0) {
      console.log("[X API] No tweets returned");
      return null;
    }

    const tagCounts: Record<string, { count: number; totalLikes: number; totalRts: number }> = {};
    for (const tweet of tweets) {
      const hashtags = tweet.entities?.hashtags;
      if (!hashtags) continue;
      for (const ht of hashtags) {
        const tag = `#${ht.tag}`;
        if (!tagCounts[tag]) tagCounts[tag] = { count: 0, totalLikes: 0, totalRts: 0 };
        tagCounts[tag].count++;
        tagCounts[tag].totalLikes += tweet.public_metrics?.like_count || 0;
        tagCounts[tag].totalRts += tweet.public_metrics?.retweet_count || 0;
      }
    }

    const sorted = Object.entries(tagCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20);

    console.log(`[X API] v2 success — extracted ${sorted.length} trending hashtags from ${tweets.length} tweets`);

    return sorted.map(([keyword, stats], i) => {
      const engagement = stats.totalLikes + stats.totalRts;
      const volume = Math.max(engagement, stats.count * 5000 + Math.floor(Math.random() * 10000));
      const velocityPct = stats.count > 5 ? 50 + Math.random() * 100 : Math.random() * 40 - 10;
      return {
        id: `x-${i + 1}`,
        keyword,
        category: "Trending",
        platform: ["twitter"] as Platform[],
        volume,
        volumeChange: Math.floor(velocityPct),
        velocity: (velocityPct > 100 ? "exploding" : velocityPct > 20 ? "rising" : "stable") as Velocity,
        rank: i + 1,
        relatedKeywords: [],
        volumeHistory: Array.from({ length: 9 }, (_, j) =>
          Math.floor(volume * (0.3 + j * 0.09 + Math.random() * 0.05))
        ),
        peakTime: "recently",
        sentiment: (engagement > 1000 ? "positive" : "neutral") as Sentiment,
        region: "Global",
        source: "x_api" as const,
      };
    });
  } catch (err) {
    console.error("X API fetch failed:", err);
    return null;
  }
}

function mapV1Trend(t: any, i: number): RawTrend {
  return {
    id: `x-${i + 1}`,
    keyword: t.name,
    category: "Trending",
    platform: ["twitter"] as Platform[],
    volume: t.tweet_volume || Math.floor(Math.random() * 500000) + 10000,
    volumeChange: Math.floor(Math.random() * 200) - 50,
    velocity: (t.tweet_volume && t.tweet_volume > 500000 ? "exploding"
      : t.tweet_volume && t.tweet_volume > 100000 ? "rising"
      : "stable") as Velocity,
    rank: i + 1,
    relatedKeywords: [],
    volumeHistory: Array.from({ length: 9 }, (_, j) =>
      Math.floor((t.tweet_volume || 100000) * (0.3 + j * 0.09 + Math.random() * 0.05))
    ),
    peakTime: "recently",
    sentiment: "neutral" as Sentiment,
    region: "Global",
    source: "x_api" as const,
  };
}

const CATEGORY_MAP: Record<string, string> = {
  nba: "Sports", nfl: "Sports", mlb: "Sports", nhl: "Sports", ufc: "Sports",
  fifa: "Sports", premier: "Sports", champions: "Sports", olympics: "Sports",
  soccer: "Sports", basketball: "Sports", football: "Sports", tennis: "Sports",
  trump: "Politics", biden: "Politics", congress: "Politics", senate: "Politics",
  election: "Politics", vote: "Politics", democrat: "Politics", republican: "Politics",
  elon: "Tech", ai: "Tech", openai: "Tech", chatgpt: "Tech", google: "Tech",
  apple: "Tech", microsoft: "Tech", meta: "Tech", android: "Tech", iphone: "Tech",
  robot: "Tech", software: "Tech", startup: "Tech", coding: "Tech",
  crypto: "Finance", bitcoin: "Finance", ethereum: "Finance", stock: "Finance",
  market: "Finance", invest: "Finance", economy: "Finance",
  netflix: "Entertainment", disney: "Entertainment", marvel: "Entertainment",
  movie: "Entertainment", film: "Entertainment", series: "Entertainment",
  hbo: "Entertainment", show: "Entertainment", anime: "Entertainment",
  taylor: "Music", drake: "Music", beyonce: "Music", grammys: "Music",
  album: "Music", concert: "Music", spotify: "Music", rapper: "Music",
  song: "Music", singer: "Music", kpop: "Music",
  fashion: "Fashion", gucci: "Fashion", nike: "Fashion", adidas: "Fashion",
  luxury: "Fashion", vogue: "Fashion", outfit: "Fashion", style: "Fashion",
  runway: "Fashion", designer: "Fashion",
  health: "Health", mental: "Health", vaccine: "Health", covid: "Health",
  fitness: "Health", wellness: "Health", diet: "Health", medical: "Health",
  war: "News", breaking: "News", earthquake: "News", hurricane: "News",
  crisis: "News", bomb: "News", protest: "News", scandal: "News",
  climate: "News", flood: "News",
  nasa: "Science", space: "Science", mars: "Science", quantum: "Science",
  science: "Science", research: "Science",
};

function guessCategory(keyword: string): string {
  const lower = keyword.toLowerCase();
  for (const [key, cat] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return cat;
  }
  return "Trending";
}

const PLATFORMS: Platform[][] = [
  ["twitter"], ["twitter", "instagram"], ["twitter", "tiktok"],
  ["twitter", "reddit"], ["twitter", "instagram", "tiktok"],
];

export async function fetchFromTrends24(): Promise<RawTrend[] | null> {
  try {
    const resp = await fetch("https://trends24.in/united-states/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TrendPulse/1.0)",
        Accept: "text/html",
      },
    });

    if (!resp.ok) {
      console.error(`[Trends24] HTTP ${resp.status}`);
      return null;
    }

    const html = await resp.text();
    const trendMatches = html.match(/trend-name><a[^>]*>([^<]+)/g);
    if (!trendMatches || trendMatches.length === 0) {
      console.log("[Trends24] No trends found in HTML");
      return null;
    }

    const seen = new Set<string>();
    const uniqueTrends: string[] = [];
    for (const match of trendMatches) {
      const name = match.replace(/trend-name><a[^>]*>/, "").replace(/&#39;/g, "'").replace(/&amp;/g, "&").trim();
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        uniqueTrends.push(name.startsWith("#") ? name : name);
      }
      if (uniqueTrends.length >= 20) break;
    }

    console.log(`[Trends24] Scraped ${uniqueTrends.length} trending topics from trends24.in`);

    return uniqueTrends.map((keyword, i) => {
      const baseVolume = Math.floor(Math.random() * 2000000) + 100000;
      const rankFactor = 1 - i * 0.04;
      const volume = Math.floor(baseVolume * Math.max(0.2, rankFactor));
      const velocityPct = Math.floor(Math.random() * 300) - 30;
      return {
        id: `t24-${i + 1}`,
        keyword,
        category: guessCategory(keyword),
        platform: PLATFORMS[i % PLATFORMS.length],
        volume,
        volumeChange: velocityPct,
        velocity: (velocityPct > 100 ? "exploding" : velocityPct > 20 ? "rising" : velocityPct < -15 ? "falling" : "stable") as Velocity,
        rank: i + 1,
        relatedKeywords: [],
        volumeHistory: Array.from({ length: 9 }, (_, j) =>
          Math.floor(volume * (0.3 + j * 0.09 + Math.random() * 0.05))
        ),
        peakTime: `${Math.floor(Math.random() * 4) + 1}h ago`,
        sentiment: (velocityPct > 50 ? "positive" : velocityPct < -10 ? "negative" : "neutral") as Sentiment,
        region: "US",
        source: "trends24" as const,
      };
    });
  } catch (err) {
    console.error("[Trends24] Fetch failed:", err);
    return null;
  }
}

export async function fetchFromGoogleTrends(): Promise<RawTrend[] | null> {
  try {
    const resp = await fetch("https://trends.google.com/trending/rss?geo=US", {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TrendPulse/1.0)",
        Accept: "application/rss+xml, text/xml",
      },
    });

    if (!resp.ok) {
      console.error(`[Google Trends] HTTP ${resp.status}`);
      return null;
    }

    const xml = await resp.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    if (!items.length) {
      console.log("[Google Trends] No items found in RSS");
      return null;
    }

    const trends: RawTrend[] = [];
    for (let i = 0; i < Math.min(items.length, 20); i++) {
      const block = items[i][1];
      const titleMatch = block.match(/<title>([^<]+)<\/title>/);
      const trafficMatch = block.match(/<ht:approx_traffic>([^<]+)<\/ht:approx_traffic>/);
      const newsTitle = block.match(/<ht:news_item_title>([^<]+)<\/ht:news_item_title>/)?.[1] ?? "";

      if (!titleMatch) continue;

      const keyword = titleMatch[1]
        .trim()
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

      const trafficStr = (trafficMatch?.[1] ?? "10K+").replace(/,/g, "").replace(/\+/g, "");
      const trafficMultiplier = trafficStr.endsWith("M") ? 1_000_000 : trafficStr.endsWith("K") ? 1_000 : 1;
      const trafficBase = parseFloat(trafficStr.replace(/[KMB]/gi, "")) * trafficMultiplier;
      const volume = isNaN(trafficBase) ? 50_000 + Math.floor(Math.random() * 500_000) : trafficBase * (0.8 + Math.random() * 0.4);
      const velocityPct = Math.floor(Math.random() * 250) + 20;

      trends.push({
        id: `yt-${i + 1}`,
        keyword,
        category: guessCategory(keyword + " " + newsTitle),
        platform: ["youtube"] as Platform[],
        volume: Math.floor(volume),
        volumeChange: velocityPct,
        velocity: (velocityPct > 100 ? "exploding" : velocityPct > 20 ? "rising" : "stable") as Velocity,
        rank: i + 1,
        relatedKeywords: [],
        volumeHistory: Array.from({ length: 9 }, (_, j) =>
          Math.floor(volume * (0.2 + j * 0.1 + Math.random() * 0.05))
        ),
        peakTime: `${Math.floor(Math.random() * 3) + 1}h ago`,
        sentiment: "neutral" as Sentiment,
        region: "US",
        source: "trends24" as const,
      });
    }

    console.log(`[Google Trends] Fetched ${trends.length} YouTube/Google trending topics`);
    return trends;
  } catch (err) {
    console.error("[Google Trends] Fetch failed:", err);
    return null;
  }
}

export async function fetchFromReddit(): Promise<RawTrend[] | null> {
  try {
    const [hotResp, risingResp] = await Promise.all([
      fetch("https://www.reddit.com/r/all/hot.rss?limit=25", {
        headers: {
          "User-Agent": "TrendPulse:v1.0.0:script (research; contact /u/trendpulse_app)",
          Accept: "application/atom+xml, text/xml, */*",
        },
      }),
      fetch("https://www.reddit.com/r/all/rising.rss?limit=15", {
        headers: {
          "User-Agent": "TrendPulse:v1.0.0:script (research; contact /u/trendpulse_app)",
          Accept: "application/atom+xml, text/xml, */*",
        },
      }),
    ]);

    if (!hotResp.ok) {
      console.error(`[Reddit] HTTP ${hotResp.status}`);
      return null;
    }

    const hotXml = await hotResp.text();
    const risingXml = risingResp.ok ? await risingResp.text() : "";

    const parseEntries = (xml: string, isRising: boolean) => {
      const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];
      return entries.map((m, i) => {
        const block = m[1];
        const title = block.match(/<title>([^<]+)<\/title>/)?.[1]?.trim() ?? "";
        const subreddit = block.match(/term="([^"]+)"/)?.[1] ?? "all";
        return { title, subreddit, isRising, rank: i };
      }).filter(e => e.title.length > 5);
    };

    const hotEntries = parseEntries(hotXml, false);
    const risingEntries = parseEntries(risingXml, true);

    const subredditMap = new Map<string, { titles: string[]; isRising: boolean; count: number }>();
    for (const entry of [...hotEntries, ...risingEntries]) {
      const sub = entry.subreddit.toLowerCase();
      if (!subredditMap.has(sub)) {
        subredditMap.set(sub, { titles: [], isRising: entry.isRising, count: 0 });
      }
      const rec = subredditMap.get(sub)!;
      rec.titles.push(entry.title);
      rec.count++;
      if (entry.isRising) rec.isRising = true;
    }

    const ranked = [...subredditMap.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20);

    const trends: RawTrend[] = ranked.map(([subreddit, data], i) => {
      const representativeTitle = data.titles[0] ?? subreddit;
      const keyword = representativeTitle.length > 55
        ? representativeTitle.slice(0, 52) + "…"
        : representativeTitle;

      const baseVolume = Math.max(20000, 800000 - i * 38000 + Math.floor(Math.random() * 50000));
      const velocityPct = data.isRising
        ? Math.floor(Math.random() * 200) + 50
        : Math.floor(Math.random() * 80) + 10;

      return {
        id: `rd-${i + 1}`,
        keyword,
        category: guessCategory(representativeTitle + " " + subreddit),
        platform: ["reddit"] as Platform[],
        volume: baseVolume,
        volumeChange: velocityPct,
        velocity: (velocityPct > 100 ? "exploding" : velocityPct > 20 ? "rising" : "stable") as Velocity,
        rank: i + 1,
        relatedKeywords: [`r/${subreddit}`, ...data.titles.slice(1, 3).map(t => t.slice(0, 30))],
        volumeHistory: Array.from({ length: 9 }, (_, j) =>
          Math.floor(baseVolume * (0.2 + j * 0.1 + Math.random() * 0.05))
        ),
        peakTime: `${Math.floor(Math.random() * 4) + 1}h ago`,
        sentiment: (velocityPct > 60 ? "positive" : velocityPct < 10 ? "negative" : "neutral") as Sentiment,
        region: "Global",
        source: "trends24" as const,
      };
    });

    console.log(`[Reddit] Fetched ${trends.length} trending topics from r/all`);
    return trends.length > 0 ? trends : null;
  } catch (err) {
    console.error("[Reddit] Fetch failed:", err);
    return null;
  }
}

export function getMockTrends(): RawTrend[] {
  return addNoise(MOCK_TRENDS);
}
