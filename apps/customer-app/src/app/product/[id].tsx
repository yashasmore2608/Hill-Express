import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Card, Price, Screen, StatusPill, useTheme } from '@hillexpress/ui';
import { useCategories, useProduct } from '../../lib/catalog';
import { ProductImage } from '../../components/product-image';
import { QtyStepper } from '../../components/qty-stepper';
import { useCartStore, useSetQty } from '../../lib/cart';
import { ListSkeleton } from '../../components/skeletons';
import { CartBar } from '../../components/cart-bar';

export default function ProductScreen() {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: product, isPending } = useProduct(id);
  const { data: categories } = useCategories(product?.storeId);
  const qty = useCartStore((s) => (product ? (s.lines[product.id]?.qty ?? 0) : 0));
  const setQty = useSetQty();

  const categoryName = product
    ? (categories?.find((c) => c.id === product.categoryId)?.name ?? '')
    : '';
  const savings =
    product?.mrpPaise && product.mrpPaise > product.pricePaise
      ? Math.round(((product.mrpPaise - product.pricePaise) / product.mrpPaise) * 100)
      : 0;

  return (
    <View style={{ flex: 1 }}>
      <Screen onBack={() => router.back()} bottomInset={80}>
        {isPending || !product ? (
          <ListSkeleton rows={3} height={120} />
        ) : (
          <Animated.View entering={FadeInDown.duration(220)} style={{ gap: 16 }}>
            <View>
              <ProductImage
                name={product.name}
                categoryName={categoryName}
                imageUrl={product.imageUrl}
                blurhash={product.blurhash}
                height={260}
                emojiSize={104}
                radius={20}
              />
              {savings > 0 && product.isAvailable ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 14,
                    left: 14,
                    backgroundColor: colors.emberBright,
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                  }}
                >
                  <AppText token="labelM" style={{ color: '#FFFFFF' }}>
                    {savings}% OFF
                  </AppText>
                </View>
              ) : null}
            </View>

            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {categoryName ? <StatusPill label={categoryName} tone="neutral" /> : null}
                {product.lowStock && product.isAvailable ? (
                  <StatusPill label={t('catalog.left', { count: product.availableQty })} tone="warn" />
                ) : null}
                {!product.isAvailable ? (
                  <StatusPill label={t('catalog.outOfStock')} tone="crit" />
                ) : null}
              </View>
              <AppText token="displayL">{product.name}</AppText>
              <AppText token="bodyL" color="ink3">
                {product.packSize}
              </AppText>
            </View>

            <Card
              elevated
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <View style={{ gap: 2 }}>
                <Price amountPaise={product.pricePaise} mrpPaise={product.mrpPaise} size="l" />
                <AppText token="caption" color="ink3">
                  {t('product.inclusive')}
                </AppText>
              </View>
              {product.isAvailable ? (
                <QtyStepper
                  qty={qty}
                  maxQty={product.maxQty}
                  stepQty={product.stepQty}
                  minQty={product.minQty}
                  unit={product.unit}
                  onChange={(n) => setQty(product.storeId, product, n)}
                />
              ) : null}
            </Card>

            <Card style={{ gap: 10 }}>
              {[t('product.benefitFresh'), t('product.benefitCod'), t('product.benefitReturn')].map(
                (line) => (
                  <View key={line} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <AppText token="bodyM" color="moss">
                      ✓
                    </AppText>
                    <AppText token="bodyM" color="ink2" style={{ flex: 1 }}>
                      {line}
                    </AppText>
                  </View>
                ),
              )}
            </Card>
          </Animated.View>
        )}
      </Screen>
      <CartBar />
    </View>
  );
}
