import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { formatINR, formatQty, paise } from '@hillexpress/shared';
import { AppText, Button, Card, Price, Screen, StatusPill, useTheme } from '@hillexpress/ui';
import { useAuth } from '../../lib/auth';
import { useCancelOrder, useOpenInvoice, useOrder } from '../../lib/orders';
import { OrderRail } from '../../components/order-rail';
import { ListSkeleton } from '../../components/skeletons';
import { Redirect } from 'expo-router';

export default function OrderDetail() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { status } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: order, isPending } = useOrder(id);
  const cancel = useCancelOrder();
  const invoice = useOpenInvoice();

  if (status === 'signedOut') return <Redirect href="/(auth)/sign-in" />;

  const labels: Record<string, string> = {
    PLACED: t('orders.s.placed'),
    ACCEPTED: t('orders.s.accepted'),
    PACKING: t('orders.s.packing'),
    READY_FOR_PICKUP: t('orders.s.ready'),
    PICKED_UP: t('orders.s.pickedUp'),
    OUT_FOR_DELIVERY: t('orders.s.outForDelivery'),
    DELIVERED: t('orders.s.delivered'),
    REJECTED: t('orders.s.rejected'),
    CANCELLED: t('orders.s.cancelled'),
  };

  return (
    <Screen
      title={order?.orderNumber ?? ''}
      subtitle={
        order && order.etaLowMinutes != null && order.fulfillmentStatus !== 'DELIVERED'
          ? t('orders.eta', { low: order.etaLowMinutes, high: order.etaHighMinutes })
          : undefined
      }
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    >
      {isPending || !order ? (
        <ListSkeleton rows={3} height={120} />
      ) : (
        <Animated.View entering={FadeInDown.duration(220)} style={{ gap: 16 }}>
          {/* ── Delivery OTP — the customer's proof, ember because it matters now ── */}
          {order.deliveryOtp ? (
            <Card
              elevated
              style={{
                backgroundColor: colors.emberSoft,
                borderColor: colors.emberBright,
                alignItems: 'center',
                gap: 6,
              }}
            >
              <AppText token="micro" color="ember">
                {t('orders.otpTitle')}
              </AppText>
              <AppText
                token="displayL"
                color="ember"
                style={{ fontSize: 40, lineHeight: 48, letterSpacing: 10 }}
              >
                {order.deliveryOtp}
              </AppText>
              <AppText token="caption" color="ink2" style={{ textAlign: 'center' }}>
                {t('orders.otpHint')}
              </AppText>
            </Card>
          ) : null}

          {/* ── Rail ── */}
          <Card style={{ paddingVertical: 20 }}>
            <OrderRail
              currentStatus={order.fulfillmentStatus}
              timeline={order.timeline}
              labels={labels}
            />
          </Card>

          {/* ── Items + bill ── */}
          <Card style={{ gap: 10 }}>
            <AppText token="micro" color="moss">
              {t('orders.itemsTitle', { count: order.items.length })}
            </AppText>
            {order.items.map((i) => (
              <View
                key={i.productId}
                style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}
              >
                <AppText token="bodyM" style={{ flex: 1 }} numberOfLines={1}>
                  <AppText token="bodyM" color="ink3">
                    {formatQty(i.qty, i.unit)} ×{' '}
                  </AppText>
                  {i.name}
                </AppText>
                <Price amountPaise={i.lineTotalPaise} />
              </View>
            ))}
            <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 2 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText token="bodyM" color="ink2">
                {t('cart.deliveryFee')}
              </AppText>
              <AppText token="priceM">
                {order.deliveryFeePaise === 0 ? t('cart.free') : formatINR(paise(order.deliveryFeePaise))}
              </AppText>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <AppText token="titleM">{t('cart.total')}</AppText>
              <AppText token="priceL">{formatINR(paise(order.finalPaise))}</AppText>
            </View>
            <StatusPill
              label={
                order.fulfillmentStatus === 'DELIVERED'
                  ? t('orders.codPaid')
                  : t('orders.codDue', { amount: formatINR(paise(order.codDuePaise)) })
              }
              tone={order.fulfillmentStatus === 'DELIVERED' ? 'ok' : 'accent'}
            />
          </Card>

          {/* ── Address ── */}
          <Card style={{ gap: 4 }}>
            <AppText token="micro" color="moss">
              {t('cart.deliverTo')}
            </AppText>
            <AppText token="labelM">{order.address.label}</AppText>
            <AppText token="caption" color="ink2">
              {order.address.house}, {order.address.street}, {order.address.city}{' '}
              {order.address.pincode}
            </AppText>
          </Card>

          {/* Stage 14: the invoice exists the moment the order is delivered. */}
          {order.fulfillmentStatus === 'DELIVERED' ? (
            <>
              <Button
                label={invoice.isPending ? t('orders.invoiceOpening') : t('orders.invoice')}
                variant="secondary"
                disabled={invoice.isPending}
                onPress={() => invoice.mutate(order.id)}
              />
              {invoice.isError ? (
                <AppText token="caption" color="critical" style={{ textAlign: 'center' }}>
                  {t('orders.invoiceFailed')}
                </AppText>
              ) : null}
            </>
          ) : null}

          {order.cancellable ? (
            <Button
              label={cancel.isPending ? t('orders.cancelling') : t('orders.cancel')}
              variant="critical"
              disabled={cancel.isPending}
              onPress={() => cancel.mutate({ id: order.id, reason: 'Customer cancelled' })}
            />
          ) : null}
        </Animated.View>
      )}
    </Screen>
  );
}
