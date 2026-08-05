import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { Skeleton, useTheme } from '@hillexpress/ui';

/**
 * Rule: if a screen can be empty, it has a skeleton. No spinners ship.
 * The 1400ms shimmer sweep runs on the UI thread — it keeps moving even
 * while JS is busy parsing the response it is waiting for.
 */
function Shimmer({ children }: { children: React.ReactNode }) {
  const progress = useSharedValue(0.5);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [progress]);

  const style = useAnimatedStyle(() => ({ opacity: progress.value }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

export function ProductGridSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Shimmer>
      <View style={{ gap: 12 }}>
        {Array.from({ length: rows }, (_, r) => (
          <View key={r} style={{ flexDirection: 'row', gap: 12 }}>
            {[0, 1].map((c) => (
              <View key={c} style={{ flex: 1, gap: 8 }}>
                <Skeleton height={96} radius={12} />
                <Skeleton height={14} width="85%" />
                <Skeleton height={12} width="50%" />
                <Skeleton height={18} width="40%" />
              </View>
            ))}
          </View>
        ))}
      </View>
    </Shimmer>
  );
}

export function CategoryGridSkeleton() {
  const { colors } = useTheme();
  return (
    <Shimmer>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {Array.from({ length: 6 }, (_, i) => (
          <View
            key={i}
            style={{
              width: '30.5%',
              height: 104,
              borderRadius: 16,
              backgroundColor: colors.surface3,
            }}
          />
        ))}
      </View>
    </Shimmer>
  );
}

export function ListSkeleton({ rows = 3, height = 88 }: { rows?: number; height?: number }) {
  return (
    <Shimmer>
      <View style={{ gap: 10 }}>
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} height={height} radius={16} />
        ))}
      </View>
    </Shimmer>
  );
}
