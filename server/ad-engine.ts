import type { RawTrend } from "./data-sources";
import { saveBatchToFirebase, isFirestoreConnected, getBrandVideoContent, updateBrandLiveStatus, optimizeABTests, BudgetGuardian } from "./firebase-admin";

export interface BrandPartner {
  id: string;
  name: string;
  categories: string[];
  keywords: string[];
  baseBudget: number;
  maxBudget: number;
  automateBidding: boolean;
  adGroupId: string;
  active: boolean;
}

export interface AdCampaignAction {
  brandId: string;
  brandName: string;
  trendKeyword: string;
  trendCategory: string;
  velocity: string;
  volumeChange: number;
  action: "activated" | "boosted" | "paused" | "stable" | "blocked";
  newBudget: number;
  cpm: number;
  marketBenchmark: number;
  priceValidated: boolean;
  timestamp: string;
  reason: string;
  apiCall?: CampaignApiCall;
}

export interface CampaignApiCall {
  campaignId: string;
  endpoint: string;
  method: "WAKE_UP" | "PAUSE" | "UPDATE_BID" | "BLOCKED";
  sentCPM: number;
  status: "SUCCESS" | "SIMULATED" | "ERROR";
  message: string;
  timestamp: string;
}

const apiCallLog: CampaignApiCall[] = [];

function wakeUpCampaign(adGroupId: string, brandName: string, cpm: number, trendKeyword: string): CampaignApiCall {
  const call: CampaignApiCall = {
    campaignId: adGroupId,
    endpoint: `google-ads/v17/customers/campaigns/${adGroupId}`,
    method: "WAKE_UP",
    sentCPM: cpm,
    status: "SIMULATED",
    message: `🔥 Campagne ${brandName} réveillée — CPM $${cpm} envoyé pour "${trendKeyword}" (Simulé — connecter Google Ads API pour production)`,
    timestamp: new Date().toISOString(),
  };
  apiCallLog.push(call);
  if (apiCallLog.length > 200) apiCallLog.splice(0, apiCallLog.length - 200);
  console.log(`[Campaign API] ${call.message}`);
  return call;
}

function updateCampaignBid(adGroupId: string, brandName: string, cpm: number, trendKeyword: string): CampaignApiCall {
  const call: CampaignApiCall = {
    campaignId: adGroupId,
    endpoint: `google-ads/v17/customers/campaigns/${adGroupId}/bids`,
    method: "UPDATE_BID",
    sentCPM: cpm,
    status: "SIMULATED",
    message: `📈 Enchère ${brandName} augmentée — CPM $${cpm} pour "${trendKeyword}" (Simulé)`,
    timestamp: new Date().toISOString(),
  };
  apiCallLog.push(call);
  if (apiCallLog.length > 200) apiCallLog.splice(0, apiCallLog.length - 200);
  console.log(`[Campaign API] ${call.message}`);
  return call;
}

function pauseCampaign(adGroupId: string, brandName: string, reason: string): CampaignApiCall {
  const call: CampaignApiCall = {
    campaignId: adGroupId,
    endpoint: `google-ads/v17/customers/campaigns/${adGroupId}/status`,
    method: "PAUSE",
    sentCPM: 0,
    status: "SIMULATED",
    message: `🛑 Protection Budget : Campagne ${brandName} mise en pause — ${reason} (Simulé)`,
    timestamp: new Date().toISOString(),
  };
  apiCallLog.push(call);
  if (apiCallLog.length > 200) apiCallLog.splice(0, apiCallLog.length - 200);
  console.log(`[Campaign API] ${call.message}`);
  return call;
}

function blockCampaign(adGroupId: string, brandName: string, cpm: number, marketPrice: number, ratio: number): CampaignApiCall {
  const call: CampaignApiCall = {
    campaignId: adGroupId,
    endpoint: `google-ads/v17/customers/campaigns/${adGroupId}/block`,
    method: "BLOCKED",
    sentCPM: 0,
    status: "SIMULATED",
    message: `⚠️ Enchère ${brandName} bloquée — CPM $${cpm} dépasse le marché $${marketPrice} (ratio ${ratio}x > 120%). API non appelée.`,
    timestamp: new Date().toISOString(),
  };
  apiCallLog.push(call);
  if (apiCallLog.length > 200) apiCallLog.splice(0, apiCallLog.length - 200);
  console.log(`[Campaign API] ${call.message}`);
  return call;
}

export function getApiCallLog(limit = 30): CampaignApiCall[] {
  return apiCallLog.slice(-limit).reverse();
}

