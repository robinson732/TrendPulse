import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  TextInput,
  TouchableOpacity,
  Animated,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import Toast from "react-native-toast-message";

interface HeartPost {
  id: string;
  label: string;
  emoji: string;
  accent: "cyan" | "magenta";
  username: string;
  content: string;
}

const SEED_HEARTS: HeartPost[] = [
  { id: "h1", label: "LIVE CRYPTO", emoji: "🚀", accent: "cyan", username: "@InsightBot", content: "Bitcoin en hausse de 8% — les tendances X confirment le momentum." },
  { id: "h2", label: "CONCERT PIC", emoji: "📸", accent: "magenta", username: "@TrendHunter", content: "Les photos du concert deviennent virales sur toutes les plateformes." },
  { id: "h3", label: "NEW VIDEO", emoji: "🎥", accent: "cyan", username: "@DataNerd", content: "Nouvelle vidéo d'analyse des tendances — 2M de vues en 3h." },
  { id: "h4", label: "FUNNY GIF", emoji: "🐱", accent: "magenta", username: "@SocialWatcher", content: "Le GIF du chat trending domine Reddit et X simultanément." },
  { id: "h5", label: "POLL: WEB3?", emoji: "🗳️", accent: "cyan", username: "@CryptoAnalyst", content: "72% pensent que le Web3 va transformer les réseaux sociaux." },
  { id: "h6", label: "TECH BLOG", emoji: "🔗", accent: "magenta", username: "@TechGuru", content: "L'article sur l'IA générative explose — 500K partages en 1h." },
];

