import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { View } from 'react-native';

import { AGENT } from '@/constants/agentTheme';

interface SparklineProps {
  /** Series to plot, oldest first. Fewer than 2 points renders a flat line. */
  values: number[];
  width: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
}

/**
 * A trend line drawn without `react-native-svg` (not a dependency here).
 *
 * Each segment between two points is a plain View rotated about its own centre,
 * which keeps the maths origin-independent across RN versions. A gradient wash
 * sits behind the line to suggest the filled area from the reference mock.
 */
export function Sparkline({
  values,
  width,
  height = 56,
  color = AGENT.forest,
  strokeWidth = 2.5,
}: SparklineProps) {
  const series = values.length >= 2 ? values : [values[0] ?? 0, values[0] ?? 0];

  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;

  // Inset so the stroke and the end cap never clip at the edges.
  const pad = strokeWidth * 2;
  const plotH = height - pad * 2;

  const points = series.map((v, i) => ({
    x: (i / (series.length - 1)) * width,
    y: pad + (1 - (v - min) / span) * plotH,
  }));

  const last = points[points.length - 1];

  return (
    <View style={{ width, height }}>
      <LinearGradient
        colors={[`${color}1F`, `${color}00`]}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: height * 0.35,
          bottom: 0,
          borderRadius: 8,
        }}
      />

      {points.slice(0, -1).map((p, i) => {
        const next = points[i + 1];
        const dx = next.x - p.x;
        const dy = next.y - p.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: (p.x + next.x) / 2 - length / 2,
              top: (p.y + next.y) / 2 - strokeWidth / 2,
              width: length,
              height: strokeWidth,
              borderRadius: strokeWidth,
              backgroundColor: color,
              transform: [{ rotate: `${angle}rad` }],
            }}
          />
        );
      })}

      {/* Head of the series, so the latest value reads as "now". */}
      <View
        style={{
          position: 'absolute',
          left: last.x - 5,
          top: last.y - 5,
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: AGENT.lime,
          borderWidth: 2,
          borderColor: color,
        }}
      />
    </View>
  );
}
