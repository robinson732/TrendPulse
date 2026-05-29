import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";

interface TrendAlert {
  id: string;
  type: "ACTIVATED" | "BLOCKED" | "BOOSTED" | "PAUSED";
  icon: string;
  title: string;
  brand: string;
  trendKeyword: string;
  calculatedCPM: number;
  marketBenchmark: number;
  ratio: number;
  reason: string;
  color: string;
  timestamp: string;
  read: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  ACTIVATED: "#2ecc71",
  BOOSTED: "#f1c40f",
  PAUSED: "#e67e22",
  BLOCKED: "#e74c3c",
};

const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  ACTIVATED: "rocket",
  BOOSTED: "trending-up",
  PAUSED: "pause-circle",
  BLOCKED: "shield",
};

export default function AlertsScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ alerts: TrendAlert[] }>({
    queryKey: ["/api/ads/alerts"],
    refetchInterval: 10000,
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/ads/alerts/unread"],
    refetchInterval: 10000,
  });

  const markReadMutation = useMutation({
    mutationFn: (alertId: string) =>
      apiRequest("POST", `/api/ads/alerts/${alertId}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ads/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ads/alerts/unread"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/ads/alerts/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ads/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ads/alerts/unread"] });
    },
  });

  const alerts = data?.alerts || [];
  const unreadCount = unreadData?.count || 0;

  const renderAlert = useCallback(({ item }: { item: TrendAlert }) => {
    const color = TYPE_COLORS[item.type] || Colors.textMuted;
    const iconName = TYPE_ICONS[item.type] || "notifications";

    return (
      <Pressable
        onPress={() => {
          if (!item.read) markReadMutation.mutate(item.id);
        }}
        style={({ pressed }) => [
          styles.alertCard,
          !item.read && styles.alertCardUnread,
          pressed && { opacity: 0.85 },
        ]}
      >
        <View style={[styles.alertIconBox, { backgroundColor: `${color}20` }]}>
          <Ionicons name={iconName} size={22} color={color} />
        </View>
        <View style={styles.alertContent}>
          <View style={styles.alertHeader}>
            <View style={[styles.typeBadge, { backgroundColor: `${color}20` }]}>
              <Text style={[styles.typeBadgeText, { color }]}>{item.type}</Text>
            </View>
            {!item.read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.alertBrand}>{item.brand}</Text>
          <Text style={styles.alertTrend}>Tendance : {item.trendKeyword}</Text>
          <View style={styles.alertMetrics}>
            <Text style={styles.metricText}>
              CPM ${item.calculatedCPM}
            </Text>
            <Text style={styles.metricSep}>vs</Text>
            <Text style={styles.metricText}>
              Marché ${item.marketBenchmark}
            </Text>
            {item.ratio > 0 && (
              <Text style={[styles.metricRatio, { color: item.ratio <= 1.2 ? "#2ecc71" : "#e74c3c" }]}>
                {item.ratio}x
              </Text>
            )}
          </View>
          <Text style={styles.alertReason} numberOfLines={2}>{item.reason}</Text>
          <Text style={styles.alertTime}>
            {new Date(item.timestamp).toLocaleTimeString()} — {new Date(item.timestamp).toLocaleDateString()}
          </Text>
        </View>
      </Pressable>
    );
  }, [markReadMutation]);

  return (
    <View style={[styles.container, { paddingTop: isWeb ? insets.top + 67 : 0 }]}>
      <View style={[styles.header, { paddingTop: isWeb ? 0 : insets.top + 8 }]}>
        <View style={styles.headerLeft}>
          <Ionicons name="notifications" size={24} color={Colors.accent} />
          <Text style={styles.headerTitle}>Alertes</Text>
          {unreadCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <Pressable
            onPress={() => markAllReadMutation.mutate()}
            style={({ pressed }) => [styles.markAllBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.markAllText}>Tout lire</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.subtitle}>
        <Text style={styles.subtitleText}>
          TrendPulse AI — Intelligence Publicitaire
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : alerts.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-off-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Aucune alerte</Text>
          <Text style={styles.emptyDesc}>
            Les notifications apparaîtront ici quand l'automate détectera des tendances
          </Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item) => item.id}
          renderItem={renderAlert}
          contentContainerStyle={[styles.list, { paddingBottom: isWeb ? 34 + 84 : 100 }]}
          showsVerticalScrollIndicator={false}
        />
      )}
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  headerBadge: {
    backgroundColor: "#e74c3c",
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  headerBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  markAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  markAllText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.accent,
  },
  subtitle: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  subtitleText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  list: {
    paddingHorizontal: 16,
    gap: 10,
  },
  alertCard: {
    flexDirection: "row",
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  alertCardUnread: {
    borderColor: "rgba(255,107,53,0.3)",
    backgroundColor: "rgba(255,107,53,0.04)",
  },
  alertIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  alertContent: {
    flex: 1,
    gap: 4,
  },
  alertHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  alertBrand: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  alertTrend: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  alertMetrics: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  metricText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  metricSep: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  metricRatio: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  alertReason: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 17,
    marginTop: 2,
  },
  alertTime: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  emptyDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
});
