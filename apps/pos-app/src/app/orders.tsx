import { useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { formatINR, formatQty, paise, type PosOrderDto } from '@hillexpress/shared';
import { AppText, Button, Card, IconButton, StatusPill, useTheme } from '@hillexpress/ui';
import { useAuth } from '../lib/auth';
import { useOrderAction, usePosQueue } from '../lib/orders';
import { ListSkeleton } from '../components/skeletons';

function ageMinutes(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
}

function OrderCard({ order, index }: { order: PosOrderDto; index: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const act = useOrderAction();
  const [confirmReject, setConfirmReject] = useState(false);

  const run = (action: 'accept' | 'reject' | 'packing' | 'ready', body?: { reason?: string }) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    act.mutate({ id: order.id, action, body });
    setConfirmReject(false);
  };

  const age = ageMinutes(order.placedAt);
  const urgent = order.fulfillmentStatus === 'PLACED' && age >= 3;

  return (
    <Animated.View entering={FadeInDown.duration(220).delay(Math.min(index, 6) * 45)}>
      <Card
        elevated
        style={{
          borderWidth: urgent ? 2 : 1,
          borderColor: urgent ? colors.emberBright : colors.line,
          gap: 12,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppText token="titleM">{order.orderNumber}</AppText>
          <AppText token="caption" color={urgent ? 'ember' : 'ink3'}>
            {urgent ? '⏱ ' : ''}
            {t('orders.age', { min: age })}
          </AppText>
        </View>

        <View style={{ gap: 5 }}>
          {order.items.map((i) => (
            <View key={i.productId} style={{ flexDirection: 'row', gap: 10 }}>
              <View
                style={{
                  minWidth: 28,
                  borderRadius: 6,
                  backgroundColor: colors.surface2,
                  alignItems: 'center',
                  paddingVertical: 1,
                }}
              >
                <AppText token="labelM" style={{ fontVariant: ['tabular-nums'] }}>
                  {formatQty(i.qty, i.unit)}
                </AppText>
              </View>
              <AppText token="bodyM" style={{ flex: 1 }} numberOfLines={1}>
                {i.name}
              </AppText>
              <AppText token="caption" color="ink3">
                {i.packSize}
              </AppText>
            </View>
          ))}
        </View>

        <View style={{ height: 1, backgroundColor: colors.line }} />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <StatusPill
            label={t('orders.cod', { amount: formatINR(paise(order.codDuePaise)) })}
            tone="accent"
          />
          <AppText
            token="caption"
            color="moss"
            onPress={() => void Linking.openURL(`tel:${order.customerPhone}`)}
          >
            📞 {order.customerPhone}
          </AppText>
        </View>

        {/* Pickup code — only once packed, read aloud to the driver */}
        {order.pickupOtp ? (
          <View
            style={{
              backgroundColor: colors.mossSoft,
              borderRadius: 12,
              padding: 12,
              alignItems: 'center',
              gap: 2,
            }}
          >
            <AppText token="micro" color="ok">
              {t('orders.pickupCode')}
            </AppText>
            <AppText token="displayL" color="ok" style={{ fontSize: 30, lineHeight: 38, letterSpacing: 8 }}>
              {order.pickupOtp}
            </AppText>
          </View>
        ) : null}

        {act.isError ? (
          <AppText token="caption" color="critical">
            {act.error instanceof Error ? act.error.message : t('common.retry')}
          </AppText>
        ) : null}

        {/* per-state actions — the state machine mirrored in UI */}
        {order.fulfillmentStatus === 'PLACED' ? (
          confirmReject ? (
            <View style={{ gap: 8 }}>
              <AppText token="caption" color="critical">
                {t('orders.rejectConfirm')}
              </AppText>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    label={t('orders.rejectOutOfStock')}
                    variant="critical"
                    onPress={() => run('reject', { reason: 'Items out of stock' })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label={t('orders.keep')}
                    variant="secondary"
                    onPress={() => setConfirmReject(false)}
                  />
                </View>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 2 }}>
                <Button label={t('orders.accept')} onPress={() => run('accept')} disabled={act.isPending} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label={t('orders.reject')} variant="critical" onPress={() => setConfirmReject(true)} />
              </View>
            </View>
          )
        ) : null}
        {order.fulfillmentStatus === 'ACCEPTED' ? (
          <Button label={t('orders.startPacking')} onPress={() => run('packing')} disabled={act.isPending} />
        ) : null}
        {order.fulfillmentStatus === 'PACKING' ? (
          <Button label={t('orders.markReady')} onPress={() => run('ready')} disabled={act.isPending} />
        ) : null}
        {order.fulfillmentStatus === 'READY_FOR_PICKUP' ? (
          <StatusPill label={t('orders.waitingDriver')} tone="ok" />
        ) : null}
      </Card>
    </Animated.View>
  );
}

export default function PosOrders() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { status } = useAuth();
  const [scope, setScope] = useState<'active' | 'history'>('active');
  const { data: orders, isPending } = usePosQueue(scope);

  if (status === 'signedOut') return <Redirect href="/(auth)/sign-in" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.ground }}>
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, gap: 14, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconButton icon="←" label={t('common.back')} onPress={() => router.back()} />
          <AppText token="titleL" style={{ flex: 1 }}>
            {t('orders.title')}
          </AppText>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['active', 'history'] as const).map((s) => (
            <Button
              key={s}
              label={s === 'active' ? t('orders.active') : t('orders.history')}
              variant={scope === s ? 'primary' : 'secondary'}
              style={{ flex: 1, minHeight: 42 }}
              onPress={() => setScope(s)}
            />
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: insets.bottom + 32, gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        {isPending ? (
          <ListSkeleton rows={3} height={180} />
        ) : (orders ?? []).length === 0 ? (
          <View style={{ padding: 48, alignItems: 'center', gap: 10 }}>
            <AppText token="displayL" style={{ fontSize: 52, lineHeight: 64 }}>
              🧾
            </AppText>
            <AppText token="bodyM" color="ink2" style={{ textAlign: 'center' }}>
              {scope === 'active' ? t('orders.emptyActive') : t('orders.emptyHistory')}
            </AppText>
          </View>
        ) : (
          (orders ?? []).map((o, i) => <OrderCard key={o.id} order={o} index={i} />)
        )}
      </ScrollView>
    </View>
  );
}