export interface TrendAlert {
  id: string;
  type: "ACTIVATED" | "BLOCKED" | "BOOSTED" | "PAUSED";
  icon: string;
  title: string;
  brand: string;
  trendKeyword: string;
  calculatedCPM: number;
  marketBenchmark: number;
  ratio: number;
  reason: string;
  color: string;
  timestamp: string;
  read: boolean;
}

let alertLog: TrendAlert[] = [];

function generateAlertId(): string {
  return `alert-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;
}

export function sendAlert(action: AdCampaignAction): TrendAlert {
  const typeMap: Record<string, TrendAlert["type"]> = {
    activated: "ACTIVATED",
    boosted: "BOOSTED",
    paused: "PAUSED",
    blocked: "BLOCKED",
    stable: "PAUSED",
  };
  const iconMap: Record<string, string> = {
    ACTIVATED: "🚀",
    BOOSTED: "📈",
    PAUSED: "⏸",
    BLOCKED: "🛡️",
  };
  const colorMap: Record<string, string> = {
    ACTIVATED: "#2ecc71",
    BOOSTED: "#f1c40f",
    PAUSED: "#e67e22",
    BLOCKED: "#e74c3c",
  };

  const alertType = typeMap[action.action] || "PAUSED";

  const alert: TrendAlert = {
    id: generateAlertId(),
    type: alertType,
    icon: iconMap[alertType] || "📊",
    title: `${iconMap[alertType]} Alerte TrendPulse : ${alertType}`,
    brand: action.brandName,
    trendKeyword: action.trendKeyword,
    calculatedCPM: action.cpm,
    marketBenchmark: action.marketBenchmark,
    ratio: action.cpm > 0 && action.marketBenchmark > 0
      ? Math.round((action.cpm / action.marketBenchmark) * 100) / 100
      : 0,
    reason: action.reason,
    color: colorMap[alertType] || "#95a5a6",
    timestamp: new Date().toISOString(),
    read: false,
  };

  alertLog.push(alert);
  if (alertLog.length > 200) alertLog = alertLog.slice(-200);

  console.log(`[TrendNotifier] ${alert.title} — ${action.brandName} sur "${action.trendKeyword}" (CPM $${action.cpm} vs marché $${action.marketBenchmark})`);

  if (alert.type === "ACTIVATED" || alert.ratio > 2.0) {
    sendDiscordWebhook(alert).catch((err) =>
      console.log(`[Discord] Webhook error: ${err.message}`)
    );
  }

  return alert;
}

async function sendDiscordWebhook(alert: TrendAlert): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log("[Discord] DISCORD_WEBHOOK_URL not configured — skipping notification");
    return;
  }

  const colorMap: Record<string, number> = {
    ACTIVATED: 0x2ecc71,
    BOOSTED: 0xf1c40f,
    PAUSED: 0xe67e22,
    BLOCKED: 0xe74c3c,
  };

  const payload = {
    embeds: [
      {
        title: `${alert.icon} Alerte TrendPulse : ${alert.type}`,
        description: `Action automatique pour **${alert.brand}**`,
        color: colorMap[alert.type] || 0x95a5a6,
        fields: [
          { name: "Tendance", value: alert.trendKeyword, inline: true },
          { name: "Notre Prix", value: `$${alert.calculatedCPM}`, inline: true },
          { name: "Ratio Marché", value: `${alert.ratio}x`, inline: true },
          { name: "Décision", value: alert.reason },
        ],
        footer: { text: "TrendPulse AI — Intelligence Publicitaire" },
        timestamp: alert.timestamp,
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (res.ok) {
    console.log(`[Discord] 📲 Notification envoyée ! (${alert.type} — ${alert.brand})`);
  } else {
    console.log(`[Discord] Webhook failed: ${res.status} ${res.statusText}`);
  }
}

export function getAlerts(limit = 30): TrendAlert[] {
  return alertLog.slice(-limit).reverse();
}

export function getUnreadAlerts(): { alerts: TrendAlert[]; count: number } {
  const unread = alertLog.filter((a) => !a.read);
  return { alerts: unread.slice(-20).reverse(), count: unread.length };
}

export function markAlertRead(alertId: string): boolean {
  const alert = alertLog.find((a) => a.id === alertId);
  if (alert) {
    alert.read = true;
    return true;
  }
  return false;
}

export function markAllAlertsRead(): number {
  let count = 0;
  for (const alert of alertLog) {
    if (!alert.read) {
      alert.read = true;
      count++;
    }
  }
  return count;
}

export interface PricingGraphData {
  trendpulseIndex: number[];
  marketBenchmark: number[];
  timestamps: string[];
  trendKeyword: string;
  category: string;
  currentCPM: number;
  currentBenchmark: number;
}

interface PricingSnapshot {
  cpm: number;
  benchmark: number;
  timestamp: string;
}

const pricingHistory: Map<string, PricingSnapshot[]> = new Map();

function recordPricingSnapshot(trendId: string, cpm: number, benchmark: number): void {
  if (!pricingHistory.has(trendId)) {
    pricingHistory.set(trendId, []);
  }
  const history = pricingHistory.get(trendId)!;
  history.push({ cpm, benchmark, timestamp: new Date().toISOString() });
  if (history.length > 48) history.splice(0, history.length - 48);
}

export function getPricingGraphData(trendId: string, trends: RawTrend[]): PricingGraphData {
  const trend = trends.find((t) => t.id === trendId);
  const keyword = trend?.keyword || trendId;
  const category = trend?.category || "Trending";

  const analysis = trend ? analyzeBidding(trend) : null;
  const currentCPM = analysis?.calculatedCPM || 0;
  const currentBenchmark = analysis?.marketBenchmark || 5.0;

  const history = pricingHistory.get(trendId);

  if (history && history.length >= 2) {
    return {
      trendpulseIndex: history.map((h) => h.cpm),
      marketBenchmark: history.map((h) => h.benchmark),
      timestamps: history.map((h) => {
        const d = new Date(h.timestamp);
        return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
      }),
      trendKeyword: keyword,
      category,
      currentCPM,
      currentBenchmark,
    };
  }

  const baseVariation = () => Math.round((Math.random() * 0.6 - 0.3) * 100) / 100;
  const points = 6;
  const trendpulseIndex: number[] = [];
  const marketBench: number[] = [];
  const timestamps: string[] = ["-24h", "-18h", "-12h", "-6h", "-1h", "Now"];

  let cpm = Math.max(3.0, currentCPM - 1.5 + Math.random());
  let bench = currentBenchmark;

  for (let i = 0; i < points; i++) {
    trendpulseIndex.push(Math.round(cpm * 100) / 100);
    marketBench.push(Math.round((bench + baseVariation() * 0.3) * 100) / 100);
    cpm += (currentCPM - cpm) / (points - i) + baseVariation() * 0.5;
  }

  trendpulseIndex[points - 1] = currentCPM;
  marketBench[points - 1] = currentBenchmark;

  return {
    trendpulseIndex,
    marketBenchmark: marketBench,
    timestamps,
    trendKeyword: keyword,
    category,
    currentCPM,
    currentBenchmark,
  };
}

export interface BiddingAnalysis {
  trendKeyword: string;
  category: string;
  velocityPct: number;
  mentionsM: number;
  calculatedCPM: number;
  marketBenchmark: number;
  priceRatio: number;
  validated: boolean;
  tier: string;
  breakdown: {
    baseCPM: number;
    velocityBonus: number;
    volumeBonus: number;
    tierMultiplier: number;
    finalCPM: number;
  };
}

const BASE_CPM = 5.0;
const VELOCITY_THRESHOLD = 85;
const MARKET_TOLERANCE = 1.2;

const MARKET_BENCHMARKS: Record<string, number> = {
  finance: 6.50,
  sports: 4.80,
  tech: 5.50,
  technology: 5.50,
  trending: 5.20,
  entertainment: 5.00,
  music: 4.50,
  news: 4.00,
  health: 5.80,
  science: 5.30,
  fashion: 5.60,
  politics: 4.20,
  environment: 3.80,
};

const BRAND_PARTNERS: BrandPartner[] = [
  {
    id: "bp-nordvpn",
    name: "NordVPN",
    categories: ["technology", "tech"],
    keywords: ["ai", "tech", "crypto", "blockchain", "cybersecurity", "privacy", "openai", "chatgpt"],
    baseBudget: 500,
    maxBudget: 5000,
    automateBidding: true,
    adGroupId: "ag-nordvpn-trends",
    active: true,
  },
  {
    id: "bp-spotify",
    name: "Spotify",
    categories: ["music", "entertainment"],
    keywords: ["music", "k-pop", "pop", "hiphop", "concert", "festival", "grammy", "taylor", "drake", "spotify"],
    baseBudget: 800,
    maxBudget: 8000,
    automateBidding: true,
    adGroupId: "ag-spotify-trends",
    active: true,
  },
  {
    id: "bp-nike",
    name: "Nike",
    categories: ["sports"],
    keywords: ["sports", "nba", "nfl", "soccer", "football", "olympics", "fitness", "mlb", "baseball", "ufc"],
    baseBudget: 1000,
    maxBudget: 10000,
    automateBidding: true,
    adGroupId: "ag-nike-trends",
    active: true,
  },
  {
    id: "bp-netflix",
    name: "Netflix",
    categories: ["entertainment"],
    keywords: ["netflix", "streaming", "movie", "series", "film", "tv", "entertainment"],
    baseBudget: 700,
    maxBudget: 7000,
    automateBidding: true,
    adGroupId: "ag-netflix-trends",
    active: true,
  },
  {
    id: "bp-coinbase",
    name: "CoinBase",
    categories: ["finance"],
    keywords: ["bitcoin", "ethereum", "crypto", "defi", "nft", "web3", "blockchain"],
    baseBudget: 600,
    maxBudget: 6000,
    automateBidding: true,
    adGroupId: "ag-coinbase-trends",
    active: true,
  },
];

class AICopywriter {
  static generateHeadline(brandName: string, trendKeyword: string, category: string): string {
    const templates: Record<string, string[]> = {
      finance: [
        `L'opportunité ${trendKeyword} n'attend pas. Investissez avec la précision de ${brandName}.`,
        `Le marché bouge sur ${trendKeyword}. Gardez une longueur d'avance avec ${brandName}.`,
      ],
      entertainment: [
        `Tout le monde parle de ${trendKeyword}. Vivez l'instant avec ${brandName}.`,
        `Ne ratez rien du phénomène ${trendKeyword} grâce à ${brandName}.`,
      ],
      technology: [
        `L'innovation rencontre ${trendKeyword}. Découvrez le futur avec ${brandName}.`,
        `Propulsez vos projets ${trendKeyword} avec la technologie ${brandName}.`,
      ],
      tech: [
        `L'innovation rencontre ${trendKeyword}. Découvrez le futur avec ${brandName}.`,
        `Propulsez vos projets ${trendKeyword} avec la technologie ${brandName}.`,
      ],
      sports: [
        `${trendKeyword} enflamme le terrain. Équipez-vous avec ${brandName}.`,
        `Le moment ${trendKeyword} est arrivé. ${brandName} vous propulse.`,
      ],
      music: [
        `${trendKeyword} résonne partout. Écoutez sur ${brandName}.`,
        `${brandName} x ${trendKeyword} — Votre bande-son, amplifiée.`,
      ],
    };

    const lowerCat = category.toLowerCase();
    const pool = templates[lowerCat] || [
      `Boostez votre présence sur ${trendKeyword} avec ${brandName}.`,
      `${brandName} & ${trendKeyword} : le duo gagnant du moment.`,
    ];

    return pool[Math.floor(Math.random() * pool.length)];
  }

  static generateABVariants(brandName: string, trendKeyword: string, category: string): { variant_a: string; variant_b: string } {
    return {
      variant_a: `${brandName} x ${trendKeyword} : Ne ratez pas le coche !`,
      variant_b: `Découvrez pourquoi ${brandName} est le partenaire idéal pour ${trendKeyword}.`,
    };
  }
}

