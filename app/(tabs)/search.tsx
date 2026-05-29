import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TextInput,
  FlatList,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useTrends } from "@/contexts/TrendsContext";
import { TrendCard } from "@/components/TrendCard";
import { trackSearch } from "@/lib/analytics";
import { AdBanner } from "@/components/AdBanner";

const HOT_SEARCHES = ["AI", "Sports", "Crypto", "Climate", "Netflix", "K-Pop"];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { searchTrends, trends } = useTrends();
  const [query, setQuery] = useState("");

  const results = query.trim() ? searchTrends(query) : [];
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      trackSearch(query.trim());
    }, 1000);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleHot = useCallback((term: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuery(term);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.headerRow}>
        <Image
          source={require("@/assets/images/logo.png")}
          style={styles.logo}
        />
        <Text style={styles.title}>Search Trends</Text>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={Colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search keywords, topics..."
          placeholderTextColor={Colors.textMuted}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          selectionColor={Colors.accent}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery("")} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </Pressable>
        )}
      </View>

      {!query.trim() ? (
        <View>
          <Text style={styles.sectionLabel}>Trending Searches</Text>
          <View style={styles.hotChips}>
            {HOT_SEARCHES.map((term) => (
              <Pressable
                key={term}
                onPress={() => handleHot(term)}
                style={styles.hotChip}
              >
                <Ionicons name="flame-outline" size={12} color={Colors.accent} />
                <Text style={styles.hotLabel}>{term}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Top Movers</Text>
          <FlatList
            data={[...trends]
              .sort((a, b) => Math.abs(b.volumeChange) - Math.abs(a.volumeChange))
              .slice(0, 5)}
            keyExtractor={(t) => t.id}
            renderItem={({ item, index }) => (
              <TrendCard trend={item} index={index} compact />
            )}
            scrollEnabled={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(t) => t.id}
          renderItem={({ item, index }) => <TrendCard trend={item} index={index} />}
          contentContainerStyle={[
            styles.results,
            { paddingBottom: Platform.OS === "web" ? 160 : insets.bottom + 150 },
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={44} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No results found</Text>
              <Text style={styles.emptyText}>Try a different keyword or topic</Text>
            </View>
          }
        />
      )}

      <AdBanner placement="bottom" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    letterSpacing: -0.5,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.bgSurface,
    borderRadius: 14,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
    marginBottom: 20,
  },
  searchIcon: {},
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  hotChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 24,
  },
  hotChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.accentMuted,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: Colors.accent + "30",
  },
  hotLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.accent,
  },
  results: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  empty: {
    alignItems: "center",
    paddingTop: 80,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
});
