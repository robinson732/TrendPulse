import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Polyline, Defs, LinearGradient, Stop, Polygon } from "react-native-svg";
import Colors from "@/constants/colors";

interface MiniChartProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showFill?: boolean;
}

export function MiniChart({
  data,
  width = 80,
  height = 36,
  color = Colors.accent,
  showFill = false,
}: MiniChartProps) {
  const points = useMemo(() => {
    if (!data || data.length < 2) return { line: "", fill: "" };
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const stepX = width / (data.length - 1);
    const pts = data.map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    });
    const linePts = pts.join(" ");
    const fillPts = `0,${height} ${linePts} ${width},${height}`;
    return { line: linePts, fill: fillPts };
  }, [data, width, height]);

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.3" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        {showFill && <Polygon points={points.fill} fill="url(#grad)" />}
        <Polyline
          points={points.line}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}