const campaignLog: AdCampaignAction[] = [];
const activeCampaigns: Map<string, AdCampaignAction> = new Map();
const biddingHistory: BiddingAnalysis[] = [];

function getMarketBenchmark(category: string): number {
  const lower = category.toLowerCase();
  return MARKET_BENCHMARKS[lower] ?? BASE_CPM;
}

function calculateSmartCPM(
  velocityPct: number,
  mentionsM: number,
  tier: string
): { cpm: number; breakdown: BiddingAnalysis["breakdown"] } {
  const velocityBonus = velocityPct >= 5 ? 0.25 : 0.0;
  const volumeBonus = mentionsM >= 0.7 ? 0.50 : 0.0;

  let tierMultiplier = 1.0;
  if (tier === "Premium") tierMultiplier = 2.5;
  else if (tier === "Enhanced") tierMultiplier = 1.8;
  else if (tier === "Discount") tierMultiplier = 0.7;

  const finalCPM = (BASE_CPM + velocityBonus + volumeBonus) * tierMultiplier;
  const rounded = Math.round(finalCPM * 100) / 100;

  return {
    cpm: rounded,
    breakdown: {
      baseCPM: BASE_CPM,
      velocityBonus,
      volumeBonus,
      tierMultiplier,
      finalCPM: rounded,
    },
  };
}

