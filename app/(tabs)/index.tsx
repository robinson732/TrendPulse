import React, { useRef, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  RefreshControl,
  Animated,
  Pressable,
  Platform,
  Alert,
  Modal,
  TouchableOpacity,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useTrends, type Trend } from "@/contexts/TrendsContext";
import { TrendCard } from "@/components/TrendCard";
import { PlatformFilter } from "@/components/PlatformFilter";
import { DropdownMenu, type SortOption, type VelocityFilter } from "@/components/DropdownMenu";
import { AdBanner } from "@/components/AdBanner";
import { AdInterstitial, shouldShowInterstitial } from "@/components/AdInterstitial";
import { useLanguage, LANGUAGES } from "@/contexts/LanguageContext";


function PulseLogo({ style }: { style?: object }) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const beat = Animated.loop(
      Animated.sequence([
        // First beat
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.18, duration: 110, useNativeDriver: true }),
          Animated.timing(glow, { toValue: 1, duration: 110, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 0.95, duration: 110, useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0, duration: 110, useNativeDriver: true }),
        ]),
        // Second beat (slightly weaker)
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.1, duration: 100, useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0.6, duration: 100, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 130, useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0, duration: 130, useNativeDriver: true }),
        ]),
        // Rest between beats
        Animated.delay(750),
      ])
    );
    beat.start();
    return () => beat.stop();
  }, [scale, glow]);

  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] });

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Animated.View
        style={{
          position: "absolute",
          top: -6,
          bottom: -6,
          left: -6,
          right: -6,
          borderRadius: 18,
          backgroundColor: Colors.accent,
          opacity: glowOpacity,
        }}
      />
      <Image source={require("@/assets/images/logo.png")} style={styles.logo} />
    </Animated.View>
  );
}

function LiveIndicator() {
  const pulse = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  return (
    <View style={livStyles.row}>
      <Animated.View style={[livStyles.dot, { opacity: pulse }]} />
      <Text style={livStyles.label}>LIVE</Text>
    </View>
  );
}

const livStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.green,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.green,
    letterSpacing: 1.5,
  },
});

function applySortAndFilter(
  trends: Trend[],
  sortBy: SortOption,
  velocityFilter: VelocityFilter
): Trend[] {
  let result = velocityFilter === "all"
    ? trends
    : trends.filter((t) => t.velocity === velocityFilter);

  return [...result].sort((a, b) => {
    if (sortBy === "volume") return b.volume - a.volume;
    if (sortBy === "change") return b.volumeChange - a.volumeChange;
    return a.rank - b.rank;
  });
}

interface DeepLinkConfig {
  deepLink: (query: string) => string;
  webFallback: (query: string) => string;
}

