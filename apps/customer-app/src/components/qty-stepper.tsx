import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { formatQty, isLooseUnit, springs, stepDown, stepUp } from '@hillexpress/shared';
import { AppText, useTheme } from '@hillexpress/ui';

const COLLAPSED = 36;
/** Loose goods show "500 g", which needs more room than "2". */
const EXPANDED_PACKED = 108;
const EXPANDED_LOOSE = 132;

interface QtyStepperProps {
  qty: number;
  maxQty: number;
  /** Increment for this product — 1 for packets, 0.5 for loose kg. */
  stepQty: number;
  minQty: number;
  unit: string;
  onChange: (next: number) => void;
}

/**
 * Signature interaction #02: the + MORPHS into the − n + pill (spring.snap,
 * UI thread) — the control under the finger stays the same object, it never
 * gets swapped for a different view.
 *
 * Quantity is DECIMAL(12,3): loose produce steps in halves and reads as
 * "500 g" rather than "0.5", because that's what a shopper asks for.
 */
export function QtyStepper({ qty, maxQty, stepQty, minQty, unit, onChange }: QtyStepperProps) {
  const { colors, mode } = useTheme();
  const loose = isLooseUnit(unit);
  const expanded = loose ? EXPANDED_LOOSE : EXPANDED_PACKED;
  const width = useSharedValue(qty > 0 ? expanded : COLLAPSED);
  const open = qty > 0;

  useEffect(() => {
    width.value = withSpring(open ? expanded : COLLAPSED, springs.snap);
  }, [open, expanded, width]);

  const animStyle = useAnimatedStyle(() => ({ width: width.value }));

  const bump = (next: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(next);
  };

  const onFg = mode === 'dark' ? '#06120D' : '#FFFFFF';
  const atMax = qty >= maxQty;

  return (
    <Animated.View
      style={[
        {
          height: COLLAPSED,
          borderRadius: 999,
          backgroundColor: colors.moss,
          flexDirection: 'row',
          alignItems: 'center',
          overflow: 'hidden',
        },
        animStyle,
      ]}
    >
      {open ? (
        <>
          <Pressable
            accessibilityLabel="Decrease quantity"
            onPress={() => bump(stepDown(qty, stepQty, minQty))}
            style={{ width: COLLAPSED, height: COLLAPSED, alignItems: 'center', justifyContent: 'center' }}
          >
            <AppText token="titleM" style={{ color: onFg }}>
              −
            </AppText>
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <AppText
              token="labelM"
              numberOfLines={1}
              style={{ color: onFg, fontVariant: ['tabular-nums'] }}
            >
              {formatQty(qty, unit)}
            </AppText>
          </View>
          <Pressable
            accessibilityLabel="Increase quantity"
            disabled={atMax}
            onPress={() => bump(stepUp(qty, stepQty, maxQty))}
            style={{
              width: COLLAPSED,
              height: COLLAPSED,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: atMax ? 0.4 : 1,
            }}
          >
            <AppText token="titleM" style={{ color: onFg }}>
              +
            </AppText>
          </Pressable>
        </>
      ) : (
        <Pressable
          accessibilityLabel="Add to cart"
          disabled={maxQty <= 0}
          onPress={() => bump(Math.min(minQty, maxQty))}
          style={{ width: COLLAPSED, height: COLLAPSED, alignItems: 'center', justifyContent: 'center' }}
        >
          <AppText token="titleM" style={{ color: onFg }}>
            +
          </AppText>
        </Pressable>
      )}
    </Animated.View>
  );
}