function determineTier(velocity: string): string {
  if (velocity === "exploding") return "Premium";
  if (velocity === "rising") return "Enhanced";
  if (velocity === "falling") return "Discount";
  return "Standard";
}

function validatePrice(calculatedCPM: number, marketBenchmark: number): boolean {
  return calculatedCPM <= marketBenchmark * MARKET_TOLERANCE;
}

function matchBrands(trend: RawTrend): BrandPartner[] {
  const lowerKeyword = trend.keyword.toLowerCase();
  const lowerCategory = trend.category.toLowerCase();

  return BRAND_PARTNERS.filter((brand) => {
    if (!brand.active || !brand.automateBidding) return false;
    const categoryMatch = brand.categories.some((c) => lowerCategory.includes(c));
    const keywordMatch = brand.keywords.some((kw) => lowerKeyword.includes(kw));
    return categoryMatch || keywordMatch;
  });
}

function calculateBudget(brand: BrandPartner, volumeChange: number): number {
  const intensity = Math.min(Math.abs(volumeChange) / 500, 1);
  const budget = brand.baseBudget + (brand.maxBudget - brand.baseBudget) * intensity;
  return Math.round(budget * 100) / 100;
}

function determineAction(
  volumeChange: number,
  velocity: string
): "activated" | "boosted" | "paused" | "stable" {
  if (velocity === "exploding" && volumeChange >= VELOCITY_THRESHOLD) return "activated";
  if (velocity === "exploding") return "boosted";
  if (velocity === "rising" && volumeChange >= VELOCITY_THRESHOLD) return "boosted";
  if (velocity === "falling") return "paused";
  return "stable";
}