const PLATFORM_DEEP_LINKS: Record<string, DeepLinkConfig> = {
  twitter: {
    deepLink: (q) => `twitter://search?query=${encodeURIComponent(q)}`,
    webFallback: (q) => `https://x.com/search?q=${encodeURIComponent(q)}`,
  },
  instagram: {
    deepLink: (q) => `instagram://tag?name=${encodeURIComponent(q.replace(/^#/, ""))}`,
    webFallback: (q) => `https://www.instagram.com/explore/tags/${encodeURIComponent(q.replace(/^#/, ""))}/`,
  },
  tiktok: {
    deepLink: (q) => `tiktok://search?keyword=${encodeURIComponent(q)}`,
    webFallback: (q) => `https://www.tiktok.com/search?q=${encodeURIComponent(q)}`,
  },
  reddit: {
    deepLink: (q) => `reddit://search?q=${encodeURIComponent(q)}`,
    webFallback: (q) => `https://www.reddit.com/search/?q=${encodeURIComponent(q)}`,
  },
  youtube: {
    deepLink: (q) => `youtube://search?query=${encodeURIComponent(q)}`,
    webFallback: (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
  },
  spotify: {
    deepLink: (q) => `spotify://search?q=${encodeURIComponent(q)}`,
    webFallback: (q) => `https://open.spotify.com/search/${encodeURIComponent(q)}`,
  },
  "youtube music": {
    deepLink: (q) => `youtube://search?query=${encodeURIComponent(q)}`,
    webFallback: (q) => `https://music.youtube.com/search?q=${encodeURIComponent(q)}`,
  },
  "apple music": {
    deepLink: (q) => `music://music.apple.com/search?term=${encodeURIComponent(q)}`,
    webFallback: (q) => `https://music.apple.com/search?term=${encodeURIComponent(q)}`,
  },
  deezer: {
    deepLink: (q) => `deezer://search?q=${encodeURIComponent(q)}`,
    webFallback: (q) => `https://www.deezer.com/search/${encodeURIComponent(q)}`,
  },
  soundcloud: {
    deepLink: (q) => `soundcloud://search?q=${encodeURIComponent(q)}`,
    webFallback: (q) => `https://soundcloud.com/search?q=${encodeURIComponent(q)}`,
  },
};

export default function TrendingScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { filteredTrends, refreshTrends, isRefreshing, lastUpdated, isLoading, isError, errorMessage } = useTrends();
  const [sortBy, setSortBy] = useState<SortOption>("volume");
  const [velocityFilter, setVelocityFilter] = useState<VelocityFilter>("all");
  const [showInterstitial, setShowInterstitial] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [topicMenuOpen, setTopicMenuOpen] = useState(false);
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const [langModalOpen, setLangModalOpen] = useState(false);
  const { t, language, setLanguage, currentFlag } = useLanguage();
  const pendingNav = useRef<{ type: "trend" | "pulse"; id: string } | null>(null);

  const TOPICS = ["News", "Tech", "Music", "Entertainment", "Sports", "Fashion", "Health", "Finance", "Politics", "Science"];

  const TOPIC_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
    "News": "newspaper-outline",
    "Tech": "hardware-chip-outline",
    "Music": "musical-notes-outline",
    "Entertainment": "film-outline",
    "Sports": "football-outline",
    "Fashion": "shirt-outline",
    "Health": "heart-outline",
    "Finance": "cash-outline",
    "Politics": "megaphone-outline",
    "Science": "flask-outline",
  };

  const TOPIC_ALIASES: Record<string, string[]> = {
    "Tech": ["technology", "tech", "a.i", "ai"],
    "News": ["news", "trending"],
    "Finance": ["finance", "business"],
    "Science": ["science", "environment"],
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const timeStr = lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const handlePulse = useCallback((trend: Trend) => {
    if (shouldShowInterstitial()) {
      pendingNav.current = { type: "pulse", id: trend.id };
      setShowInterstitial(true);
    } else {
      router.push({ pathname: "/pulse/[id]", params: { id: trend.id } });
    }
  }, []);

  const handleInterstitialClose = useCallback(() => {
    setShowInterstitial(false);
    if (pendingNav.current) {
      const { type, id } = pendingNav.current;
      pendingNav.current = null;
      if (type === "pulse") {
        router.push({ pathname: "/pulse/[id]", params: { id } });
      }
    }
  }, []);

  const selectPlatform = useCallback(async (platform: string, keyword?: string) => {
    const config = PLATFORM_DEEP_LINKS[platform.toLowerCase()];
    if (!config) return;
    const query = keyword || platform;
    const deepLink = config.deepLink(query);
    const webUrl = config.webFallback(query);

    Linking.openURL(deepLink).catch(() => {
      Alert.alert("App not installed", "Opening web fallback...");
      Linking.openURL(webUrl).catch(() => {});
    });
  }, []);

  const displayedTrends = useMemo(() => {
    let base = filteredTrends;
    if (topicFilter) {
      const filterLower = topicFilter.toLowerCase();
      const aliases = TOPIC_ALIASES[topicFilter] || [filterLower];
      base = base.filter((t) => {
        const cat = t.category?.toLowerCase() || "";
        const kw = t.keyword?.toLowerCase() || "";
        return aliases.some((alias) => cat.includes(alias) || cat === filterLower) ||
               kw.includes(filterLower);
      });
    }
    return applySortAndFilter(base, sortBy, velocityFilter);
  }, [filteredTrends, sortBy, velocityFilter, topicFilter]);

  const menuItems: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; extra?: string }[] = [
    { icon: "search-outline", label: t("search"), onPress: () => { setMenuOpen(false); router.push("/(tabs)/search"); } },
    { icon: "bookmark-outline", label: t("watchlist"), onPress: () => { setMenuOpen(false); router.push("/(tabs)/watchlist"); } },
    { icon: "chatbubbles-outline", label: t("myInteractions"), onPress: () => { setMenuOpen(false); router.push("/interactions"); } },
    { icon: "language-outline", label: t("language"), extra: currentFlag, onPress: () => { setMenuOpen(false); setTimeout(() => setLangModalOpen(true), 300); } },
    { icon: "share-social-outline", label: t("shareApp"), onPress: async () => {
      setMenuOpen(false);
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      try {
        await Share.share(
          Platform.OS === "ios"
            ? { message: "Check out TrendPulse — real-time social trends tracker!", url: "https://trendpulse.app" }
            : { message: "Check out TrendPulse — real-time social trends tracker!\nhttps://trendpulse.app" }
        );
      } catch {}
    }},
    { icon: "information-circle-outline", label: t("aboutTrendPulse"), onPress: () => {
      setMenuOpen(false);
      Alert.alert("TrendPulse", "Real-time social media trends tracker.\nVersion 1.0.0\n\nPowered by Trends24 & X API");
    }},
  ];

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setMenuOpen(true);
          }}
          style={({ pressed }) => [styles.headerLeft, pressed && { opacity: 0.7 }]}
        >
          <PulseLogo />
          <Ionicons name="chevron-down" size={14} color={Colors.textMuted} style={{ marginLeft: -4 }} />
          <Text style={styles.subtitle}>Updated {timeStr}</Text>
        </Pressable>
        <LiveIndicator />
      </View>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
          <View style={[styles.menuContainer, { top: topPad + 58 }]}>
            {menuItems.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={styles.menuItem}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <Ionicons name={item.icon} size={20} color={Colors.accent} />
                <Text style={styles.menuItemText}>{item.label}</Text>
                {item.extra && <Text style={styles.menuItemExtra}>{item.extra}</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={langModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLangModalOpen(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setLangModalOpen(false)}>
          <View style={styles.langModal}>
            <Text style={styles.langTitle}>{t("selectLanguage")}</Text>
            {LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[styles.langItem, language === lang.code && styles.langItemActive]}
                onPress={() => {
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setLanguage(lang.code);
                  setLangModalOpen(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.langFlag}>{lang.flag}</Text>
                <Text style={[styles.langLabel, language === lang.code && styles.langLabelActive]}>{lang.label}</Text>
                {language === lang.code && <Ionicons name="checkmark-circle" size={18} color={Colors.accent} />}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      <View style={styles.filterRow}>
        <DropdownMenu
          sortBy={sortBy}
          onSortChange={setSortBy}
          velocityFilter={velocityFilter}
          onVelocityChange={setVelocityFilter}
        />
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setTopicMenuOpen(true);
          }}
          style={({ pressed }) => [
            styles.planetBtn,
            topicFilter && styles.planetBtnActive,
            pressed && { transform: [{ scale: 1.06 }], shadowOpacity: 0.9 },
          ]}
        >
          <Ionicons name="planet" size={16} color="#00ffcc" />
          {topicFilter
            ? <Text style={styles.planetBtnLabel} numberOfLines={1}>{topicFilter}</Text>
            : <Text style={styles.planetBtnLabel}>Topics</Text>
          }
          <View style={styles.planetScanlines} pointerEvents="none" />
        </Pressable>
      </View>

      <Modal visible={topicMenuOpen} transparent animationType="fade" onRequestClose={() => setTopicMenuOpen(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setTopicMenuOpen(false)}>
          <View style={[styles.topicMenu, { top: topPad + 110 }]}>
            <View style={styles.topicMenuHeader}>
              <Ionicons name="planet" size={16} color={Colors.accent} />
              <Text style={styles.topicMenuTitle}>Topics</Text>
              {topicFilter && (
                <Pressable onPress={() => { setTopicFilter(null); setTopicMenuOpen(false); }} style={styles.clearTopicBtn}>
                  <Text style={styles.clearTopicText}>Clear</Text>
                </Pressable>
              )}
            </View>
            {TOPICS.map((topic) => (
              <TouchableOpacity
                key={topic}
                style={[styles.topicItem, topicFilter === topic && styles.topicItemActive]}
                onPress={() => {
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setTopicFilter(topicFilter === topic ? null : topic);
                  setTopicMenuOpen(false);
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={TOPIC_ICONS[topic]}
                  size={16}
                  color={topicFilter === topic ? Colors.accent : Colors.textMuted}
                />
                <Text style={[styles.topicItemText, topicFilter === topic && styles.topicItemTextActive]}>
                  {topic}
                </Text>
                {topicFilter === topic && <Ionicons name="checkmark" size={14} color={Colors.accent} />}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      <FlatList
        data={displayedTrends}
        keyExtractor={(t) => t.id}
        renderItem={({ item, index }) => (
          <>
            <TrendCard
              trend={item}
              index={index}
              onPulse={handlePulse}
              onSelectPlatform={selectPlatform}
            />
            {index > 0 && (index + 1) % 4 === 0 && <AdBanner placement="inline" />}
          </>
        )}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Platform.OS === "web" ? 160 : insets.bottom + 150 },
        ]}
        ListHeaderComponent={<PlatformFilter />}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshTrends}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons
              name={isError ? "cloud-offline-outline" : isLoading ? "hourglass-outline" : "bar-chart-outline"}
              size={48}
              color={isError ? Colors.red : Colors.textMuted}
            />
            <Text style={styles.emptyText}>
              {isError
                ? "Could not load trends. Pull to retry."
                : isLoading
                ? "Loading trends..."
                : "No trends match these filters"}
            </Text>
            {!isError && !isLoading && velocityFilter !== "all" && (
              <Pressable
                onPress={() => setVelocityFilter("all")}
                style={styles.clearBtn}
              >
                <Ionicons name="close-circle-outline" size={16} color={Colors.accent} />
                <Text style={styles.clearBtnText}>Clear Filters</Text>
              </Pressable>
            )}
          </View>
        }
      />

      <AdBanner placement="bottom" />
      <AdInterstitial visible={showInterstitial} onClose={handleInterstitialClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logo: {
    width: 46,
    height: 46,
    borderRadius: 12,
  },
  title: {
    fontSize: 28,
    fontFamily: "Orbitron-Bold",
    color: Colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Rajdhani-Medium",
    color: Colors.textMuted,
  },
  filterRow: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  planetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: "#1a1a1a",
    backgroundColor: "#111",
    overflow: "hidden",
    shadowColor: "#00ffcc",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 6,
  },
  planetBtnActive: {
    shadowOpacity: 0.9,
    shadowRadius: 16,
    borderColor: "#222",
  },
  planetBtnLabel: {
    fontSize: 13,
    fontFamily: "Rajdhani-Medium",
    color: "#00ffcc",
    textShadowColor: "#00ffcc",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
    letterSpacing: 0.5,
  },
  planetScanlines: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.07,
    backgroundColor: "transparent",
    borderTopWidth: 1,
    borderTopColor: "#fff",
  },
  topicMenu: {
    position: "absolute",
    right: 16,
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 6,
    minWidth: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  topicMenuHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  topicMenuTitle: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Orbitron-Bold",
    color: Colors.text,
  },
  clearTopicBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: Colors.accentMuted,
  },
  clearTopicText: {
    fontSize: 11,
    fontFamily: "Rajdhani-Medium",
    color: Colors.accent,
  },
  topicItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  topicItemActive: {
    backgroundColor: Colors.accentMuted,
  },
  topicItemText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Rajdhani-Medium",
    color: Colors.textSecondary,
  },
  topicItemTextActive: {
    color: Colors.accent,
    fontFamily: "Inter_600SemiBold",
  },
  list: {
    paddingHorizontal: 16,
  },
  empty: {
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.bgSurface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.accent + "40",
    marginTop: 4,
  },
  clearBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.accent,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  menuContainer: {
    position: "absolute",
    left: 16,
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 6,
    minWidth: 220,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  menuItemText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
    flex: 1,
  },
  menuItemExtra: {
    fontSize: 18,
    marginLeft: "auto" as any,
  },
  langModal: {
    backgroundColor: Colors.bgSurface,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 40,
    marginTop: "30%",
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  langTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 16,
    textAlign: "center",
  },
  langItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  langItemActive: {
    backgroundColor: "rgba(0, 229, 255, 0.08)",
  },
  langFlag: {
    fontSize: 22,
  },
  langLabel: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
    flex: 1,
  },
  langLabelActive: {
    color: Colors.accent,
    fontFamily: "Inter_700Bold",
  },
});
