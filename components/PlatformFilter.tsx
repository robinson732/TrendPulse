import React from "react";
import { ScrollView, Pressable, Text, StyleSheet, View, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { XIcon } from "@/components/XIcon";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useTrends, type Platform as TrendPlatform } from "@/contexts/TrendsContext";

const FILTERS: { id: TrendPlatform; label: string; icon: string }[] = [
  { id: "all", label: "All", icon: "globe-outline" },
  { id: "twitter", label: "X", icon: "x-icon" },
  { id: "instagram", label: "Instagram", icon: "logo-instagram" },
  { id: "tiktok", label: "TikTok", icon: "musical-notes" },
  { id: "reddit", label: "Reddit", icon: "logo-reddit" },
  { id: "youtube", label: "YouTube", icon: "logo-youtube" },
];

export function PlatformFilter() {
  const { selectedPlatform, setSelectedPlatform } = useTrends();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {FILTERS.map((f) => {
        const active = selectedPlatform === f.id;
        return (
          <Pressable
            key={f.id}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync();
              setSelectedPlatform(f.id);
            }}
            style={[styles.chip, active && styles.chipActive]}
          >
            {f.icon === "x-icon"
              ? <XIcon size={13} color={active ? Colors.bg : Colors.textSecondary} />
              : <Ionicons name={f.icon as any} size={13} color={active ? Colors.bg : Colors.textSecondary} />
            }
            <Text style={[styles.label, active && styles.labelActive]}>{f.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: "row",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  labelActive: {
    color: Colors.bg,
  },
});
