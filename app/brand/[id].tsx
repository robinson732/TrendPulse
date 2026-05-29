import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { trackBrandView, trackTrendInteraction } from "@/lib/analytics";

interface AdPricing {
  trendId: string;
  keyword: string;
  currentCPM: string;
  currency: string;
  tier: string;
  velocity: string;
  volumeChange: string;
  volume: number;
  breakdown: {
    baseCPM: string;
    velocityBonus: string;
    volumeBonus: string;
    tierMultiplier: string;
    finalCPM: string;
  };
  timestamp: string;
}

interface CampaignAction {
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
}

interface BiddingAnalysis {
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

interface CampaignsResponse {
  active: CampaignAction[];
  stats: {
    activeCampaigns: number;
    blockedBids: number;
    totalBudget: number;
    avgCPM: number;
    byBrand: Record<string, { count: number; budget: number; avgCPM: number }>;
    marketTolerance: string;
    lastUpdated: string;
  };
}

interface SchedulerStatus {
  running: boolean;
  intervalMinutes: number;
  totalScans: number;
  lastScanTime: string | null;
  nextScanIn: number;
  recentScans: {
    scanId: string;
    timestamp: string;
    trendsScanned: number;
    actionsTriggered: number;
    activated: number;
    boosted: number;
    blocked: number;
    paused: number;
    durationMs: number;
  }[];
}

interface ApiCall {
  campaignId: string;
  endpoint: string;
  method: "WAKE_UP" | "PAUSE" | "UPDATE_BID" | "BLOCKED";
  sentCPM: number;
  status: "SUCCESS" | "SIMULATED" | "ERROR";
  message: string;
  timestamp: string;
}

interface PricingGraphData {
  trendpulseIndex: number[];
  marketBenchmark: number[];
  timestamps: string[];
  trendKeyword: string;
  category: string;
  currentCPM: number;
  currentBenchmark: number;
}

interface TrendDetail {
  id: string;
  keyword: string;
  volume: number;
  volumeChange: number;
  velocity: string;
  sentiment: string;
  volumeHistory: number[];
  category: string;
  region: string;
}

const TIER_COLORS: Record<string, string> = {
  Premium: "#FFD700",
  Enhanced: Colors.accent,
  Standard: Colors.green,
  Discount: Colors.textMuted,
};

const TIER_ICONS: Record<string, string> = {
  Premium: "diamond",
  Enhanced: "trending-up",
  Standard: "checkmark-circle",
  Discount: "pricetag",
};

function predictPeakTime(volumeHistory: number[]): string {
  if (volumeHistory.length < 3) return "Insufficient data";
  const recent = volumeHistory.slice(-3);
  const accel = (recent[2] - recent[1]) - (recent[1] - recent[0]);
  if (accel > 0) return "In 1-2 hours";
  if (accel === 0) return "Peaking now";
  const decel = Math.abs(accel);
  const currentGrowth = recent[2] - recent[1];
  if (currentGrowth <= 0) return "Already peaked";
  const hoursLeft = Math.ceil(currentGrowth / decel);
  if (hoursLeft <= 1) return "In ~30 min";
  if (hoursLeft <= 3) return `In ~${hoursLeft}h`;
  return `In ~${hoursLeft}h`;
}

function calcEngagementRate(volume: number, volumeChange: number): number {
  const base = 3.2;
  const velocityBoost = Math.max(0, volumeChange) / 50;
  const volumeBoost = Math.min(volume / 5_000_000, 1) * 4;
  return Math.min(parseFloat((base + velocityBoost + volumeBoost).toFixed(1)), 15.0);
}

function calcClickThrough(engRate: number): number {
  return parseFloat((engRate * 0.32 + Math.random() * 0.5).toFixed(2));
}

function calcImpressions(volume: number): string {
  const impressions = volume * (2.4 + Math.random() * 0.8);
  if (impressions >= 1_000_000) return `${(impressions / 1_000_000).toFixed(1)}M`;
  if (impressions >= 1_000) return `${(impressions / 1_000).toFixed(0)}K`;
  return `${Math.floor(impressions)}`;
}

function StatCard({
  label,
  value,
  icon,
  color,
  subtitle,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      {subtitle ? <Text style={styles.statSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function BreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.breakdownRow}>
      <Text style={styles.breakdownLabel}>{label}</Text>
      <Text style={styles.breakdownValue}>{value}</Text>
    </View>
  );
}

export default function BrandAnalyticsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: pricing, isLoading: pricingLoading } = useQuery<AdPricing>({
    queryKey: [`/api/ads/pricing/${id}`],
    refetchInterval: 30000,
  });

