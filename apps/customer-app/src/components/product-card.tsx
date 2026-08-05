import { Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { ProductDto } from '@hillexpress/shared';
import { AppText, Price, StatusPill, useTheme } from '@hillexpress/ui';
import { QtyStepper } from './qty-stepper';
import { ProductImage } from './product-image';
import { useCartStore, useSetQty } from '../lib/cart';

interface ProductCardProps {
  product: ProductDto;
  categoryName?: string;
  /** Stagger position for the entrance — capped so late rows don't lag. */
  index?: number;
}

export function ProductCard({ product, categoryName = '', index = 0 }: ProductCardProps) {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const router = useRouter();
  const qty = useCartStore((s) => s.lines[product.id]?.qty ?? 0);
  const setQty = useSetQty();
  const out = !product.isAvailable;
  const savings =
    product.mrpPaise && product.mrpPaise > product.pricePaise
      ? Math.round(((product.mrpPaise - product.pricePaise) / product.mrpPaise) * 100)
      : 0;

  return (
    <Animated.View entering={FadeInDown.duration(220).delay(Math.min(index, 8) * 40)} style={{ flex: 1 }}>
      <Pressable
        onPress={() => router.push({ pathname: '/product/[id]', params: { id: product.id } })}
        android_ripple={{ color: `${colors.ink}11` }}
        style={({ pressed }) => ({
          flex: 1,
          backgroundColor: colors.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.line,
          padding: 10,
          gap: 8,
          opacity: out ? 0.55 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          elevation: mode === 'dark' ? 0 : 2,
          shadowColor: '#0A1611',
          shadowOpacity: 0.05,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
        })}
      >
        <View>
          <ProductImage
            name={product.name}
            categoryName={categoryName}
            imageUrl={product.imageUrl}
            blurhash={product.blurhash}
            height={104}
            emojiSize={44}
          />
          {savings > 0 && !out ? (
            <View
              style={{
                position: 'absolute',
                top: 6,
                left: 6,
                backgroundColor: colors.emberBright,
                borderRadius: 6,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}
            >
              <AppText token="micro" style={{ color: '#FFFFFF' }}>
                {savings}% OFF
              </AppText>
            </View>
          ) : null}
        </View>

        {product.lowStock && !out ? (
          <StatusPill label={t('catalog.left', { count: product.availableQty })} tone="warn" />
        ) : null}
        {out ? <StatusPill label={t('catalog.outOfStock')} tone="neutral" /> : null}

        <View style={{ gap: 2, minHeight: 52 }}>
          <AppText token="bodyM" numberOfLines={2} style={{ fontFamily: 'PlusJakartaSans-Medium' }}>
            {product.name}
          </AppText>
          <AppText token="caption" color="ink3">
            {product.packSize}
          </AppText>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <Price amountPaise={product.pricePaise} mrpPaise={product.mrpPaise} />
          {!out ? (
            <QtyStepper
              qty={qty}
              maxQty={product.maxQty}
              stepQty={product.stepQty}
              minQty={product.minQty}
              unit={product.unit}
              onChange={(n) => setQty(product.storeId, product, n)}
            />
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}
