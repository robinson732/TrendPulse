import React, { useCallback, useMemo, useRef, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, Alert, Animated, Image, Share, TouchableOpacity, ActivityIndicator } from "react-native";
import { Video, ResizeMode } from "expo-av";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { XIcon } from "@/components/XIcon";
import * as Haptics from "expo-haptics";
import * as SMS from "expo-sms";
import Colors from "@/constants/colors";
import { MiniChart } from "@/components/MiniChart";
import { VelocityBadge } from "@/components/VelocityBadge";
import { useTrends, type Trend } from "@/contexts/TrendsContext";
import { useAuth } from "@/contexts/AuthContext";
import { getSponsoredForTrend, handleSponsoredClick } from "@/lib/sponsored";
import { trackTrendInteraction } from "@/lib/analytics";
import Toast from "react-native-toast-message";

const PLATFORM_ICONS: Record<string, { icon: string; color: string }> = {
  twitter: { icon: "x-icon", color: "#FFFFFF" },
  instagram: { icon: "logo-instagram", color: "#E1306C" },
  tiktok: { icon: "musical-notes", color: "#ff0050" },
  reddit: { icon: "logo-reddit", color: "#FF4500" },
  youtube: { icon: "logo-youtube", color: "#FF0000" },
};

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

interface TrendCardProps {
  trend: Trend;
  index: number;
  compact?: boolean;
  onPulse?: (trend: Trend) => void;
  onSelectPlatform?: (platform: string, keyword?: string) => void;
}

