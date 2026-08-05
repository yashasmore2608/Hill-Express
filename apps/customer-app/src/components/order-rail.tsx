import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { AppText, useTheme } from '@hillexpress/ui';
import type { OrderTimelineDto } from '@hillexpress/shared';

/**
 * Signature interaction #05 — the tracking rail. Exactly ONE dot pulses,
 * and it is the only ember on the screen: because the accent is rationed
 * everywhere else, the eye lands on the live stage with no arrow needed.
 */

const FLOW = ['PLACED', 'ACCEPTED', 'PACKING', 'READY_FOR_PICKUP', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'];

function PulseDot() {
  const { colors } = useTheme();
  const scale = useSharedValue(0.55);
  const opacity = useSharedValue(0.9);

  useEffect(() => {
    scale.value = withRepeat(withTiming(1.35, { duration: 1700, easing: Easing.out(Easing.quad) }), -1);
    opacity.value = withRepeat(withTiming(0, { duration: 1700, easing: Easing.out(Easing.quad) }), -1);
  }, [scale, opacity]);

  const ring = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={{ width: 13, height: 13, marginTop: 5 }}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            inset: -6,
            borderRadius: 999,
            borderWidth: 2,
            borderColor: colors.emberBright,
          },
          ring,
        ]}
      />
      <View style={{ width: 13, height: 13, borderRadius: 999, backgroundColor: colors.emberBright }} />
    </View>
  );
}

interface OrderRailProps {
  currentStatus: string;
  timeline: OrderTimelineDto[];
  labels: Record<string, string>;
  notes?: Record<string, string>;
}

export function OrderRail({ currentStatus, timeline, labels, notes }: OrderRailProps) {
  const { colors } = useTheme();

  const terminal = currentStatus === 'REJECTED' || currentStatus === 'CANCELLED';
  const stages = terminal ? [...FLOW.slice(0, 1), currentStatus] : FLOW;
  const currentIdx = stages.indexOf(currentStatus);
  const timeFor = (status: string) =>
    timeline.find((t) => t.toStatus === status)?.at ?? null;

  return (
    <View>
      {stages.map((status, i) => {
        const done = i < currentIdx || (i === currentIdx && (currentStatus === 'DELIVERED' || terminal));
        const now = i === currentIdx && !done;
        const at = timeFor(status);
        const isLast = i === stages.length - 1;
        const failed = terminal && status === currentStatus;
        return (
          <View key={status} style={{ flexDirection: 'row', gap: 13 }}>
            <View style={{ width: 26, alignItems: 'center' }}>
              {now ? (
                <PulseDot />
              ) : (
                <View
                  style={{
                    width: 13,
                    height: 13,
                    borderRadius: 999,
                    marginTop: 5,
                    backgroundColor: failed ? colors.critical : done ? colors.moss : colors.line2,
                  }}
                />
              )}
              {!isLast ? (
                <View
                  style={{
                    width: 2,
                    flex: 1,
                    minHeight: 22,
                    backgroundColor: done ? colors.moss : colors.line2,
                  }}
                />
              ) : null}
            </View>
            <View style={{ paddingBottom: 16, gap: 2, flex: 1 }}>
              <AppText token="bodyM" style={{ fontFamily: 'PlusJakartaSans-SemiBold' }} color={done || now ? 'ink' : 'ink3'}>
                {labels[status] ?? status}
              </AppText>
              {at ? (
                <AppText token="caption" color="ink3">
                  {new Date(at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                </AppText>
              ) : null}
              {notes?.[status] ? (
                <AppText token="caption" color="ink2">
                  {notes[status]}
                </AppText>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
