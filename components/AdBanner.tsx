import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import Colors from "@/constants/colors";
import { trackEvent } from "@/lib/analytics";

export const BannerAdSize = {
  BANNER: "BANNER",
  FULL_BANNER: "FULL_BANNER",
  LARGE_BANNER: "LARGE_BANNER",
  MEDIUM_RECTANGLE: "MEDIUM_RECTANGLE",
  LEADERBOARD: "LEADERBOARD",
} as const;

export const TestIds = {
  BANNER: "ca-app-pub-3940256099942544/6300978111",
} as const;

const BANNER_ADS = [
  {
    id: "ad-1",
    headline: "Upgrade to TrendPulse Pro",
    body: "Real-time alerts · Unlimited watchlist · No ads",
    cta: "Try Free",
    url: null as string | null,
    icon: "rocket-outline" as const,
    color: Colors.accent,
  },
  {
    id: "ad-2",
    headline: "NordVPN — Stay Private Online",
    body: "68% off + 3 months free",
    cta: "Get Deal",
    url: "https://nordvpn.com",
    icon: "shield-checkmark-outline" as const,
    color: "#5AE8A4",
  },
  {
    id: "ad-3",
    headline: "Trade Crypto on Coinbase",
    body: "Join 110M+ users worldwide",
    cta: "Sign Up",
    url: "https://coinbase.com",
    icon: "logo-bitcoin" as const,
    color: "#FFD60A",
  },
  {
    id: "ad-4",
    headline: "Learn to Code — Codecademy",
    body: "Build real projects, get certified",
    cta: "Start Free",
    url: "https://codecademy.com",
    icon: "code-slash-outline" as const,
    color: "#6C63FF",
  },
];

const SIZE_HEIGHTS: Record<string, number> = {
  BANNER: 50,
  FULL_BANNER: 60,
  LARGE_BANNER: 100,
  MEDIUM_RECTANGLE: 250,
  LEADERBOARD: 90,
};

interface BannerAdProps {
  unitId: string;
  size: string;
  requestOptions?: {
    requestNonPersonalizedAdsOnly?: boolean;
  };
}

/**
 * Simulated BannerAd matching the react-native-google-mobile-ads API.
 *
 * To switch to real AdMob, replace:
 *   import { BannerAd, BannerAdSize, TestIds } from '@/components/AdBanner';
 * with:
 *   import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
 */
export function BannerAd({ unitId, size, requestOptions }: BannerAdProps) {
  const [adIndex] = useState(Math.floor(Math.random() * BANNER_ADS.length));
  const [dismissed, setDismissed] = useState(false);
  const height = SIZE_HEIGHTS[size] || 60;
  const ad = BANNER_ADS[adIndex];

  if (dismissed) return null;

  const handlePress = () => {
    trackEvent("ad_click", { ad_id: ad.id, unit_id: unitId });
    if (ad.url) {
      Linking.openURL(ad.url).catch(() => {});
    }
  };

  const handleDismiss = () => {
    trackEvent("ad_dismiss", { ad_id: ad.id });
    setDismissed(true);
  };

  return (
    <View style={[styles.bannerWrap, { height }]}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.bannerInner,
          { height },
          pressed && { opacity: 0.85 },
        ]}
      >
        <View style={[styles.adIconWrap, { backgroundColor: ad.color + "20" }]}>
          <Ionicons name={ad.icon} size={18} color={ad.color} />
        </View>
        <View style={styles.adContent}>
          <Text style={styles.adHeadline} numberOfLines={1}>{ad.headline}</Text>
          <Text style={styles.adBody} numberOfLines={1}>{ad.body}</Text>
        </View>
        <View style={[styles.ctaBtn, { backgroundColor: ad.color }]}>
          <Text style={styles.ctaText}>{ad.cta}</Text>
        </View>
        <Pressable onPress={handleDismiss} hitSlop={8} style={styles.closeBtn}>
          <Ionicons name="close" size={14} color={Colors.textMuted} />
        </Pressable>
      </Pressable>
      <Text style={styles.adLabel}>Ad</Text>
    </View>
  );
}

interface AdBannerProps {
  placement?: "bottom" | "inline";
}

export function AdBanner({ placement = "bottom" }: AdBannerProps) {
  const [adIndex, setAdIndex] = useState(
    Math.floor(Math.random() * BANNER_ADS.length)
  );
  const [dismissed, setDismissed] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (placement !== "inline") return;
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setAdIndex((i) => (i + 1) % BANNER_ADS.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }, 15000);
    return () => clearInterval(interval);
  }, [placement]);

  if (dismissed) return null;

  const ad = BANNER_ADS[adIndex];

  const handlePress = () => {
    trackEvent("ad_click", { ad_id: ad.id, headline: ad.headline });
    if (ad.url) {
      Linking.openURL(ad.url).catch(() => {});
    }
  };

  const handleDismiss = () => {
    trackEvent("ad_dismiss", { ad_id: ad.id });
    setDismissed(true);
  };

  if (placement === "bottom") {
    return (
      <View style={styles.bottomContainer}>
        <BannerAd
          unitId={TestIds.BANNER}
          size={BannerAdSize.FULL_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        />
      </View>
    );
  }

  return (
    <Animated.View style={[styles.inlineContainer, { opacity: fadeAnim }]}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.inlineBanner,
          pressed && { opacity: 0.85 },
        ]}
      >
        <View style={styles.inlineTop}>
          <View style={styles.inlineLabelRow}>
            <Text style={styles.inlineLabel}>Sponsored</Text>
            <Pressable onPress={handleDismiss} hitSlop={8}>
              <Ionicons name="close-circle-outline" size={16} color={Colors.textMuted} />
            </Pressable>
          </View>
          <Text style={styles.inlineHeadline}>{ad.headline}</Text>
          <Text style={styles.inlineBody}>{ad.body}</Text>
        </View>
        <View style={[styles.inlineCta, { backgroundColor: ad.color }]}>
          <Text style={styles.inlineCtaText}>{ad.cta}</Text>
          <Ionicons name="arrow-forward" size={14} color="#000" />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bannerWrap: {
    alignItems: "center",
    width: "100%",
  },
  bannerInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1F2E",
    borderRadius: 14,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 32,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
    width: "100%",
  },
  bottomContainer: {
    position: "absolute",
    bottom: Platform.OS === "web" ? 84 : 90,
    left: 12,
    right: 12,
    alignItems: "center",
  },
  adIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  adContent: {
    flex: 1,
    gap: 1,
  },
  adHeadline: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  adBody: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  ctaBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  ctaText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#000",
  },
  closeBtn: {
    position: "absolute",
    top: 4,
    right: 6,
    padding: 4,
  },
  adLabel: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 2,
  },
  inlineContainer: {
    marginVertical: 6,
  },
  inlineBanner: {
    backgroundColor: "#1A1F2E",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  inlineTop: {
    padding: 14,
    gap: 4,
  },
  inlineLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  inlineLabel: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  inlineHeadline: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  inlineBody: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  inlineCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  inlineCtaText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#000",
  },
});
