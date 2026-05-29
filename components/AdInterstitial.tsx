import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import Colors from "@/constants/colors";
import { trackEvent } from "@/lib/analytics";

const INTERSTITIAL_ADS = [
  {
    id: "inter-1",
    headline: "TrendPulse Pro",
    body: "Unlock real-time alerts, unlimited watchlist, advanced analytics, and an ad-free experience.",
    cta: "Start Free Trial",
    dismiss: "No thanks",
    url: null as string | null,
    gradient: [Colors.accent, "#0088FF"],
    icon: "diamond-outline" as const,
  },
  {
    id: "inter-2",
    headline: "Stream Music Your Way",
    body: "Discover trending songs before they go viral. 3 months free with Spotify Premium.",
    cta: "Claim Offer",
    dismiss: "Maybe later",
    url: "https://spotify.com/premium",
    gradient: ["#1DB954", "#1AA34A"],
    icon: "musical-notes-outline" as const,
  },
  {
    id: "inter-3",
    headline: "Stay Ahead of Markets",
    body: "Trade trending crypto with zero fees on your first $10K. Join Coinbase today.",
    cta: "Get Started",
    dismiss: "Skip",
    url: "https://coinbase.com",
    gradient: ["#FFD60A", "#FFB800"],
    icon: "trending-up-outline" as const,
  },
];

interface AdInterstitialProps {
  visible: boolean;
  onClose: () => void;
}

export function AdInterstitial({ visible, onClose }: AdInterstitialProps) {
  const [ad] = useState(
    () => INTERSTITIAL_ADS[Math.floor(Math.random() * INTERSTITIAL_ADS.length)]
  );
  const [countdown, setCountdown] = useState(3);
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    setCountdown(3);
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [visible]);

  const handleCta = () => {
    trackEvent("interstitial_click", { ad_id: ad.id });
    if (ad.url) {
      Linking.openURL(ad.url).catch(() => {});
    }
    onClose();
  };

  const handleDismiss = () => {
    trackEvent("interstitial_dismiss", { ad_id: ad.id });
    onClose();
  };

  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View
        style={[styles.overlay, { opacity: opacityAnim }]}
      >
        <Animated.View
          style={[
            styles.card,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          {countdown > 0 ? (
            <View style={styles.countdownWrap}>
              <Text style={styles.countdownText}>{countdown}</Text>
            </View>
          ) : (
            <Pressable onPress={handleDismiss} style={styles.closeBtnWrap} hitSlop={12}>
              <Ionicons name="close" size={20} color={Colors.textMuted} />
            </Pressable>
          )}

          <View style={[styles.iconCircle, { backgroundColor: ad.gradient[0] + "20" }]}>
            <Ionicons name={ad.icon} size={40} color={ad.gradient[0]} />
          </View>

          <Text style={styles.headline}>{ad.headline}</Text>
          <Text style={styles.body}>{ad.body}</Text>

          <Pressable
            onPress={handleCta}
            style={({ pressed }) => [
              styles.ctaBtn,
              { backgroundColor: ad.gradient[0] },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.ctaText}>{ad.cta}</Text>
          </Pressable>

          {countdown === 0 && (
            <Pressable onPress={handleDismiss}>
              <Text style={styles.dismissText}>{ad.dismiss}</Text>
            </Pressable>
          )}

          <Text style={styles.adLabel}>Advertisement</Text>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

let navigationCount = 0;
const SHOW_EVERY_N = 5;

export function shouldShowInterstitial(): boolean {
  navigationCount++;
  if (navigationCount >= SHOW_EVERY_N) {
    navigationCount = 0;
    return true;
  }
  return false;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 24,
    padding: 32,
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    gap: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  countdownWrap: {
    position: "absolute",
    top: 14,
    right: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.bgSurface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  countdownText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
  },
  closeBtnWrap: {
    position: "absolute",
    top: 14,
    right: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.bgSurface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headline: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  ctaBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
    width: "100%",
    alignItems: "center",
    marginTop: 4,
  },
  ctaText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#000",
  },
  dismissText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  adLabel: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 4,
  },
});