  const { data: trend, isLoading: trendLoading } = useQuery<TrendDetail>({
    queryKey: [`/api/trends/${id}`],
  });

  const { data: campaigns } = useQuery<CampaignsResponse>({
    queryKey: ["/api/ads/campaigns"],
    refetchInterval: 30000,
  });

  const { data: bidding } = useQuery<BiddingAnalysis>({
    queryKey: [`/api/ads/bidding/${id}`],
    refetchInterval: 30000,
  });

  const { data: scheduler } = useQuery<SchedulerStatus>({
    queryKey: ["/api/ads/scheduler"],
    refetchInterval: 10000,
  });

  const { data: apiCalls } = useQuery<{ calls: ApiCall[] }>({
    queryKey: ["/api/ads/api-calls"],
    refetchInterval: 15000,
  });

  const { data: pricingGraph } = useQuery<PricingGraphData>({
    queryKey: [`/api/ads/bidding/history/graph/${id}`],
    refetchInterval: 30000,
  });

  const isLoading = pricingLoading || trendLoading;

  const trendCampaigns = useMemo(() => {
    if (!campaigns?.active || !pricing?.keyword) return [];
    return campaigns.active.filter(
      (c) => c.trendKeyword.toLowerCase() === pricing.keyword.toLowerCase()
    );
  }, [campaigns?.active, pricing?.keyword]);

  React.useEffect(() => {
    if (pricing && trend) {
      trackBrandView(id, pricing.keyword, pricing.currentCPM, pricing.tier);
    }
  }, [id, pricing?.keyword, pricing?.currentCPM, pricing?.tier, trend]);

  const metrics = useMemo(() => {
    if (!trend || !pricing) return null;
    const engRate = calcEngagementRate(trend.volume, trend.volumeChange);
    const ctr = calcClickThrough(engRate);
    const impressions = calcImpressions(trend.volume);
    const peakPrediction = predictPeakTime(trend.volumeHistory || []);
    const estReach = trend.volume * 3.2;
    const reachStr =
      estReach >= 1_000_000
        ? `${(estReach / 1_000_000).toFixed(1)}M`
        : `${(estReach / 1_000).toFixed(0)}K`;

    return { engRate, ctr, impressions, peakPrediction, reachStr };
  }, [trend, pricing]);

  const tierColor = TIER_COLORS[pricing?.tier || "Standard"] || Colors.accent;

