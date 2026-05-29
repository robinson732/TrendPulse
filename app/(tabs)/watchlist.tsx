import React from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  RefreshControl,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useTrends } from "@/contexts/TrendsContext";
import { TrendCard } from "@/components/TrendCard";
import { AdBanner } from "@/components/AdBanner";

export default function WatchlistScreen() {
  const insets = useSafeAreaInsets();
  const { trends, watchlist, refreshTrends, isRefreshing } = useTrends();

  const watched = trends.filter((t) => watchlist.includes(t.id));

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const exploding = watched.filter((t) => t.velocity === "exploding").length;
  const rising = watched.filter((t) => t.velocity === "rising").length;
  const stable = watched.filter((t) => t.velocity === "stable").length;
  const falling = watched.filter((t) => t.velocity === "falling").length;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={require("@/assets/images/logo.png")}
            style={styles.logo}
          />
          <Text style={styles.title}>Watchlist</Text>
        </View>
        <Text style={styles.count}>{watched.length} tracked</Text>
      </View>

      {watched.length > 0 && (
        <View style={styles.statsRow}>
          {exploding > 0 && (
            <View style={[styles.statChip, { backgroundColor: Colors.accentMuted }]}>
              <Ionicons name="flame" size={14} color={Colors.accent} />
              <Text style={[styles.statLabel, { color: Colors.accent }]}>
                {exploding} Exploding
              </Text>
            </View>
          )}
          {rising > 0 && (
            <View style={[styles.statChip, { backgroundColor: Colors.greenMuted }]}>
              <Ionicons name="trending-up" size={14} color={Colors.green} />
              <Text style={[styles.statLabel, { color: Colors.green }]}>
                {rising} Rising
              </Text>
            </View>
          )}
          {stable > 0 && (
            <View style={[styles.statChip, { backgroundColor: Colors.yellow + "15" }]}>
              <Ionicons name="remove-outline" size={14} color={Colors.yellow} />
              <Text style={[styles.statLabel, { color: Colors.yellow }]}>
                {stable} Stable
              </Text>
            </View>
          )}
          {falling > 0 && (
            <View style={[styles.statChip, { backgroundColor: Colors.red + "15" }]}>
              <Ionicons name="trending-down" size={14} color={Colors.red} />
              <Text style={[styles.statLabel, { color: Colors.red }]}>
                {falling} Falling
              </Text>
            </View>
          )}
        </View>
      )}

      <FlatList
        data={watched}
        keyExtractor={(t) => t.id}
        renderItem={({ item, index }) => <TrendCard trend={item} index={index} />}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Platform.OS === "web" ? 160 : insets.bottom + 150 },
        ]}
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
            <Ionicons name="bookmark-outline" size={52} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Nothing saved yet</Text>
            <Text style={styles.emptyText}>
              Tap the bookmark icon on any trend to track it here
            </Text>
          </View>
        }
      />

      <AdBanner placement="bottom" />
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
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
  count: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  list: {
    paddingHorizontal: 16,
  },
  empty: {
    alignItems: "center",
    paddingTop: 100,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
});