export function analyzeBidding(trend: RawTrend): BiddingAnalysis {
  const tier = determineTier(trend.velocity);
  const mentionsM = trend.volume / 1_000_000;
  const { cpm, breakdown } = calculateSmartCPM(trend.volumeChange, mentionsM, tier);
  const benchmark = getMarketBenchmark(trend.category);
  const priceRatio = cpm / benchmark;
  const validated = validatePrice(cpm, benchmark);

  return {
    trendKeyword: trend.keyword,
    category: trend.category,
    velocityPct: trend.volumeChange,
    mentionsM: Math.round(mentionsM * 100) / 100,
    calculatedCPM: cpm,
    marketBenchmark: benchmark,
    priceRatio: Math.round(priceRatio * 100) / 100,
    validated,
    tier,
    breakdown,
  };
}

export async function processAdAutomation(trends: RawTrend[]): Promise<AdCampaignAction[]> {
  const actions: AdCampaignAction[] = [];

  for (const trend of trends) {
    const matchedBrands = matchBrands(trend);
    if (matchedBrands.length === 0) continue;

    const baseAction = determineAction(trend.volumeChange, trend.velocity);
    const analysis = analyzeBidding(trend);

    if (biddingHistory.length < 200) {
      biddingHistory.push(analysis);
    } else {
      biddingHistory.shift();
      biddingHistory.push(analysis);
    }

    recordPricingSnapshot(trend.id, analysis.calculatedCPM, analysis.marketBenchmark);

    for (const brand of matchedBrands) {
      const campaignKey = `${brand.id}:${trend.id}`;
      const existingCampaign = activeCampaigns.get(campaignKey);

      if (baseAction === "stable" && !existingCampaign) continue;

      const newBudget =
        baseAction === "paused"
          ? 0
          : baseAction === "stable"
          ? brand.baseBudget
          : calculateBudget(brand, trend.volumeChange);

      let finalAction: AdCampaignAction["action"] = baseAction;
      let reason = "";

      if ((baseAction === "activated" || baseAction === "boosted") && analysis.validated && isFirestoreConnected()) {
        const brandFirestoreId = brand.name.toLowerCase().replace(/\s+/g, "-");
        const budgetCheck = await BudgetGuardian.checkAndLockBudget(brandFirestoreId, analysis.calculatedCPM);
        if (!budgetCheck.allowed) {
          finalAction = "blocked";
          reason = `🛑 BUDGET GUARDIAN : ${brand.name} — ${budgetCheck.reason}. Enchère annulée.`;
          console.log(`[Ad Engine] ${reason}`);
        }
      }

      if ((baseAction === "activated" || baseAction === "boosted") && !analysis.validated && finalAction !== "blocked") {
        finalAction = "blocked";
        reason =
          `⚠️ PRIX TROP ÉLEVÉ : ${trend.keyword} — CPM calculé $${analysis.calculatedCPM} vs marché $${analysis.marketBenchmark} (ratio ${analysis.priceRatio}x). ` +
          `Enchère annulée pour protéger le budget de ${brand.name}.`;
      } else {
        switch (baseAction) {
          case "activated":
            reason =
              `🔥 Tendance critique détectée : ${trend.keyword} (${trend.volumeChange}% velocity). ` +
              `CPM $${analysis.calculatedCPM} ✅ validé (marché: $${analysis.marketBenchmark}). ` +
              `Campagne ${brand.name} activée, budget → $${newBudget}`;
            break;
          case "boosted":
            reason =
              `📈 Tendance en hausse : ${trend.keyword}. ` +
              `CPM $${analysis.calculatedCPM} ✅ (marché: $${analysis.marketBenchmark}). ` +
              `Budget ${brand.name} augmenté → $${newBudget}`;
            break;
          case "paused":
            reason = `📉 Tendance en baisse : ${trend.keyword}. Campagne ${brand.name} mise en pause.`;
            break;
          case "stable":
            reason = `➡️ Tendance ${trend.keyword} stable, pas d'action requise pour ${brand.name}.`;
            break;
        }
      }

      if (existingCampaign && existingCampaign.action === finalAction) continue;

      let apiCall: CampaignApiCall | undefined;

      if (finalAction === "activated") {
        apiCall = wakeUpCampaign(brand.adGroupId, brand.name, analysis.calculatedCPM, trend.keyword);
      } else if (finalAction === "boosted") {
        apiCall = updateCampaignBid(brand.adGroupId, brand.name, analysis.calculatedCPM, trend.keyword);
      } else if (finalAction === "paused") {
        apiCall = pauseCampaign(brand.adGroupId, brand.name, `Tendance en baisse: ${trend.keyword}`);
      } else if (finalAction === "blocked") {
        apiCall = blockCampaign(brand.adGroupId, brand.name, analysis.calculatedCPM, analysis.marketBenchmark, analysis.priceRatio);
      }

      const campaignAction: AdCampaignAction = {
        brandId: brand.id,
        brandName: brand.name,
        trendKeyword: trend.keyword,
        trendCategory: trend.category,
        velocity: trend.velocity,
        volumeChange: trend.volumeChange,
        action: finalAction,
        newBudget: finalAction === "blocked" ? 0 : newBudget,
        cpm: analysis.calculatedCPM,
        marketBenchmark: analysis.marketBenchmark,
        priceValidated: analysis.validated,
        timestamp: new Date().toISOString(),
        reason,
        apiCall,
      };

      activeCampaigns.set(campaignKey, campaignAction);
      campaignLog.push(campaignAction);
      actions.push(campaignAction);

      sendAlert(campaignAction);

      console.log(`[Ad Engine] ${reason}`);
    }
  }

  if (campaignLog.length > 500) {
    campaignLog.splice(0, campaignLog.length - 500);
  }

  if (actions.length > 0 && isFirestoreConnected()) {
    const batchData = await Promise.all(actions.map(async (a) => {
      let creativeUrl: string | null = null;
      let adType = "TEXT_AD";

      let aiCopy = "";

      let abVariants: { variant_a: string; variant_b: string } | null = null;

      if (a.action === "activated") {
        aiCopy = AICopywriter.generateHeadline(a.brandName, a.trendKeyword, a.trendCategory);
        abVariants = AICopywriter.generateABVariants(a.brandName, a.trendKeyword, a.trendCategory);
        console.log(`[Ad Engine] ✨ IA: Texte généré pour ${a.brandName}: "${aiCopy}"`);
        console.log(`[Ad Engine] 🔬 A/B Test — A: "${abVariants.variant_a}" | B: "${abVariants.variant_b}"`);

        creativeUrl = await getBrandVideoContent(a.brandId);
        if (creativeUrl) {
          adType = "VIDEO_AD";
          console.log(`[Ad Engine] 🚀 PUB VIDÉO PRÊTE : Encart mis à jour pour ${a.trendKeyword} (${a.brandName})`);
        } else {
          console.log(`[Ad Engine] ⚠️ Contenu vidéo manquant pour ${a.brandName} — pub texte utilisée`);
        }

        updateBrandLiveStatus(a.brandName, {
          status: a.action.toUpperCase(),
          calculatedCPM: a.cpm,
          aiGeneratedCopy: aiCopy,
        }).catch(() => {});
      }

      return {
        brand: a.brandName,
        trendId: a.trendKeyword.toLowerCase().replace(/\s+/g, "-"),
        trendKeyword: a.trendKeyword,
        calculatedCPM: a.cpm,
        marketBenchmark: a.marketBenchmark,
        status: a.action.toUpperCase(),
        ratio: a.marketBenchmark > 0 ? Math.round((a.cpm / a.marketBenchmark) * 100) / 100 : 0,
        velocity: a.velocity,
        category: a.trendCategory,
        priceValidated: a.priceValidated,
        ...(creativeUrl ? { creative_url: creativeUrl, type: adType } : {}),
        ...(aiCopy ? { ai_generated_copy: aiCopy } : {}),
        ...(abVariants ? { ab_variants: abVariants } : {}),
      };
    }));
    saveBatchToFirebase(batchData).catch(() => {});
  }

  return actions;
}