function FloatingHeartCard({ post, index }: { post: HeartPost; index: number }) {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const beatAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const floatDelay = (index % 3) * 667;
    const beatDelay = post.accent === "magenta" ? 1000 : 0;

    const t1 = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, { toValue: 1, duration: 3000, useNativeDriver: true }),
          Animated.timing(floatAnim, { toValue: 0, duration: 3000, useNativeDriver: true }),
        ])
      ).start();
    }, floatDelay);

    const t2 = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(beatAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(beatAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
          Animated.delay(2400),
        ])
      ).start();
    }, beatDelay);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [floatAnim, beatAnim, index, post.accent]);

  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });
  const rotate = floatAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["-1deg", "1deg", "-1deg"],
  });
  const beatScale = beatAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.04, 1],
  });
  const combinedScale = Animated.multiply(scaleAnim, beatScale);

  const isCyan = post.accent === "cyan";
  const borderColor = isCyan ? "#00f2ff" : "#ff00e5";
  const glowColor = isCyan ? "rgba(0, 242, 255, 0.3)" : "rgba(255, 0, 229, 0.3)";
  const shadowStyle = Platform.OS === "web"
    ? { boxShadow: `0 10px 30px rgba(0,0,0,0.5), 0 0 15px ${glowColor}` }
    : {};
  const organicRadius = isCyan
    ? { borderTopLeftRadius: 40, borderTopRightRadius: 40, borderBottomRightRadius: 60, borderBottomLeftRadius: 5 }
    : { borderTopLeftRadius: 40, borderTopRightRadius: 40, borderBottomRightRadius: 5, borderBottomLeftRadius: 60 };

  return (
    <Animated.View
      style={[
        styles.heartCardWrapper,
        { transform: [{ translateY }, { rotate }, { scale: combinedScale }] },
      ]}
    >
      <Pressable
        onPressIn={() => {
          Animated.spring(scaleAnim, { toValue: 1.05, useNativeDriver: true }).start();
        }}
        onPressOut={() => {
          Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
        }}
        style={[
          styles.heartCard,
          organicRadius,
          {
            borderColor,
            shadowColor: glowColor,
          },
          shadowStyle as any,
        ]}
      >
        <Text style={styles.heartEmoji}>{post.emoji}</Text>
        <Text style={[styles.heartLabel, { color: borderColor }]}>{post.label}</Text>
        <Text style={styles.heartContent} numberOfLines={3}>{post.content}</Text>
        <Text style={[styles.heartUsername, { color: borderColor }]}>{post.username}</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function PulsTalkScreen() {
  const insets = useSafeAreaInsets();
  const { displayName } = useAuth();
  const [posts, setPosts] = useState<HeartPost[]>(SEED_HEARTS);
  const [inputText, setInputText] = useState("");
  const userInitial = (displayName || "Y").charAt(0).toUpperCase();

  const handlePuls = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newPost: HeartPost = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      label: text.length > 15 ? text.slice(0, 15).toUpperCase() + "…" : text.toUpperCase(),
      emoji: "✨",
      accent: Math.random() > 0.5 ? "cyan" : "magenta",
      username: `@${displayName || "You"}`,
      content: text,
    };
    setPosts((prev) => [newPost, ...prev]);
    setInputText("");
    Toast.show({
      type: "success",
      text1: "Pulsé !",
      text2: "Votre bulle flotte dans le Talk.",
      position: "bottom",
      visibilityTime: 2000,
    });
  }, [inputText, displayName]);

  const rows: HeartPost[][] = [];
  for (let i = 0; i < posts.length; i += 2) {
    rows.push(posts.slice(i, i + 2));
  }

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <Text style={styles.logoTalk}>
          Puls <Text style={styles.logoAccent}>Talk</Text>
        </Text>
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarLetter}>{userInitial}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.forumContainer}
        showsVerticalScrollIndicator={false}
      >
        {rows.map((row, rowIdx) => (
          <View key={rowIdx} style={styles.heartRow}>
            {row.map((post, colIdx) => (
              <FloatingHeartCard key={post.id} post={post} index={rowIdx * 2 + colIdx} />
            ))}
            {row.length === 1 && <View style={styles.heartCardWrapper} />}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.postBar, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 10 }]}>
        <View style={styles.mediaIcons}>
          <TouchableOpacity hitSlop={6}><Text style={styles.mediaIcon}>📷</Text></TouchableOpacity>
          <TouchableOpacity hitSlop={6}><Text style={styles.mediaIcon}>🎥</Text></TouchableOpacity>
          <TouchableOpacity hitSlop={6}><Text style={styles.mediaIcon}>📄</Text></TouchableOpacity>
        </View>
        <View style={styles.inputArea}>
          <TextInput
            style={styles.inputField}
            placeholder="Exprimez-vous..."
            placeholderTextColor="#666"
            value={inputText}
            onChangeText={setInputText}
            returnKeyType="send"
            onSubmitEditing={handlePuls}
          />
        </View>
        <TouchableOpacity
          style={[styles.pulsButton, { opacity: inputText.trim().length > 0 ? 1 : 0.6 }]}
          onPress={handlePuls}
          disabled={!inputText.trim()}
          activeOpacity={0.8}
        >
          <Text style={styles.pulsButtonText}>PULS</Text>
        </TouchableOpacity>
      </View>

      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0d0d",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "rgba(18, 18, 18, 0.9)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
    zIndex: 10,
  },
  backBtn: {
    width: 34,
    height: 34,
    justifyContent: "center",
    alignItems: "center",
  },
  backArrow: {
    fontSize: 24,
    color: "#f0f0f0",
  },
  logoTalk: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    fontWeight: "800",
    color: "#f0f0f0",
  },
  logoAccent: {
    color: "#00f2ff",
  },
  userAvatar: {
    width: 35,
    height: 35,
    borderRadius: 18,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#00f2ff",
  },
  userAvatarLetter: {
    color: "#00f2ff",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  forumContainer: {
    padding: 25,
    paddingBottom: 130,
    backgroundColor: "transparent",
  },
  heartRow: {
    flexDirection: "row",
    gap: 25,
    marginBottom: 25,
  },
  heartCardWrapper: {
    flex: 1,
  },
  heartCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 2,
    padding: 25,
    alignItems: "center",
    justifyContent: "flex-start",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 30,
    elevation: 8,
    opacity: 0.9,
    minHeight: 170,
    ...(Platform.OS === "web" ? { backdropFilter: "blur(15px)" } as any : {}),
  },
  heartEmoji: {
    fontSize: 30,
    marginBottom: 8,
  },
  heartLabel: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 10,
    textAlign: "center",
  },
  heartContent: {
    fontSize: 12,
    color: "#f0f0f0",
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 10,
    opacity: 0.8,
  },
  heartUsername: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    opacity: 0.7,
  },
  postBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    minHeight: 80,
    backgroundColor: "#121212",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#00f2ff",
  },
  mediaIcons: {
    flexDirection: "row",
    gap: 8,
  },
  mediaIcon: {
    fontSize: 20,
  },
  inputArea: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(0, 242, 255, 0.3)",
  },
  inputField: {
    color: "#ffffff",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  pulsButton: {
    backgroundColor: "#00f2ff",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    shadowColor: "rgba(0, 242, 255, 0.7)",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 8,
    ...(Platform.OS === "web" ? { boxShadow: "0 0 10px rgba(0, 242, 255, 0.7)" } as any : {}),
  },
  pulsButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    fontWeight: "800",
    letterSpacing: 1,
  },
});
