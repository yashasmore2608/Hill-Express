import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { formatINR, formatQty, lineTotalPaise, paise } from '@hillexpress/shared';
import { AppText, Button, Card, Price, Screen, StatusPill, useTheme } from '@hillexpress/ui';
import { useAuth } from '../lib/auth';
import { useAddresses, useCategories, useDefaultStore } from '../lib/catalog';
import { useCartBill, useCartStore, useSetQty } from '../lib/cart';
import { usePlaceOrder } from '../lib/orders';
import { ApiError } from '../lib/api';
import { QtyStepper } from '../components/qty-stepper';
import { ProductImage } from '../components/product-image';

function BillRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <AppText token={strong ? 'titleM' : 'bodyM'} color={strong ? 'ink' : 'ink2'}>
        {label}
      </AppText>
      <AppText token={strong ? 'priceL' : 'priceM'}>{value}</AppText>
    </View>
  );
}

export default function CartScreen() {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const router = useRouter();
  const { status } = useAuth();
  const store = useDefaultStore();
  const lines = useCartStore((s) => s.lines);
  const bill = useCartBill();
  const setQty = useSetQty();
  const { data: categories } = useCategories(store?.id);
  const { data: addresses } = useAddresses();
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const placeOrder = usePlaceOrder();

  if (status === 'signedOut') return <Redirect href="/(auth)/sign-in" />;

  const items = Object.values(lines);
  const catName = (categoryId: string) =>
    categories?.find((c) => c.id === categoryId)?.name ?? '';
  const chosen = addresses?.find((a) => a.id === (selectedAddress ?? addresses?.[0]?.id)) ?? null;
  const canPlace =
    items.length > 0 && chosen !== null && chosen.serviceable && store !== undefined && !placeOrder.isPending;

  const submitOrder = () => {
    if (!canPlace || !store || !chosen) return;
    placeOrder.mutate(
      {
        storeId: store.id,
        addressId: chosen.id,
        items: items.map((l) => ({ productId: l.product.id, qty: l.qty })),
      },
      {
        onSuccess: (order) => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.replace({ pathname: '/orders/[id]', params: { id: order.id } });
        },
        onError: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
      },
    );
  };

  const progressPct =
    bill && store?.freeDeliveryAbovePaise
      ? Math.min(100, (bill.itemTotalPaise / store.freeDeliveryAbovePaise) * 100)
      : 0;

  return (
    <Screen title={t('cart.title')} onBack={() => router.back()}>
      {items.length === 0 ? (
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 72 }}>
          <AppText token="displayL" style={{ fontSize: 64, lineHeight: 78 }}>
            🧺
          </AppText>
          <AppText token="titleL">{t('cart.empty')}</AppText>
          <AppText token="bodyM" color="ink2" style={{ textAlign: 'center' }}>
            {t('cart.emptyHint')}
          </AppText>
          <View style={{ alignSelf: 'stretch', marginTop: 8 }}>
            <Button label={t('cart.browse')} onPress={() => router.replace('/')} />
          </View>
        </View>
      ) : (
        <>
          {/* ── Lines ── */}
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {items.map(({ product, qty }, i) => (
              <Animated.View
                key={product.id}
                entering={FadeInDown.duration(200).delay(Math.min(i, 6) * 35)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 14,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.line,
                }}
              >
                <ProductImage
                  name={product.name}
                  categoryName={catName(product.categoryId)}
                  imageUrl={product.imageUrl}
                  blurhash={product.blurhash}
                  height={56}
                  emojiSize={26}
                  style={{ width: 56 }}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText token="bodyM" numberOfLines={1} style={{ fontFamily: 'PlusJakartaSans-Medium' }}>
                    {product.name}
                  </AppText>
                  <AppText token="caption" color="ink3">
                    {formatQty(qty, product.unit)} · {product.packSize}
                  </AppText>
                  <Price amountPaise={lineTotalPaise(product.pricePaise, qty)} />
                </View>
                <QtyStepper
                  qty={qty}
                  maxQty={product.maxQty}
                  stepQty={product.stepQty}
                  minQty={product.minQty}
                  unit={product.unit}
                  onChange={(n) => setQty(product.storeId, product, n)}
                />
              </Animated.View>
            ))}
          </Card>

          {/* ── Free delivery progress ── */}
          {bill && bill.freeDeliveryRemainingPaise !== null && store?.freeDeliveryAbovePaise ? (
            <View style={{ gap: 8 }}>
              <AppText
                token="caption"
                color={bill.freeDeliveryRemainingPaise === 0 ? 'ok' : 'ember'}
              >
                {bill.freeDeliveryRemainingPaise === 0
                  ? `🎉  ${t('cart.freeDeliveryDone')}`
                  : t('cart.freeDeliveryNudge', {
                      amount: formatINR(paise(bill.freeDeliveryRemainingPaise)),
                    })}
              </AppText>
              <View
                style={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: colors.surface3,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor:
                      bill.freeDeliveryRemainingPaise === 0 ? colors.ok : colors.emberBright,
                    width: `${progressPct}%`,
                  }}
                />
              </View>
            </View>
          ) : null}

          {/* ── Deliver to ── */}
          <View style={{ gap: 10 }}>
            <AppText token="titleM">{t('cart.deliverTo')}</AppText>
            {(addresses ?? []).map((a) => {
              const active = chosen?.id === a.id;
              return (
                <Pressable
                  key={a.id}
                  onPress={() => setSelectedAddress(a.id)}
                  style={({ pressed }) => ({
                    backgroundColor: active ? colors.mossSoft : colors.surface,
                    borderWidth: active ? 2 : 1,
                    borderColor: active ? colors.moss : colors.line,
                    borderRadius: 14,
                    padding: 14,
                    gap: 4,
                    transform: [{ scale: pressed ? 0.99 : 1 }],
                  })}
                >
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <AppText token="labelM">{active ? '◉' : '○'}</AppText>
                    <AppText token="labelM" style={{ flex: 1 }}>
                      {a.label}
                    </AppText>
                    {!a.serviceable ? (
                      <StatusPill label={t('address.notServiceable')} tone="crit" />
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('address.edit')}
                      hitSlop={10}
                      onPress={() =>
                        router.push({ pathname: '/address/[id]', params: { id: a.id } })
                      }
                    >
                      <AppText token="labelM" color="moss">
                        {t('address.edit')}
                      </AppText>
                    </Pressable>
                  </View>
                  <AppText token="caption" color="ink2" numberOfLines={2} style={{ paddingLeft: 22 }}>
                    {a.house}, {a.street}, {a.city} {a.pincode}
                  </AppText>
                </Pressable>
              );
            })}
            <Button
              label={`＋  ${t('cart.addAddress')}`}
              variant="secondary"
              onPress={() => router.push('/address/new')}
            />
          </View>

          {/* ── Bill ── */}
          {bill ? (
            <Card elevated style={{ gap: 12 }}>
              <AppText token="micro" color="moss">
                {t('cart.billTitle')}
              </AppText>
              <BillRow label={t('cart.itemTotal')} value={formatINR(paise(bill.itemTotalPaise))} />
              <BillRow
                label={t('cart.deliveryFee')}
                value={
                  bill.deliveryFeePaise === 0 ? t('cart.free') : formatINR(paise(bill.deliveryFeePaise))
                }
              />
              <View style={{ height: 1, backgroundColor: colors.line }} />
              <BillRow label={t('cart.total')} value={formatINR(paise(bill.totalPaise))} strong />
              <StatusPill label={t('cart.cod')} tone="accent" />
            </Card>
          ) : null}

          {placeOrder.isError ? (
            <AppText token="caption" color="critical">
              {placeOrder.error instanceof ApiError ? placeOrder.error.message : t('common.retry')}
            </AppText>
          ) : null}
          {!chosen || !chosen.serviceable ? (
            <AppText token="caption" color="ink3">
              {t('cart.needAddress')}
            </AppText>
          ) : null}

          <Button
            label={placeOrder.isPending ? t('cart.placing') : t('cart.placeOrder')}
            disabled={!canPlace}
            onPress={submitOrder}
          />
        </>
      )}
    </Screen>
  );
}