export function getActiveCampaigns(): AdCampaignAction[] {
  return Array.from(activeCampaigns.values()).filter(
    (c) => c.action !== "paused" && c.action !== "stable"
  );
}

export function getCampaignLog(limit = 50): AdCampaignAction[] {
  return campaignLog.slice(-limit).reverse();
}

export function getCampaignStats() {
  const active = getActiveCampaigns();
  const validated = active.filter((c) => c.priceValidated);
  const blocked = active.filter((c) => c.action === "blocked");
  const totalBudget = validated.reduce((sum, c) => sum + c.newBudget, 0);
  const avgCPM = validated.length > 0 ? validated.reduce((sum, c) => sum + c.cpm, 0) / validated.length : 0;
  const byBrand: Record<string, { count: number; budget: number; avgCPM: number }> = {};

  for (const c of validated) {
    if (!byBrand[c.brandName]) byBrand[c.brandName] = { count: 0, budget: 0, avgCPM: 0 };
    byBrand[c.brandName].count++;
    byBrand[c.brandName].budget += c.newBudget;
    byBrand[c.brandName].avgCPM = (byBrand[c.brandName].avgCPM * (byBrand[c.brandName].count - 1) + c.cpm) / byBrand[c.brandName].count;
  }

  for (const key of Object.keys(byBrand)) {
    byBrand[key].avgCPM = Math.round(byBrand[key].avgCPM * 100) / 100;
  }

  return {
    activeCampaigns: validated.length,
    blockedBids: blocked.length,
    totalBudget: Math.round(totalBudget * 100) / 100,
    avgCPM: Math.round(avgCPM * 100) / 100,
    byBrand,
    marketTolerance: `${MARKET_TOLERANCE * 100}%`,
    lastUpdated: new Date().toISOString(),
  };
}

