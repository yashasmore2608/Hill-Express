import { Pressable, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { formatINR, paise } from '@hillexpress/shared';
import { AppText, useTheme } from '@hillexpress/ui';
import { useCartBill, useCartCount } from '../lib/cart';

/** Floating summary bar — slides up the moment the basket has anything in it. */
export function CartBar() {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const count = useCartCount();
  const bill = useCartBill();

  if (count === 0 || !bill) return null;
  const fg = mode === 'dark' ? '#06120D' : '#FFFFFF';

  return (
    <Animated.View
      entering={FadeInUp.duration(220)}
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: insets.bottom + 16,
      }}
    >
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/cart')}
        style={({ pressed }) => ({
          backgroundColor: colors.moss,
          borderRadius: 16,
          minHeight: 58,
          paddingHorizontal: 18,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          transform: [{ scale: pressed ? 0.98 : 1 }],
          elevation: 8,
          shadowColor: '#0A1611',
          shadowOpacity: 0.25,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
        })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              minWidth: 26,
              height: 26,
              borderRadius: 999,
              backgroundColor: `${fg}2E`,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 7,
            }}
          >
            <AppText token="labelM" style={{ color: fg, fontVariant: ['tabular-nums'] }}>
              {count}
            </AppText>
          </View>
          <AppText token="priceM" style={{ color: fg }}>
            {formatINR(paise(bill.itemTotalPaise))}
          </AppText>
        </View>
        <AppText token="labelM" style={{ color: fg }}>
          {t('cart.viewCart')} →
        </AppText>
      </Pressable>
    </Animated.View>
  );
}
