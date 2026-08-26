import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText, useTheme } from '@hillexpress/ui';
import type { OrderItemLineDto } from '@hillexpress/shared';
import { pickLine } from '../lib/pick';

/**
 * The items in an order.
 *
 * Two modes, one component, because they must line up pixel-for-pixel: an
 * operator reads the same list before accepting and while packing, and a list
 * that reflows when it becomes tickable makes them re-find their place.
 *
 * `readOnly` is the default state everywhere except PACKING — a checkbox that
 * does nothing is an invitation to a wrong tap.
 *
 * Ticks are LOCAL. There is no endpoint for per-line pick state (`confirmedQty`
 * exists on OrderItem and nothing writes it), so they survive interruption on
 * this screen and nothing more is claimed.
 */

interface PickListProps {
  items: OrderItemLineDto[];
  readOnly?: boolean;
  onProgress?: (picked: number, total: number) => void;
}

export function PickList({ items, readOnly = false, onProgress }: PickListProps) {
  const { colors } = useTheme();
  const [picked, setPicked] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      onProgress?.(items.filter((i) => next[i.productId]).length, items.length);
      return next;
    });
  };

  return (
    <View style={{ gap: 2 }}>
      {items.map((item) => {
        const line = pickLine(item);
        const done = !readOnly && !!picked[item.productId];

        const row = (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: readOnly ? 5 : 9,
              opacity: done ? 0.4 : 1,
            }}
          >
            {readOnly ? null : (
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  borderWidth: done ? 0 : 2,
                  borderColor: colors.line2,
                  backgroundColor: done ? colors.moss : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {done ? (
                  <View
                    style={{
                      width: 10,
                      height: 5,
                      borderLeftWidth: 2.5,
                      borderBottomWidth: 2.5,
                      borderColor: colors.onMoss,
                      transform: [{ rotate: '-45deg' }, { translateY: -1 }],
                    }}
                  />
                ) : null}
              </View>
            )}

            {/* Quantity in a fixed column so the eye runs straight down it. */}
            <View style={{ width: 78 }}>
              <AppText
                token="priceM"
                style={{ textDecorationLine: done ? 'line-through' : 'none' }}
              >
                {line.amount}
              </AppText>
              {line.qualifier ? (
                <AppText token="caption" color="ink3">
                  {line.qualifier}
                </AppText>
              ) : null}
            </View>

            <AppText token="bodyM" style={{ flex: 1 }} numberOfLines={2}>
              {item.name}
            </AppText>
          </View>
        );

        return readOnly ? (
          <View key={item.productId}>{row}</View>
        ) : (
          <Pressable
            key={item.productId}
            onPress={() => toggle(item.productId)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: done }}
            accessibilityLabel={`${line.spoken} ${item.name}`}
            android_ripple={{ color: `${colors.ink}11` }}
          >
            {row}
          </Pressable>
        );
      })}
    </View>
  );
}
