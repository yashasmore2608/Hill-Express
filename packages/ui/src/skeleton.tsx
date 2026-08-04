import { View, type ViewStyle } from 'react-native';
import { useTheme } from './theme-context';

interface SkeletonProps {
  width?: ViewStyle['width'];
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

/**
 * Rule: if a screen can be empty, it has a skeleton. No spinners ship.
 * A skeleton occupies the exact final layout, so nothing shifts when data lands.
 *
 * M0: static block. The 1400ms shimmer sweep (Reanimated, UI-thread) lands
 * with the first list screen in M2 — same component, same call sites.
 */
export function Skeleton({ width = '100%', height = 16, radius = 5, style }: SkeletonProps) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.surface3 }, style]}
    />
  );
}