export function getBiddingHistory(limit = 20): BiddingAnalysis[] {
  return biddingHistory.slice(-limit).reverse();
}

export function getBrandPartners(): BrandPartner[] {
  return BRAND_PARTNERS;
}

const BRAND_VIDEOS: Record<string, string[]> = {
  NordVPN: [
    "https://videos.pexels.com/video-files/855282/855282-sd_640_360_25fps.mp4",
    "https://videos.pexels.com/video-files/856027/856027-sd_640_360_25fps.mp4",
    "https://videos.pexels.com/video-files/857196/857196-sd_640_360_25fps.mp4",
    "https://videos.pexels.com/video-files/3141207/3141207-sd_640_360_25fps.mp4",
  ],
  Spotify: [
    "https://videos.pexels.com/video-files/854614/854614-sd_640_360_25fps.mp4",
    "https://videos.pexels.com/video-files/856029/856029-sd_640_360_25fps.mp4",
    "https://videos.pexels.com/video-files/854618/854618-sd_640_360_25fps.mp4",
  ],
  Nike: [
    "https://videos.pexels.com/video-files/853825/853825-sd_640_360_25fps.mp4",
    "https://videos.pexels.com/video-files/853826/853826-sd_640_360_25fps.mp4",
    "https://videos.pexels.com/video-files/857195/857195-sd_640_360_25fps.mp4",
    "https://videos.pexels.com/video-files/857197/857197-sd_640_360_25fps.mp4",
  ],
  Netflix: [
    "https://videos.pexels.com/video-files/856028/856028-sd_640_360_25fps.mp4",
    "https://videos.pexels.com/video-files/856030/856030-sd_640_360_25fps.mp4",
    "https://videos.pexels.com/video-files/2795173/2795173-sd_640_360_25fps.mp4",
  ],
  CoinBase: [
    "https://videos.pexels.com/video-files/3141208/3141208-sd_640_360_25fps.mp4",
    "https://videos.pexels.com/video-files/3141209/3141209-sd_640_360_25fps.mp4",
    "https://videos.pexels.com/video-files/855282/855282-sd_640_360_25fps.mp4",
  ],
};

const videoRotation: Map<string, number> = new Map();

function getVideoForBrand(brandName: string): string {
  const videos = BRAND_VIDEOS[brandName];
  if (!videos || videos.length === 0) {
    return BRAND_VIDEOS.NordVPN[0];
  }
  const idx = videoRotation.get(brandName) || 0;
  const url = videos[idx % videos.length];
  videoRotation.set(brandName, idx + 1);
  return url;
}

