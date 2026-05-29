import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Platform,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

interface InteractionItem {
  id: string;
  type: "liked" | "reposted";
}

export default function InteractionsScreen() {
  const { likedPosts, repostedPosts } = useLocalSearchParams<{
    id: string;
    likedPosts: string;
    repostedPosts: string;
  }>();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const liked: Record<string, boolean> = likedPosts ? JSON.parse(likedPosts) : {};
  const reposted: Record<string, boolean> = repostedPosts ? JSON.parse(repostedPosts) : {};

  const interactions: InteractionItem[] = [
    ...Object.keys(liked)
      .filter((k) => liked[k])
      .map((id) => ({ id, type: "liked" as const })),
    ...Object.keys(reposted)
      .filter((k) => reposted[k])
      .map((id) => ({ id, type: "reposted" as const })),
  ];

  const handleBack = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.navBar}>
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.6 }]}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.navTitleText}>My Interactions</Text>
        <View style={{ width: 40 }} />
      </View>

      {interactions.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbubbles-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyText}>Tes reposts, replies & mentions</Text>
          <Text style={styles.emptySubtext}>ici bientôt !</Text>
        </View>
      ) : (
        <FlatList
          data={interactions}
          keyExtractor={(item, i) => `${item.type}-${item.id}-${i}`}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: Platform.OS === "web" ? 40 : insets.bottom + 20 },
          ]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.iconWrap}>
                <Ionicons
                  name={item.type === "liked" ? "heart" : "repeat"}
                  size={20}
                  color={item.type === "liked" ? Colors.red : Colors.green}
                />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardType}>
                  {item.type === "liked" ? "Liked" : "Reposted"}
                </Text>
                <Text style={styles.cardId} numberOfLines={1}>
                  Post #{item.id.slice(-6)}
                </Text>
              </View>
            </View>
          )}
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
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  navTitleText: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  list: {
    padding: 16,
    gap: 10,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: {
    flex: 1,
  },
  cardType: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  cardId: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 2,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textDim,
  },
  emptySubtext: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
});