  const handleBack = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleBoost = () => {
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    trackTrendInteraction(id, "boost_request", {
      keyword: pricing?.keyword || "",
      cpm: pricing?.currentCPM || "",
      tier: pricing?.tier || "",
    });
    Alert.alert(
      "Boost Ad Presence",
      `Place your ad on ${pricing?.keyword || "this trend"} at $${pricing?.currentCPM}/CPM (${pricing?.tier} tier).\n\nThis will maximize visibility during the predicted peak window.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Request Quote",
          onPress: () =>
            Alert.alert("Quote Requested", "Our ad team will contact you within 24 hours."),
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.navBar}>
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.6 }]}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <View style={styles.navTitle}>
          <Ionicons name="analytics-outline" size={18} color={Colors.accent} />
          <Text style={styles.navTitleText} numberOfLines={1}>
            Brand Insights
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading brand analytics...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Platform.OS === "web" ? 40 : insets.bottom + 20 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroSection}>
            <Text style={styles.heroKeyword}>{pricing?.keyword}</Text>
            <View style={[styles.tierBadge, { backgroundColor: tierColor + "20", borderColor: tierColor + "40" }]}>
              <Ionicons
                name={(TIER_ICONS[pricing?.tier || "Standard"] || "checkmark-circle") as any}
                size={14}
                color={tierColor}
              />
              <Text style={[styles.tierText, { color: tierColor }]}>
                {pricing?.tier} Tier
              </Text>
            </View>
          </View>

          <View style={styles.cpmCard}>
            <Text style={styles.cpmLabel}>Current CPM</Text>
            <View style={styles.cpmRow}>
              <Text style={styles.cpmDollar}>$</Text>
              <Text style={styles.cpmValue}>{pricing?.currentCPM}</Text>
            </View>
            <Text style={styles.cpmSubtext}>
              per 1,000 impressions · {pricing?.velocity} · {pricing?.volumeChange} velocity
            </Text>
          </View>

          <View style={styles.statsGrid}>
            <StatCard
              label="Engagement Rate"
              value={`${metrics?.engRate}%`}
              icon="pulse"
              color={Colors.green}
              subtitle="Based on user interactions"
            />
            <StatCard
              label="Click-Through"
              value={`${metrics?.ctr}%`}
              icon="finger-print"
              color={Colors.accent}
              subtitle="Estimated CTR"
            />
            <StatCard
              label="Est. Impressions"
              value={metrics?.impressions || "—"}
              icon="eye-outline"
              color="#A78BFA"
              subtitle="Available ad slots"
            />
            <StatCard
              label="Predicted Peak"
              value={metrics?.peakPrediction || "—"}
              icon="time-outline"
              color={Colors.yellow}
              subtitle="Best time to boost"
            />
          </View>

          <View style={styles.reachCard}>
            <Ionicons name="globe-outline" size={20} color={Colors.accent} />
            <View style={styles.reachInfo}>
              <Text style={styles.reachLabel}>Estimated Reach</Text>
              <Text style={styles.reachValue}>{metrics?.reachStr} users</Text>
            </View>
            <View style={styles.reachMeta}>
              <Text style={styles.reachMetaText}>{trend?.region || "Global"}</Text>
              <Text style={styles.reachMetaDot}>·</Text>
              <Text style={styles.reachMetaText}>{trend?.category || "General"}</Text>
            </View>
          </View>

          <View style={styles.breakdownCard}>
            <Text style={styles.sectionTitle}>Pricing Breakdown</Text>
            {pricing?.breakdown && (
              <>
                <BreakdownRow label="Base CPM" value={pricing.breakdown.baseCPM} />
                <BreakdownRow label="Velocity Bonus" value={pricing.breakdown.velocityBonus} />
                <BreakdownRow label="Volume Bonus" value={pricing.breakdown.volumeBonus} />
                <BreakdownRow label="Tier Multiplier" value={pricing.breakdown.tierMultiplier} />
                <View style={styles.breakdownDivider} />
                <BreakdownRow label="Final CPM" value={pricing.breakdown.finalCPM} />
              </>
            )}
          </View>

          <View style={styles.sentimentCard}>
            <Text style={styles.sectionTitle}>Audience Sentiment</Text>
            <View style={styles.sentimentRow}>
              <View style={styles.sentimentItem}>
                <Ionicons
                  name={
                    trend?.sentiment === "positive"
                      ? "happy-outline"
                      : trend?.sentiment === "negative"
                      ? "sad-outline"
                      : "ellipse-outline"
                  }
                  size={28}
                  color={
                    trend?.sentiment === "positive"
                      ? Colors.green
                      : trend?.sentiment === "negative"
                      ? Colors.red
                      : Colors.yellow
                  }
                />
                <Text style={styles.sentimentLabel}>
                  {(trend?.sentiment || "neutral").charAt(0).toUpperCase() +
                    (trend?.sentiment || "neutral").slice(1)}
                </Text>
              </View>
              <Text style={styles.sentimentAdvice}>
                {trend?.sentiment === "positive"
                  ? "Great fit for brand association"
                  : trend?.sentiment === "negative"
                  ? "Caution: negative sentiment detected"
                  : "Neutral sentiment — versatile placement"}
              </Text>
            </View>
          </View>

          {bidding && (
            <View style={styles.campaignCard}>
              <Text style={styles.sectionTitle}>Market Analysis</Text>
              <View style={styles.benchmarkRow}>
                <View style={styles.benchmarkItem}>
                  <Text style={styles.benchmarkLabel}>Our CPM</Text>
                  <Text style={[styles.benchmarkValue, { color: bidding.validated ? "#00ff9d" : "#ff4d6d" }]}>
                    ${bidding.calculatedCPM}
                  </Text>
                </View>
                <View style={styles.benchmarkVs}>
                  <Text style={styles.benchmarkVsText}>vs</Text>
                </View>
                <View style={styles.benchmarkItem}>
                  <Text style={styles.benchmarkLabel}>Market</Text>
                  <Text style={styles.benchmarkValue}>${bidding.marketBenchmark}</Text>
                </View>
                <View style={styles.benchmarkItem}>
                  <Text style={styles.benchmarkLabel}>Ratio</Text>
                  <Text style={[styles.benchmarkValue, { color: bidding.priceRatio <= 1.2 ? "#00ff9d" : "#ff4d6d" }]}>
                    {bidding.priceRatio}x
                  </Text>
                </View>
              </View>
              <View style={[
                styles.validationBadge,
                { backgroundColor: bidding.validated ? "rgba(0,255,157,0.1)" : "rgba(255,77,109,0.1)" },
              ]}>
                <Ionicons
                  name={bidding.validated ? "checkmark-circle" : "close-circle"}
                  size={16}
                  color={bidding.validated ? "#00ff9d" : "#ff4d6d"}
                />
                <Text style={[styles.validationText, { color: bidding.validated ? "#00ff9d" : "#ff4d6d" }]}>
                  {bidding.validated
                    ? `Prix validé — dans la tolérance marché (${campaigns?.stats?.marketTolerance || "120%"})`
                    : "Prix trop élevé — enchère bloquée pour protéger le budget"}
                </Text>
              </View>
            </View>
          )}

          {pricingGraph && (
            <View style={styles.campaignCard}>
              <Text style={styles.sectionTitle}>Pricing History</Text>
              <View style={styles.chartContainer}>
                <View style={styles.chartArea}>
                  {(() => {
                    const allValues = [...pricingGraph.trendpulseIndex, ...pricingGraph.marketBenchmark];
                    const maxVal = Math.max(...allValues) * 1.1;
                    const minVal = Math.min(...allValues) * 0.9;
                    const range = maxVal - minVal || 1;
                    const chartHeight = 120;
                    const chartWidth = 100;

                    const getY = (val: number) => ((maxVal - val) / range) * chartHeight;

                    return (
                      <>
                        <View style={styles.chartYAxis}>
                          <Text style={styles.chartYLabel}>${maxVal.toFixed(1)}</Text>
                          <Text style={styles.chartYLabel}>${((maxVal + minVal) / 2).toFixed(1)}</Text>
                          <Text style={styles.chartYLabel}>${minVal.toFixed(1)}</Text>
                        </View>
                        <View style={[styles.chartGraph, { height: chartHeight }]}>
                          {pricingGraph.trendpulseIndex.map((val, i) => {
                            const x = (i / (pricingGraph.trendpulseIndex.length - 1)) * chartWidth;
                            const y = getY(val);
                            return (
                              <View
                                key={`tp-${i}`}
                                style={[
                                  styles.chartDot,
                                  {
                                    left: `${x}%`,
                                    top: y,
                                    backgroundColor: Colors.accent,
                                  },
                                ]}
                              />
                            );
                          })}
                          {pricingGraph.marketBenchmark.map((val, i) => {
                            const x = (i / (pricingGraph.marketBenchmark.length - 1)) * chartWidth;
                            const y = getY(val);
                            return (
                              <View
                                key={`mb-${i}`}
                                style={[
                                  styles.chartDot,
                                  {
                                    left: `${x}%`,
                                    top: y,
                                    backgroundColor: "#FFD700",
                                  },
                                ]}
                              />
                            );
                          })}
                          {pricingGraph.trendpulseIndex.map((val, i) => {
                            if (i === 0) return null;
                            const prevVal = pricingGraph.trendpulseIndex[i - 1];
                            const x1 = ((i - 1) / (pricingGraph.trendpulseIndex.length - 1)) * chartWidth;
                            const x2 = (i / (pricingGraph.trendpulseIndex.length - 1)) * chartWidth;
                            const y1 = getY(prevVal);
                            const y2 = getY(val);
                            const dx = ((x2 - x1) / 100) * 280;
                            const dy = y2 - y1;
                            const length = Math.sqrt(dx * dx + dy * dy);
                            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                            return (
                              <View
                                key={`line-tp-${i}`}
                                style={[
                                  styles.chartLine,
                                  {
                                    left: `${x1}%`,
                                    top: y1 + 4,
                                    width: length,
                                    backgroundColor: Colors.accent,
                                    transform: [{ rotate: `${angle}deg` }],
                                  },
                                ]}
                              />
                            );
                          })}
                          {pricingGraph.marketBenchmark.map((val, i) => {
                            if (i === 0) return null;
                            const prevVal = pricingGraph.marketBenchmark[i - 1];
                            const x1 = ((i - 1) / (pricingGraph.marketBenchmark.length - 1)) * chartWidth;
                            const x2 = (i / (pricingGraph.marketBenchmark.length - 1)) * chartWidth;
                            const y1 = getY(prevVal);
                            const y2 = getY(val);
                            const dx = ((x2 - x1) / 100) * 280;
                            const dy = y2 - y1;
                            const length = Math.sqrt(dx * dx + dy * dy);
                            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                            return (
                              <View
                                key={`line-mb-${i}`}
                                style={[
                                  styles.chartLine,
                                  {
                                    left: `${x1}%`,
                                    top: y1 + 4,
                                    width: length,
                                    backgroundColor: "#FFD700",
                                    opacity: 0.5,
                                    transform: [{ rotate: `${angle}deg` }],
                                  },
                                ]}
                              />
                            );
                          })}
                        </View>
                      </>
                    );
                  })()}
                </View>
                <View style={styles.chartXAxis}>
                  {pricingGraph.timestamps.map((ts, i) => (
                    <Text key={`ts-${i}`} style={styles.chartXLabel}>{ts}</Text>
                  ))}
                </View>
                <View style={styles.chartLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: Colors.accent }]} />
                    <Text style={styles.legendText}>TrendPulse CPM</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: "#FFD700" }]} />
                    <Text style={styles.legendText}>Market Benchmark</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          <View style={styles.campaignCard}>
            <Text style={styles.sectionTitle}>Ad Automation</Text>
            {campaigns?.stats && (
              <View style={styles.campaignStatsRow}>
                <View style={styles.campaignStatBox}>
                  <Text style={styles.campaignStatValue}>{campaigns.stats.activeCampaigns}</Text>
                  <Text style={styles.campaignStatLabel}>Active</Text>
                </View>
                <View style={styles.campaignStatBox}>
                  <Text style={styles.campaignStatValue}>${campaigns.stats.totalBudget.toLocaleString()}</Text>
                  <Text style={styles.campaignStatLabel}>Budget</Text>
                </View>
                <View style={styles.campaignStatBox}>
                  <Text style={[styles.campaignStatValue, { color: campaigns.stats.blockedBids > 0 ? "#ff4d6d" : Colors.accent }]}>
                    {campaigns.stats.blockedBids}
                  </Text>
                  <Text style={styles.campaignStatLabel}>Blocked</Text>
                </View>
                <View style={styles.campaignStatBox}>
                  <Text style={styles.campaignStatValue}>${campaigns.stats.avgCPM}</Text>
                  <Text style={styles.campaignStatLabel}>Avg CPM</Text>
                </View>
              </View>
            )}
            {trendCampaigns.length > 0 ? (
              trendCampaigns.map((c, i) => (
                <View key={`${c.brandId}-${i}`} style={styles.campaignItem}>
                  <View style={styles.campaignItemHeader}>
                    <View style={[
                      styles.campaignActionBadge,
                      {
                        backgroundColor:
                          c.action === "activated" ? "rgba(0,255,157,0.15)"
                          : c.action === "boosted" ? "rgba(255,215,0,0.15)"
                          : c.action === "blocked" ? "rgba(255,77,109,0.15)"
                          : "rgba(255,77,109,0.1)",
                      },
                    ]}>
                      <Text style={[
                        styles.campaignActionText,
                        {
                          color:
                            c.action === "activated" ? "#00ff9d"
                            : c.action === "boosted" ? "#FFD700"
                            : c.action === "blocked" ? "#ff4d6d"
                            : "#ff4d6d",
                        },
                      ]}>
                        {c.action === "activated" ? "🔥 ACTIVATED"
                          : c.action === "boosted" ? "📈 BOOSTED"
                          : c.action === "blocked" ? "⚠️ BLOCKED"
                          : "⏸ PAUSED"}
                      </Text>
                    </View>
                    <Text style={styles.campaignBudget}>
                      {c.action === "blocked" ? "—" : `$${c.newBudget.toLocaleString()}`}
                    </Text>
                  </View>
                  <View style={styles.campaignMetaRow}>
                    <Text style={styles.campaignBrand}>{c.brandName}</Text>
                    {c.cpm > 0 && (
                      <Text style={styles.campaignCPM}>
                        CPM ${c.cpm} {c.priceValidated ? "✅" : "❌"} (marché: ${c.marketBenchmark})
                      </Text>
                    )}
                  </View>
                  <Text style={styles.campaignReason} numberOfLines={3}>{c.reason}</Text>
                </View>
              ))
            ) : (
              <View style={styles.campaignEmpty}>
                <Ionicons name="flash-outline" size={20} color={Colors.textMuted} />
                <Text style={styles.campaignEmptyText}>
                  No automated campaigns for this trend
                </Text>
              </View>
            )}
          </View>

          {scheduler && (
            <View style={styles.campaignCard}>
              <View style={styles.schedulerHeader}>
                <Text style={styles.sectionTitle}>Automate</Text>
                <View style={[styles.schedulerBadge, { backgroundColor: scheduler.running ? "rgba(0,255,157,0.15)" : "rgba(255,77,109,0.15)" }]}>
                  <View style={[styles.schedulerDot, { backgroundColor: scheduler.running ? "#00ff9d" : "#ff4d6d" }]} />
                  <Text style={[styles.schedulerBadgeText, { color: scheduler.running ? "#00ff9d" : "#ff4d6d" }]}>
                    {scheduler.running ? "ACTIF" : "ARRÊTÉ"}
                  </Text>
                </View>
              </View>
              <View style={styles.campaignStatsRow}>
                <View style={styles.campaignStatBox}>
                  <Text style={styles.campaignStatValue}>{scheduler.totalScans}</Text>
                  <Text style={styles.campaignStatLabel}>Scans</Text>
                </View>
                <View style={styles.campaignStatBox}>
                  <Text style={styles.campaignStatValue}>{scheduler.intervalMinutes}m</Text>
                  <Text style={styles.campaignStatLabel}>Interval</Text>
                </View>
                <View style={styles.campaignStatBox}>
                  <Text style={styles.campaignStatValue}>{scheduler.nextScanIn}s</Text>
                  <Text style={styles.campaignStatLabel}>Prochain</Text>
                </View>
              </View>
              {scheduler.recentScans.length > 0 && (
                <View style={styles.scanHistoryList}>
                  {scheduler.recentScans.slice(0, 3).map((scan) => (
                    <View key={scan.scanId} style={styles.scanHistoryItem}>
                      <View style={styles.scanHistoryRow}>
                        <Text style={styles.scanTime}>
                          ⏰ {new Date(scan.timestamp).toLocaleTimeString()}
                        </Text>
                        <Text style={styles.scanDuration}>{scan.durationMs}ms</Text>
                      </View>
                      <Text style={styles.scanDetails}>
                        {scan.trendsScanned} trends → {scan.actionsTriggered} action(s)
                        {scan.blocked > 0 ? ` | ${scan.blocked} blocked` : ""}
                        {scan.activated > 0 ? ` | ${scan.activated} activated` : ""}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {apiCalls && apiCalls.calls.length > 0 && (
            <View style={styles.campaignCard}>
              <Text style={styles.sectionTitle}>API Calls</Text>
              {apiCalls.calls.slice(0, 5).map((call, i) => {
                const methodColors: Record<string, string> = {
                  WAKE_UP: "#00ff9d",
                  UPDATE_BID: "#FFD700",
                  PAUSE: "#ff4d6d",
                  BLOCKED: "#ff6b35",
                };
                const methodIcons: Record<string, string> = {
                  WAKE_UP: "🔥",
                  UPDATE_BID: "📈",
                  PAUSE: "🛑",
                  BLOCKED: "⚠️",
                };
                return (
                  <View key={`api-${i}`} style={styles.apiCallItem}>
                    <View style={styles.apiCallHeader}>
                      <View style={[styles.apiMethodBadge, { backgroundColor: `${methodColors[call.method] || Colors.accent}20` }]}>
                        <Text style={[styles.apiMethodText, { color: methodColors[call.method] || Colors.accent }]}>
                          {methodIcons[call.method]} {call.method}
                        </Text>
                      </View>
                      <View style={[styles.apiStatusBadge, { backgroundColor: call.status === "SIMULATED" ? "rgba(255,215,0,0.15)" : "rgba(0,255,157,0.15)" }]}>
                        <Text style={[styles.apiStatusText, { color: call.status === "SIMULATED" ? "#FFD700" : "#00ff9d" }]}>
                          {call.status}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.apiEndpoint} numberOfLines={1}>
                      {call.endpoint}
                    </Text>
                    <Text style={styles.apiMessage} numberOfLines={2}>
                      {call.message}
                    </Text>
                    <Text style={styles.apiTimestamp}>
                      {new Date(call.timestamp).toLocaleTimeString()}
                      {call.sentCPM > 0 ? ` — CPM $${call.sentCPM}` : ""}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.boostBtn,
              pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
            ]}
            onPress={handleBoost}
          >
            <Ionicons name="rocket-outline" size={20} color={Colors.bg} />
            <Text style={styles.boostText}>Boost Ad Presence on This Trend</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  navBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.bgSurface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  navTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    justifyContent: "center",
  },
  navTitleText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  heroSection: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  heroKeyword: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  tierText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  cpmCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cpmLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
    marginBottom: 8,
  },
  cpmRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  cpmDollar: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.accent,
    marginTop: 4,
  },
  cpmValue: {
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  cpmSubtext: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: "45%" as any,
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  statValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  statSubtitle: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  reachCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  reachInfo: {
    flex: 1,
    gap: 2,
  },
  reachLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  reachValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  reachMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  reachMetaText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  reachMetaDot: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  breakdownCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 4,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  breakdownLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  breakdownValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  sentimentCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  sentimentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sentimentItem: {
    alignItems: "center",
    gap: 4,
  },
  sentimentLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  sentimentAdvice: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    lineHeight: 18,
  },
  campaignCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  campaignStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  campaignStatBox: {
    flex: 1,
    backgroundColor: "rgba(0,255,157,0.06)",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(0,255,157,0.1)",
  },
  campaignStatValue: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.accent,
  },
  campaignStatLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  schedulerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  schedulerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  schedulerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  schedulerBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  scanHistoryList: {
    gap: 8,
  },
  scanHistoryItem: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  scanHistoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scanTime: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  scanDuration: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  scanDetails: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  chartContainer: {
    gap: 8,
  },
  chartArea: {
    flexDirection: "row",
    gap: 8,
  },
  chartYAxis: {
    justifyContent: "space-between",
    alignItems: "flex-end",
    width: 40,
  },
  chartYLabel: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  chartGraph: {
    flex: 1,
    position: "relative",
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  chartDot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: -4,
    marginTop: -4,
    zIndex: 2,
  },
  chartLine: {
    position: "absolute",
    height: 2,
    borderRadius: 1,
    transformOrigin: "left center",
    zIndex: 1,
  },
  chartXAxis: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingLeft: 48,
  },
  chartXLabel: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  chartLegend: {
    flexDirection: "row",
    gap: 16,
    justifyContent: "center",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  apiCallItem: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  apiCallHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  apiMethodBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  apiMethodText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  apiStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  apiStatusText: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  apiEndpoint: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    fontStyle: "italic" as const,
  },
  apiMessage: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  apiTimestamp: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  benchmarkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 6,
  },
  benchmarkItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  benchmarkLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  benchmarkValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  benchmarkVs: {
    paddingHorizontal: 4,
  },
  benchmarkVsText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  validationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
  },
  validationText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    flex: 1,
    lineHeight: 16,
  },
  campaignMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  campaignCPM: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  campaignItem: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(0,255,157,0.08)",
  },
  campaignItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  campaignActionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  campaignActionText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  campaignBudget: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  campaignBrand: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  campaignReason: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    lineHeight: 16,
  },
  campaignEmpty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  campaignEmptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    flex: 1,
  },
  boostBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.accent,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 4,
  },
  boostText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.bg,
  },
});