export function getAdDataForTrend(trendKeyword: string, trendCategory?: string): { sponsor: string | null; ad_video_url: string | null; ad_headline: string | null; ad_cpm: number | null } {
  const key = Array.from(activeCampaigns.keys()).find((k) => k.includes(trendKeyword));
  const campaign = key ? activeCampaigns.get(key) : undefined;

  if (campaign && (campaign.action === "activated" || campaign.action === "boosted")) {
    return {
      sponsor: campaign.brandName,
      ad_video_url: getVideoForBrand(campaign.brandName),
      ad_headline: AICopywriter.generateHeadline(campaign.brandName, campaign.trendKeyword, campaign.trendCategory),
      ad_cpm: campaign.cpm,
    };
  }

  const lowerKeyword = trendKeyword.toLowerCase();
  const lowerCategory = (trendCategory || "").toLowerCase();
  for (const brand of BRAND_PARTNERS) {
    const keywordMatch = brand.keywords.some((kw) => lowerKeyword.includes(kw));
    const categoryMatch = brand.categories.some((cat) => lowerCategory.includes(cat) || lowerCategory === cat);
    if (keywordMatch || categoryMatch) {
      return {
        sponsor: brand.name,
        ad_video_url: getVideoForBrand(brand.name),
        ad_headline: AICopywriter.generateHeadline(brand.name, trendKeyword, trendCategory || "general"),
        ad_cpm: null,
      };
    }
  }

  return { sponsor: null, ad_video_url: null, ad_headline: null, ad_cpm: null };
}

export function preloadBrandVideos(): void {
  console.log("[VideoFetch] 🎬 Brand video library loaded — " + Object.keys(BRAND_VIDEOS).length + " brands, " + Object.values(BRAND_VIDEOS).flat().length + " videos");
}

interface SchedulerScanResult {
  scanId: string;
  timestamp: string;
  trendsScanned: number;
  actionsTriggered: number;
  activated: number;
  boosted: number;
  blocked: number;
  paused: number;
  durationMs: number;
}

const AD_SCAN_INTERVAL = 15 * 60 * 1000;
let schedulerRunning = false;
let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let scanHistory: SchedulerScanResult[] = [];
let lastScanTime: string | null = null;
let totalScans = 0;

function generateScanId(): string {
  return `scan-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;
}

async function runScheduledScan(getTrends: () => RawTrend[]): Promise<SchedulerScanResult> {
  const start = Date.now();
  const scanId = generateScanId();
  totalScans++;

  const now = new Date();
  console.log(`\n⏰ [${now.toLocaleTimeString()}] Lancement du scan automatique #${totalScans}...`);

  const trends = getTrends();
  const actions = await processAdAutomation(trends);

  const activated = actions.filter((a) => a.action === "activated").length;
  const boosted = actions.filter((a) => a.action === "boosted").length;
  const blocked = actions.filter((a) => a.action === "blocked").length;
  const paused = actions.filter((a) => a.action === "paused").length;

  const result: SchedulerScanResult = {
    scanId,
    timestamp: now.toISOString(),
    trendsScanned: trends.length,
    actionsTriggered: actions.length,
    activated,
    boosted,
    blocked,
    paused,
    durationMs: Date.now() - start,
  };

  lastScanTime = now.toISOString();

  scanHistory.push(result);
  if (scanHistory.length > 100) {
    scanHistory = scanHistory.slice(-100);
  }

  if (actions.length > 0) {
    console.log(`✅ Résultat de l'automate : ${actions.length} action(s) — ${activated} activated, ${boosted} boosted, ${blocked} blocked, ${paused} paused`);
  } else {
    console.log(`✅ Résultat de l'automate : Aucune action requise`);
  }

  if (isFirestoreConnected()) {
    const abOptimized = await optimizeABTests();
    if (abOptimized > 0) {
      console.log(`[A/B Test] ✅ ${abOptimized} test(s) optimisé(s) ce cycle`);
    }
  }

  return result;
}

export function startAdScheduler(getTrends: () => RawTrend[]): void {
  if (schedulerRunning) {
    console.log("[Ad Scheduler] Already running");
    return;
  }

  schedulerRunning = true;
  console.log(`🚀 Automate TrendPulse démarré ! (Scan toutes les 15 min)`);

  runScheduledScan(getTrends);

  schedulerTimer = setInterval(() => {
    runScheduledScan(getTrends);
  }, AD_SCAN_INTERVAL);
}

export function stopAdScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
  schedulerRunning = false;
  console.log("[Ad Scheduler] Stopped");
}

export async function triggerManualScan(getTrends: () => RawTrend[]): Promise<SchedulerScanResult> {
  console.log("[Ad Scheduler] Manual scan triggered");
  return runScheduledScan(getTrends);
}

export function getSchedulerStatus() {
  const nextScanIn = lastScanTime
    ? Math.max(0, AD_SCAN_INTERVAL - (Date.now() - new Date(lastScanTime).getTime()))
    : 0;

  return {
    running: schedulerRunning,
    intervalMinutes: AD_SCAN_INTERVAL / 60000,
    totalScans,
    lastScanTime,
    nextScanIn: Math.round(nextScanIn / 1000),
    recentScans: scanHistory.slice(-10).reverse(),
  };
}
