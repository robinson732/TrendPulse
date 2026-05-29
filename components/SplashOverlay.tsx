import React, { useEffect, useRef } from "react";
import { View, Text, Animated, StyleSheet, Image, Platform } from "react-native";
import Colors from "@/constants/colors";

interface SplashOverlayProps {
  onFinish: () => void;
  duration?: number;
}

export function SplashOverlay({ onFinish, duration = 3000 }: SplashOverlayProps) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 40,
      useNativeDriver: true,
    }).start();

    Animated.timing(logoOpacity, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }, 600);

    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => onFinish());
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Animated.View style={[styles.logoWrap, { opacity: logoOpacity, transform: [{ scale: scaleAnim }] }]}>
        <Image source={require("@/assets/images/icon.png")} style={styles.logo} />
        <Text style={styles.title}>TrendPulse</Text>
      </Animated.View>

      <Animated.View style={[styles.subtitleWrap, { opacity: subtitleOpacity }]}>
        <Text style={styles.subtitle}>Real-time social trends</Text>
        <View style={styles.pulseBar}>
          <View style={styles.pulseBarFill} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#0a0a14",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
    ...(Platform.OS === "web" ? { paddingTop: 67, paddingBottom: 34 } : {}),
  },
  logoWrap: {
    alignItems: "center",
    gap: 14,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 20,
  },
  title: {
    fontSize: 28,
    fontFamily: "Orbitron-Bold",
    color: Colors.accent,
    letterSpacing: 2,
  },
  subtitleWrap: {
    alignItems: "center",
    marginTop: 20,
    gap: 12,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    fontFamily: "Inter_400Regular",
  },
  pulseBar: {
    width: 120,
    height: 3,
    backgroundColor: "rgba(0,255,157,0.15)",
    borderRadius: 2,
    overflow: "hidden",
  },
  pulseBarFill: {
    width: "40%",
    height: "100%",
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
});