export function TrendCard({ trend, index, compact = false, onPulse, onSelectPlatform }: TrendCardProps) {
  const { isWatched, addToWatchlist, removeFromWatchlist } = useTrends();
  const { } = useAuth();
  const watched = isWatched(trend.id);
  const [liked, setLiked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const likeScale = useRef(new Animated.Value(1)).current;
  const sponsored = useMemo(
    () => getSponsoredForTrend(trend.keyword, trend.category),
    [trend.keyword, trend.category]
  );

  const isExploding = trend.velocity === "exploding";
  const videoUrl = trend.ad_video_url || sponsored?.videoUrl || "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
  const sponsorName = trend.sponsor || sponsored?.brand || null;

  const sponsoredFade = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const videoRef = useRef<any>(null);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, { toValue: 1.18, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (videoRef.current && videoUrl) {
      const playVideo = async () => {
        try {
          await videoRef.current?.setIsMutedAsync(true);
          await videoRef.current?.playAsync();
        } catch {}
      };
      playVideo();
    }
  }, [videoUrl]);

  useEffect(() => {
    if (sponsored && !compact) {
      Animated.timing(sponsoredFade, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();
    }
  }, [sponsored, compact]);

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

  const handlePress = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    trackTrendInteraction(trend.id, "click", { keyword: trend.keyword });
    router.push({ pathname: "/pulse/[id]", params: { id: trend.id } });
  }, [trend.id, trend.keyword]);

  const handleLike = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLiked((prev) => !prev);
    trackTrendInteraction(trend.id, liked ? "unlike" : "like", { keyword: trend.keyword });
    Animated.sequence([
      Animated.timing(likeScale, { toValue: 1.4, duration: 120, useNativeDriver: true }),
      Animated.timing(likeScale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  }, [trend.id, trend.keyword, liked, likeScale]);

  const handleWatch = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (watched) {
      removeFromWatchlist(trend.id);
      Toast.show({ type: "info", text1: "Retiré de la watchlist", text2: trend.keyword, visibilityTime: 2000 });
    } else {
      addToWatchlist(trend.id);
      Toast.show({ type: "success", text1: "Ajouté à la watchlist", text2: trend.keyword, visibilityTime: 2000 });
    }
  }, [watched, trend.id, trend.keyword, addToWatchlist, removeFromWatchlist]);

  const handleShare = useCallback(async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const cPrefix = trend.volumeChange >= 0 ? "+" : "";
    const link = `https://trendpulse.app/trend/${encodeURIComponent(trend.keyword)}`;
    const text =
      `🔥 ${trend.keyword} is ${trend.velocity} on TrendPulse!\n` +
      `📊 Volume: ${formatVolume(trend.volume)} (${cPrefix}${trend.volumeChange}%)\n\n` +
      `${link}`;

    if (Platform.OS === "web") {
      try {
        await navigator.clipboard.writeText(text);
        Toast.show({ type: "success", text1: "Copié", text2: "Lien copié dans le presse-papier", visibilityTime: 2000 });
      } catch {
        Toast.show({ type: "error", text1: "Erreur", text2: "Impossible de copier", visibilityTime: 2000 });
      }
      return;
    }

    try {
      await Share.share(
        Platform.OS === "ios"
          ? { message: text, url: link }
          : { message: text }
      );
    } catch {
      // user cancelled
    }
  }, [trend]);

  const handleBrand = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: "/brand/[id]", params: { id: trend.id } });
  }, [trend.id]);

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.card, !compact && styles.cardFlex, pressed && styles.cardPressed]}
    >
      <View style={styles.header}>
        <Text style={styles.rank}>{index + 1}</Text>
        <Text style={styles.keyword} numberOfLines={1} ellipsizeMode="tail">
          {trend.keyword}
        </Text>
        <VelocityBadge velocity={trend.velocity} />
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.category}>{trend.category}</Text>
        <View style={styles.dot} />
        <Text style={styles.region}>{trend.region}</Text>
        <View style={styles.platforms}>
          {trend.platform.slice(0, 4).map((p) => {
            const pi = PLATFORM_ICONS[p];
            if (!pi) return null;
            const icon = pi.icon === "x-icon"
              ? <XIcon size={14} color={pi.color} />
              : <Ionicons name={pi.icon as any} size={14} color={pi.color} />;
            return onSelectPlatform ? (
              <Pressable key={p} onPress={() => onSelectPlatform(p, trend.keyword)} hitSlop={4}>
                {icon}
              </Pressable>
            ) : (
              <View key={p}>{icon}</View>
            );
          })}
        </View>
      </View>

      {!compact && (
        <View style={styles.statsRow}>
          <View style={styles.statsLeft}>
            <Text style={styles.volume}>{formatVolume(trend.volume)}</Text>
            <Text style={[styles.change, { color: changeColor }]}>
              {changePrefix}{trend.volumeChange}% <Text style={styles.changeLabel}>24h</Text>
            </Text>
          </View>
          <MiniChart data={trend.volumeHistory} color={chartColor} showFill />
        </View>
      )}

      {!compact && isExploding && (
        <View style={styles.videoWrapper}>
          {Platform.OS === "web" ? (
            <video
              src={videoUrl}
              style={{ width: "100%", height: "100%", objectFit: "cover" } as any}
              autoPlay
              loop
              muted
              playsInline
            />
          ) : (
            <Video
              ref={videoRef}
              source={{ uri: videoUrl }}
              style={styles.videoPlayer}
              resizeMode={ResizeMode.COVER}
              shouldPlay={true}
              isLooping={true}
              isMuted={true}
              useNativeControls={false}
            />
          )}
          <View style={styles.sponsorOverlay}>
            <Text style={styles.sponsoredByText}>Sponsored by {sponsorName || "NordVPN"}</Text>
            <TouchableOpacity activeOpacity={0.8}>
              <Text style={styles.watchNowText}>Watch now</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!compact && !isExploding && sponsored && (
        <Animated.View style={[styles.sponsoredWrap, { opacity: sponsoredFade }]}>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              handleSponsoredClick(sponsored.brand, sponsored.url, trend.id, trend.keyword);
            }}
            style={({ pressed }) => [styles.sponsoredCompact, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.sponsoredText} numberOfLines={1}>Sponsored by {sponsored.brand}</Text>
            <Text style={styles.sponsoredLink} numberOfLines={1}>{sponsored.label}</Text>
          </Pressable>
        </Animated.View>
      )}

      {!compact && (
        <View style={styles.iconBar}>
          <TouchableOpacity
            onPress={(e: any) => { e.stopPropagation?.(); router.push({ pathname: "/trend/[id]", params: { id: trend.id } }); }}
            activeOpacity={0.8}
          >
            <Animated.View style={[styles.iconRippleButton, styles.neonGlow, { transform: [{ scale: pulseScale }] }]}>
              <Image source={require("@/assets/images/logo.png")} style={styles.logoIcon} resizeMode="contain" />
            </Animated.View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={(e: any) => { e.stopPropagation?.(); handleBrand(); }}
            style={styles.iconRippleButton}
            activeOpacity={0.7}
          >
            <Ionicons name="stats-chart-outline" size={20} color="#FACC15" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={(e: any) => { e.stopPropagation?.(); handleShare(); }}
            style={styles.iconRippleButton}
            activeOpacity={0.7}
          >
            <Ionicons name="share-social-outline" size={20} color="#60A5FA" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={(e: any) => { e.stopPropagation?.(); handleWatch(); }}
            style={styles.iconRippleButton}
            activeOpacity={0.7}
          >
            <Ionicons name={watched ? "bookmark" : "bookmark-outline"} size={20} color={watched ? "#A78BFA" : "#A78BFA"} />
          </TouchableOpacity>
        </View>
      )}

      {!isExploding && isLoading && (
        <View style={{ position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center" as any, alignItems: "center" as any, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 10 }}>
          <ActivityIndicator size="large" color="#00ff9d" />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#0F172A",
    borderRadius: 24,
    padding: 20,
    marginVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: "#1E293B",
    gap: 9,
  },
  cardFlex: {
    display: "flex" as any,
  },
  cardPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.985 }],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  rank: {
    fontSize: 18,
    fontFamily: "Orbitron-Bold",
    color: Colors.textMuted,
    minWidth: 22,
  },
  keyword: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Orbitron-Bold",
    color: Colors.text,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 31,
  },
  category: {
    fontSize: 12,
    fontFamily: "Rajdhani-Medium",
    color: Colors.textSecondary,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textMuted,
  },
  region: {
    fontSize: 12,
    fontFamily: "Rajdhani-Medium",
    color: Colors.textMuted,
  },
  platforms: {
    flexDirection: "row",
    gap: 6,
    marginLeft: 5,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingLeft: 31,
    marginTop: 2,
  },
  statsLeft: {
    gap: 2,
  },
  volume: {
    fontSize: 20,
    fontFamily: "Orbitron-Bold",
    color: Colors.text,
    letterSpacing: -0.5,
  },
  change: {
    fontSize: 13,
    fontFamily: "Rajdhani-Medium",
  },
  changeLabel: {
    color: Colors.textMuted,
    fontFamily: "Rajdhani-Medium",
  },
  sponsoredWrap: {
    alignItems: "center",
    marginTop: -6,
    width: "80%" as any,
    alignSelf: "center" as any,
  },
  videoWrapper: {
    height: 180,
    borderRadius: 16,
    overflow: "hidden" as any,
    marginTop: 12,
    backgroundColor: "#000",
  },
  videoPlayer: {
    flex: 1,
  },
  sponsorOverlay: {
    position: "absolute" as any,
    bottom: 0,
    width: "100%" as any,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: 8,
    alignItems: "center" as any,
  },
  sponsoredByText: {
    color: "#94A3B8",
    fontSize: 11,
  },
  watchNowText: {
    color: "#38BDF8",
    fontWeight: "bold" as const,
    fontSize: 13,
    marginTop: 2,
  },
  sponsoredCompact: {
    backgroundColor: "rgba(0,255,157,0.03)",
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: "rgba(0,255,157,0.1)",
    width: "100%" as any,
    alignItems: "center",
  },
  sponsoredText: {
    color: "rgba(255,255,255,0.4)",
    fontFamily: "Inter_500Medium",
    fontSize: 7,
  },
  sponsoredLink: {
    color: Colors.accent,
    fontFamily: "Inter_500Medium",
    fontSize: 7,
    marginTop: 1,
    opacity: 0.7,
  },
  iconBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
  },
  iconRippleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1E293B",
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  neonGlow: {
    shadowColor: "rgba(0, 191, 255, 0.9)",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 15,
    elevation: 25,
    borderWidth: 2,
    borderColor: "rgba(191, 0, 255, 0.7)",
    backgroundColor: "#0A1222",
  },
  logoIcon: {
    width: 34,
    height: 34,
  },
});
