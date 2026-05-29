import React, { useRef, useEffect } from "react";
import { View, Text, StyleSheet, Animated, Image } from "react-native";
import type { Trend } from "@/contexts/TrendsContext";

const LOGO = require("@/assets/images/logo.png");

const BADGE_STYLES: Record<string, { backgroundColor: string; shadowColor: string; textColor: string }> = {
  exploding: { backgroundColor: "#A855F7", shadowColor: "#A855F7", textColor: "#fff" },
  rising: { backgroundColor: "#8B5CF6", shadowColor: "#60A5FA", textColor: "#000" },
  falling: { backgroundColor: "#7C3AED", shadowColor: "#C084FC", textColor: "#fff" },
  stable: { backgroundColor: "rgba(139, 92, 246, 0.25)", shadowColor: "#8B5CF6", textColor: "#fff" },
};

const LABELS: Record<string, string> = {
  exploding: "Exploding",
  rising: "Rising",
  falling: "Falling",
  stable: "Stable",
};

export function Badge({ badge }: { badge: string }) {
  const velocity = badge.toLowerCase() as Trend["velocity"];
  return <VelocityBadge velocity={velocity} />;
}

export function VelocityBadge({ velocity }: { velocity: Trend["velocity"] }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    pulseAnim.setValue(1);
    scaleAnim.setValue(1);
    opacityAnim.setValue(1);
    translateYAnim.setValue(0);

    if (velocity === "exploding") {
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.1, duration: 300, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(scaleAnim, { toValue: 1.06, duration: 400, useNativeDriver: true }),
            Animated.timing(scaleAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          ]),
        ])
      ).start();
    } else if (velocity === "rising") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(translateYAnim, { toValue: -6, duration: 800, useNativeDriver: true }),
          Animated.timing(translateYAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else if (velocity === "falling") {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(translateYAnim, { toValue: 6, duration: 900, useNativeDriver: true }),
            Animated.timing(opacityAnim, { toValue: 0.7, duration: 900, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(translateYAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
            Animated.timing(opacityAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
          ]),
        ])
      ).start();
    } else if (velocity === "stable") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.04, duration: 1200, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [velocity]);

  const badgeStyle = BADGE_STYLES[velocity] || { backgroundColor: "#444", shadowColor: "#fff", textColor: "#000" };
  const label = LABELS[velocity] || velocity;

  const usesScale = velocity === "exploding" || velocity === "stable";
  const usesTranslate = velocity === "rising" || velocity === "falling";

  return (
    <Animated.View
      style={[
        styles.badge,
        {
          backgroundColor: badgeStyle.backgroundColor,
          shadowColor: badgeStyle.shadowColor,
          transform: [
            { scale: usesScale ? scaleAnim : pulseAnim },
            { translateY: usesTranslate ? translateYAnim : 0 },
          ],
          opacity: velocity === "falling" ? opacityAnim : 1,
          shadowOpacity: 0.6,
          shadowRadius: 8,
        },
      ]}
    >
      <Image source={LOGO} style={styles.logo} />
      <Text style={[styles.badgeText, { color: badgeStyle.textColor }]}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  logo: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  badgeText: {
    fontFamily: "Rajdhani-Medium",
    fontWeight: "bold" as const,
    fontSize: 11,
    marginLeft: 4,
    letterSpacing: 0.3,
  },
});
