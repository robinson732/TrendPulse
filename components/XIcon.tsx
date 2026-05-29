import React from "react";
import { Text, StyleSheet } from "react-native";

interface XIconProps {
  size?: number;
  color?: string;
}

export function XIcon({ size = 16, color = "#fff" }: XIconProps) {
  return (
    <Text
      style={[
        styles.icon,
        {
          fontSize: size * 0.85,
          lineHeight: size,
          width: size,
          height: size,
          color,
        },
      ]}
    >
      𝕏
    </Text>
  );
}

const styles = StyleSheet.create({
  icon: {
    fontWeight: "900" as const,
    textAlign: "center",
  },
});
