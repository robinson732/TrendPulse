import React, { useCallback, useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Platform,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { XIcon } from "@/components/XIcon";
import * as Haptics from "expo-haptics";
import * as SMS from "expo-sms";
import Colors from "@/constants/colors";
import { useTrends } from "@/contexts/TrendsContext";
import { MiniChart } from "@/components/MiniChart";
import { VelocityBadge } from "@/components/VelocityBadge";
import { trackTrendView, trackShare } from "@/lib/analytics";
import { getApiUrl } from "@/lib/query-client";

const PLATFORM_ICONS: Record<string, { name: string; color: string }> = {
  twitter: { name: "x-icon", color: "#FFFFFF" },
  instagram: { name: "logo-instagram", color: "#E1306C" },
  tiktok: { name: "musical-notes", color: "#69C9D0" },
  reddit: { name: "logo-reddit", color: "#FF4500" },
  youtube: { name: "logo-youtube", color: "#FF0000" },
};

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

function SentimentBar({ sentiment }: { sentiment: "positive" | "neutral" | "negative" }) {
  const pos = sentiment === "positive" ? 0.72 : sentiment === "neutral" ? 0.48 : 0.25;
  const neg = sentiment === "negative" ? 0.65 : sentiment === "neutral" ? 0.30 : 0.15;
  const neu = 1 - pos - neg;

  return (
    <View style={sentStyles.container}>
      <Text style={sentStyles.label}>Sentiment</Text>
      <View style={sentStyles.bar}>
        <View style={[sentStyles.seg, { flex: pos, backgroundColor: Colors.green }]} />
        <View style={[sentStyles.seg, { flex: neu, backgroundColor: Colors.yellow }]} />
        <View style={[sentStyles.seg, { flex: neg, backgroundColor: Colors.red }]} />
      </View>
      <View style={sentStyles.legend}>
        <View style={sentStyles.legendItem}>
          <View style={[sentStyles.dot, { backgroundColor: Colors.green }]} />
          <Text style={sentStyles.legendLabel}>Positive {Math.round(pos * 100)}%</Text>
        </View>
        <View style={sentStyles.legendItem}>
          <View style={[sentStyles.dot, { backgroundColor: Colors.yellow }]} />
          <Text style={sentStyles.legendLabel}>Neutral {Math.round(neu * 100)}%</Text>
        </View>
        <View style={sentStyles.legendItem}>
          <View style={[sentStyles.dot, { backgroundColor: Colors.red }]} />
          <Text style={sentStyles.legendLabel}>Negative {Math.round(neg * 100)}%</Text>
        </View>
      </View>
    </View>
  );
}

const sentStyles = StyleSheet.create({
  container: { gap: 10 },
  label: { fontSize: 15, fontFamily: "Inter_400Regular", fontWeight: "300" as const, color: Colors.textMuted, letterSpacing: 3, textTransform: "uppercase" },
  bar: { flexDirection: "row", height: 8, borderRadius: 4, overflow: "hidden", gap: 2 },
  seg: { borderRadius: 4 },
  legend: { flexDirection: "row", gap: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
});

export default function TrendDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { getTrend, isWatched, addToWatchlist, removeFromWatchlist } = useTrends();
  const trend = getTrend(id);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
    ]).start();
    if (trend) trackTrendView(trend.id, trend.keyword);
  }, [trend?.id]);

  const watched = trend ? isWatched(trend.id) : false;
  const [relatedKeywords, setRelatedKeywords] = useState<string[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedSource, setRelatedSource] = useState<string>("");

  useEffect(() => {
    if (!trend) return;
    setRelatedLoading(true);
    const url = new URL(`/api/trends/${trend.id}/related-keywords`, getApiUrl());
    fetch(url.toString())
      .then((r) => r.json())
      .then((data) => {
        if (data.keywords && data.keywords.length > 0) {
          setRelatedKeywords(data.keywords);
          setRelatedSource(data.source || "");
        } else {
          setRelatedKeywords(trend.relatedKeywords);
          setRelatedSource("local");
        }
      })
      .catch(() => {
        setRelatedKeywords(trend.relatedKeywords);
        setRelatedSource("local");
      })
      .finally(() => setRelatedLoading(false));
  }, [trend?.id]);

  const handleWatch = useCallback(() => {
    if (!trend) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (watched) removeFromWatchlist(trend.id);
    else addToWatchlist(trend.id);
  }, [watched, trend, addToWatchlist, removeFromWatchlist]);

  const handleShareSMS = useCallback(async () => {
    if (!trend) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const changePrefix = trend.volumeChange >= 0 ? "+" : "";
    const vol = trend.volume >= 1_000_000
      ? `${(trend.volume / 1_000_000).toFixed(1)}M`
      : trend.volume >= 1_000
      ? `${(trend.volume / 1_000).toFixed(0)}K`
      : `${trend.volume}`;
    const body =
      `Check out this trend on TrendPulse!\n\n` +
      `${trend.keyword}\n` +
      `${trend.category} · ${trend.region}\n` +
      `Volume: ${vol} (${changePrefix}${trend.volumeChange}% 24h)\n` +
      `Status: ${trend.velocity.charAt(0).toUpperCase() + trend.velocity.slice(1)}\n` +
      `Sentiment: ${trend.sentiment.charAt(0).toUpperCase() + trend.sentiment.slice(1)}`;

    if (Platform.OS === "web") {
      try {
        await navigator.clipboard.writeText(body);
        Alert.alert("Copied", "Trend details copied to clipboard for sharing.");
      } catch {
        Alert.alert("Error", "Could not copy to clipboard.");
      }
      return;
    }

    try {
      const isAvailable = await SMS.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert("SMS Unavailable", "SMS is not available on this device.");
        return;
      }
      await SMS.sendSMSAsync([], body);
      trackShare(trend.id, "sms");
    } catch {
      Alert.alert("Error", "Something went wrong while opening SMS.");
    }
  }, [trend]);

  const openPlatform = useCallback((platformName: string) => {
    if (!trend) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const keyword = trend.keyword.replace(/#/g, "");
    const encoded = encodeURIComponent(keyword);

    const deepLinks: Record<string, string> = {
      twitter: `twitter://search?query=%23${encoded}`,  
      instagram: `instagram://tag?name=${encoded}`,
      tiktok: `tiktok://search?q=${encoded}`,
      reddit: `reddit:///search?q=${encoded}`,
      youtube: `youtube://results?search_query=${encoded}`,
    };

    const webLinks: Record<string, string> = {
      twitter: `https://x.com/search?q=%23${encoded}`,
      instagram: `https://www.instagram.com/explore/tags/${encoded}/`,
      tiktok: `https://www.tiktok.com/search?q=${encoded}`,
      reddit: `https://www.reddit.com/search/?q=${encoded}`,
      youtube: `https://www.youtube.com/results?search_query=${encoded}`,
    };

    const deepLink = deepLinks[platformName];
    const webLink = webLinks[platformName] || `https://${platformName}.com/search?q=${encoded}`;

    if (Platform.OS === "web") {
      Linking.openURL(webLink);
      return;
    }

    if (deepLink) {
      Linking.openURL(deepLink).catch(() => {
        Linking.openURL(webLink);
      });
    } else {
      Linking.openURL(webLink);
    }
  }, [trend]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  if (!trend) {
    return (
      <View style={[styles.notFound, { paddingTop: topPad }]}>
        <Ionicons name="alert-circle-outline" size={44} color={Colors.textMuted} />
        <Text style={styles.notFoundText}>Trend not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const chartColor =
    trend.velocity === "exploding"
      ? Colors.accent
      : trend.velocity === "rising"
      ? Colors.green
      : trend.velocity === "falling"
      ? Colors.red
      : Colors.yellow;

  const changeColor = trend.volumeChange >= 0 ? Colors.green : Colors.red;
  const changePrefix = trend.volumeChange >= 0 ? "+" : "";

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.navBar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.6 }]}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <View style={styles.navRight}>
          <Pressable
            onPress={handleWatch}
            style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.6 }]}
            hitSlop={8}
          >
            <Ionicons
              name={watched ? "bookmark" : "bookmark-outline"}
              size={21}
              color={watched ? Colors.accent : Colors.textSecondary}
            />
          </Pressable>
        </View>
      </View>

      <Animated.ScrollView
        style={{ opacity: fadeIn, transform: [{ translateY: slideUp }] }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Platform.OS === "web" ? 40 : insets.bottom + 30 },
        ]}
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Text style={styles.keyword}>{trend.keyword}</Text>
            <VelocityBadge velocity={trend.velocity} />
          </View>
          <Text style={styles.category}>{trend.category} · {trend.region}</Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatVolume(trend.volume)}</Text>
            <Text style={styles.statLabel}>Total Volume</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: changeColor }]}>
              {changePrefix}{trend.volumeChange}%
            </Text>
            <Text style={styles.statLabel}>24h Change</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>#{trend.rank}</Text>
            <Text style={styles.statLabel}>Global Rank</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{trend.peakTime}</Text>
            <Text style={styles.statLabel}>Peak Time</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Volume Trend</Text>
          <View style={styles.chartCard}>
            <MiniChart
              data={trend.volumeHistory}
              width={320}
              height={100}
              color={chartColor}
              showFill
            />
            <View style={styles.chartMeta}>
              <Text style={styles.chartMetaText}>7-day momentum</Text>
              <Text style={[styles.chartMetaText, { color: chartColor }]}>
                {changePrefix}{trend.volumeChange}%
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Active Platforms</Text>
          <View style={styles.platformGrid}>
            {trend.platform.map((p) => {
              const info = PLATFORM_ICONS[p];
              return (
                <Pressable
                  key={p}
                  style={({ pressed }) => [styles.platformCard, pressed && { opacity: 0.6, transform: [{ scale: 0.95 }] }]}
                  onPress={() => openPlatform(p)}
                >
                  {info.name === "x-icon" ? <XIcon size={24} color={info.color} /> : <Ionicons name={info.name as any} size={24} color={info.color} />}
                  <Text style={styles.platformLabel}>{p === "twitter" ? "X" : p.charAt(0).toUpperCase() + p.slice(1)}</Text>
                  <Ionicons name="open-outline" size={10} color={Colors.textMuted} />
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <SentimentBar sentiment={trend.sentiment} />
        </View>

        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push({ pathname: "/pulse/[id]", params: { id: trend.id } });
          }}
          style={({ pressed }) => [styles.pulseBtn, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="musical-note" size={20} color={Colors.bg} />
          <Text style={styles.pulseBtnText}>View Pulse Feed</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.bg} />
        </Pressable>

        <View style={styles.section}>
          <View style={styles.relatedHeader}>
            <Text style={styles.sectionLabel}>Related Keywords</Text>
            {relatedSource === "google" && (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Live</Text>
              </View>
            )}
          </View>
          {relatedLoading ? (
            <View style={styles.relatedLoading}>
              <ActivityIndicator size="small" color={Colors.accent} />
              <Text style={styles.relatedLoadingText}>Fetching related keywords...</Text>
            </View>
          ) : relatedKeywords.length > 0 ? (
            <View style={styles.tagsWrap}>
              {relatedKeywords.map((kw) => (
                <Pressable
                  key={kw}
                  style={({ pressed }) => [styles.tag, pressed && { opacity: 0.6 }]}
                  onPress={() => {
                    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.back();
                  }}
                >
                  <Ionicons name="search" size={12} color={Colors.accent} style={{ marginRight: 4 }} />
                  <Text style={styles.tagText}>{kw}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.relatedEmpty}>No related keywords found</Text>
          )}
        </View>
      </Animated.ScrollView>
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
    paddingBottom: 8,
  },
  navRight: {
    flexDirection: "row",
    gap: 8,
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
  scroll: {
    paddingHorizontal: 16,
    gap: 20,
  },
  hero: {
    gap: 6,
    paddingTop: 4,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  keyword: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    letterSpacing: -0.8,
    flexShrink: 1,
  },
  category: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    fontWeight: "300",
    color: Colors.textMuted,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  chartCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
    overflow: "hidden",
  },
  chartMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  chartMetaText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  platformGrid: {
    flexDirection: "row",
    gap: 10,
  },
  platformCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  platformLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  pulseBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#22d3ee",
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
  },
  pulseBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.bg,
    flex: 1,
    textAlign: "center",
  },
  relatedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#22c55e",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.green,
  },
  liveText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#ffffff",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  relatedLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  relatedLoadingText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  relatedEmpty: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    fontStyle: "italic",
  },
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.bgCard,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tagText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  notFound: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  notFoundText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  backBtn: {
    backgroundColor: Colors.bgSurface,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 8,
  },
  backBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.accent,
  },
});
