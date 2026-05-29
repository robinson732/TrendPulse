import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Animated,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

export type SortOption = "volume" | "change" | "rank";
export type VelocityFilter = "all" | "exploding" | "rising" | "stable" | "falling";

interface DropdownMenuProps {
  sortBy: SortOption;
  onSortChange: (s: SortOption) => void;
  velocityFilter: VelocityFilter;
  onVelocityChange: (v: VelocityFilter) => void;
}

const SORT_OPTIONS: { id: SortOption; label: string; icon: string }[] = [
  { id: "volume", label: "Volume", icon: "stats-chart-outline" },
  { id: "change", label: "24h Change", icon: "swap-vertical-outline" },
  { id: "rank", label: "Rank", icon: "podium-outline" },
];

const VELOCITY_OPTIONS: { id: VelocityFilter; label: string; icon: string; color: string }[] = [
  { id: "all", label: "All", icon: "apps-outline", color: Colors.textSecondary },
  { id: "exploding", label: "Exploding", icon: "flame-outline", color: Colors.accent },
  { id: "rising", label: "Rising", icon: "trending-up-outline", color: Colors.green },
  { id: "stable", label: "Stable", icon: "remove-outline", color: Colors.yellow },
  { id: "falling", label: "Falling", icon: "trending-down-outline", color: Colors.red },
];

export function DropdownMenu({
  sortBy,
  onSortChange,
  velocityFilter,
  onVelocityChange,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  const openMenu = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOpen(true);
    Animated.parallel([
      Animated.spring(fadeAnim, { toValue: 1, tension: 120, friction: 10, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 120, friction: 10, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  const closeMenu = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.92, duration: 150, useNativeDriver: true }),
    ]).start(() => setOpen(false));
  }, [fadeAnim, scaleAnim]);

  const handleSort = useCallback((id: SortOption) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    onSortChange(id);
    closeMenu();
  }, [onSortChange, closeMenu]);

  const handleVelocity = useCallback((id: VelocityFilter) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    onVelocityChange(id);
    closeMenu();
  }, [onVelocityChange, closeMenu]);

  const currentSort = SORT_OPTIONS.find((s) => s.id === sortBy)!;
  const currentVelocity = VELOCITY_OPTIONS.find((v) => v.id === velocityFilter)!;

  return (
    <View>
      <Pressable
        onPress={open ? closeMenu : openMenu}
        style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
        hitSlop={6}
      >
        <Ionicons name="options-outline" size={18} color={Colors.textSecondary} />
        <Text style={styles.triggerLabel}>
          {currentSort.label}
          {velocityFilter !== "all" ? ` · ${currentVelocity.label}` : ""}
        </Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={13}
          color={Colors.textMuted}
        />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="none"
        onRequestClose={closeMenu}
        statusBarTranslucent
      >
        <Pressable style={styles.backdrop} onPress={closeMenu}>
          <Animated.View
            style={[
              styles.menu,
              { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
            ]}
          >
            <Pressable onPress={() => {}} style={{ width: "100%" }}>
              <Text style={styles.menuSection}>Sort By</Text>
              {SORT_OPTIONS.map((opt) => {
                const active = sortBy === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => handleSort(opt.id)}
                    style={({ pressed }) => [
                      styles.menuItem,
                      active && styles.menuItemActive,
                      pressed && styles.menuItemPressed,
                    ]}
                  >
                    <Ionicons
                      name={opt.icon as any}
                      size={16}
                      color={active ? Colors.accent : Colors.textSecondary}
                    />
                    <Text style={[styles.menuItemLabel, active && styles.menuItemLabelActive]}>
                      {opt.label}
                    </Text>
                    {active && (
                      <Ionicons name="checkmark" size={15} color={Colors.accent} style={styles.check} />
                    )}
                  </Pressable>
                );
              })}

              <View style={styles.divider} />

              <Text style={styles.menuSection}>Velocity</Text>
              {VELOCITY_OPTIONS.map((opt) => {
                const active = velocityFilter === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => handleVelocity(opt.id)}
                    style={({ pressed }) => [
                      styles.menuItem,
                      active && styles.menuItemActive,
                      pressed && styles.menuItemPressed,
                    ]}
                  >
                    <Ionicons
                      name={opt.icon as any}
                      size={16}
                      color={active ? opt.color : Colors.textSecondary}
                    />
                    <Text style={[styles.menuItemLabel, active && { color: opt.color }]}>
                      {opt.label}
                    </Text>
                    {active && (
                      <Ionicons name="checkmark" size={15} color={opt.color} style={styles.check} />
                    )}
                  </Pressable>
                );
              })}
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.bgSurface,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  triggerPressed: {
    opacity: 0.7,
  },
  triggerLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    maxWidth: 140,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-start",
    paddingTop: Platform.OS === "web" ? 120 : 120,
    paddingLeft: 16,
  },
  menu: {
    backgroundColor: Colors.bgElevated,
    borderRadius: 18,
    paddingVertical: 8,
    width: 230,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  menuSection: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  menuItemActive: {
    backgroundColor: Colors.accentMuted,
  },
  menuItemPressed: {
    opacity: 0.7,
  },
  menuItemLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  menuItemLabelActive: {
    color: Colors.accent,
    fontFamily: "Inter_600SemiBold",
  },
  check: {
    marginLeft: "auto",
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 12,
    marginVertical: 6,
  },
});
