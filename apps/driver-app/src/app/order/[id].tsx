import { useState } from 'react';
import { Linking, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { formatINR, formatQty, paise } from '@hillexpress/shared';
import { AppText, Button, Card, Screen, StatusPill, useTheme } from '@hillexpress/ui';
import { useAuth } from '../../lib/auth';
import { useDriverAction, useDriverQueue } from '../../lib/driver';
import { SlideToConfirm } from '../../components/slide-to-confirm';
import { ListSkeleton } from '../../components/skeletons';

export default function DriverOrder() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { status } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: orders } = useDriverQueue();
  const act = useDriverAction();
  const [otp, setOtp] = useState('');
  const [collected, setCollected] = useState('');

  if (status === 'signedOut') return <Redirect href="/(auth)/sign-in" />;

  const order = orders?.find((o) => o.id === id);
  const otpOk = /^\d{4}$/.test(otp);
  const atCustomerLeg =
    order?.fulfillmentStatus === 'PICKED_UP' || order?.fulfillmentStatus === 'OUT_FOR_DELIVERY';

  const call = (phone: string) => void Linking.openURL(`tel:${phone}`);
  const navigate = (lat: number, lng: number, label: string) =>
    void Linking.openURL(`geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(label)})`);

  const otpField = (
    <View style={{ gap: 8 }}>
      <AppText token="labelM" color="ink2">
        {t('order.otpLabel')}
      </AppText>
      <TextInput
        value={otp}
        onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 4))}
        keyboardType="number-pad"
        maxLength={4}
        placeholder="••••"
        placeholderTextColor={colors.ink3}
        style={{
          backgroundColor: colors.surface2,
          borderWidth: 2,
          borderColor: otpOk ? colors.moss : colors.line2,
          borderRadius: 14,
          paddingHorizontal: 16,
          paddingVertical: 16,
          fontFamily: 'PlusJakartaSans-Bold',
          fontSize: 30,
          letterSpacing: 14,
          color: colors.ink,
          textAlign: 'center',
        }}
      />
    </View>
  );

  return (
    <Screen title={order?.orderNumber ?? ''} onBack={() => router.back()}>
      {!order ? (
        <ListSkeleton rows={3} height={120} />
      ) : (
        <Animated.View entering={FadeInDown.duration(220)} style={{ gap: 16 }}>
          {/* ── Where to ── */}
          <Card elevated style={{ gap: 12 }}>
            <AppText token="micro" color="moss">
              {atCustomerLeg ? t('order.legCustomer') : t('order.legStore')}
            </AppText>
            <AppText token="titleM">
              {atCustomerLeg ? (order.customerName ?? order.customerPhone) : order.storeName}
            </AppText>
            {atCustomerLeg ? (
              <>
                <AppText token="bodyM" color="ink2">
                  {order.address.house}, {order.address.street}
                  {order.address.landmark ? `, ${order.address.landmark}` : ''}, {order.address.city}{' '}
                  {order.address.pincode}
                </AppText>
                {order.address.instructions ? (
                  <View
                    style={{
                      backgroundColor: colors.emberSoft,
                      borderRadius: 10,
                      padding: 10,
                    }}
                  >
                    <AppText token="caption" color="ember">
                      💬 “{order.address.instructions}”
                    </AppText>
                  </View>
                ) : null}
              </>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button
                  label={`📞  ${t('order.call')}`}
                  variant="secondary"
                  target="driver"
                  onPress={() => call(order.customerPhone)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label={`🗺  ${t('order.navigate')}`}
                  variant="secondary"
                  target="driver"
                  onPress={() =>
                    atCustomerLeg
                      ? navigate(order.address.lat, order.address.lng, order.orderNumber)
                      : navigate(order.storeLat, order.storeLng, order.storeName)
                  }
                />
              </View>
            </View>
          </Card>

          {/* ── Items + cash ── */}
          <Card style={{ gap: 8 }}>
            <AppText token="micro" color="moss">
              {t('order.items', { count: order.itemCount })}
            </AppText>
            {order.items.map((i) => (
              <AppText key={i.productId} token="bodyM" color="ink2">
                {formatQty(i.qty, i.unit)} × {i.name} · {i.packSize}
              </AppText>
            ))}
            <View style={{ height: 1, backgroundColor: colors.line, marginTop: 4 }} />
            <StatusPill
              label={t('order.collect', { amount: formatINR(paise(order.codDuePaise)) })}
              tone="accent"
            />
          </Card>

          {/* ── Stage action ── */}
          {order.assignmentStatus === 'ASSIGNED' ? (
            <Button
              label={t('order.accept')}
              target="driver"
              disabled={act.isPending}
              onPress={() => act.mutate({ id: order.id, action: 'accept' })}
            />
          ) : order.fulfillmentStatus === 'ACCEPTED' || order.fulfillmentStatus === 'PACKING' ? (
            <Card style={{ alignItems: 'center', gap: 8, paddingVertical: 24 }}>
              <AppText token="displayL" style={{ fontSize: 40, lineHeight: 50 }}>
                📦
              </AppText>
              <StatusPill label={t('order.waitingStore')} tone="warn" />
            </Card>
          ) : order.fulfillmentStatus === 'READY_FOR_PICKUP' ? (
            <Card style={{ gap: 14 }}>
              <View style={{ gap: 3 }}>
                <AppText token="titleM">{t('order.pickupTitle', { store: order.storeName })}</AppText>
                <AppText token="caption" color="ink2">
                  {t('order.pickupHint')}
                </AppText>
              </View>
              {otpField}
              <SlideToConfirm
                label={t('order.pickupSlide')}
                disabled={!otpOk || act.isPending}
                onConfirm={() => {
                  act.mutate({ id: order.id, action: 'pickup', otp });
                  setOtp('');
                }}
              />
            </Card>
          ) : (
            <Card style={{ gap: 14 }}>
              <View style={{ gap: 3 }}>
                <AppText token="titleM">
                  {t('order.deliverTitle', { name: order.customerName ?? order.customerPhone })}
                </AppText>
                <AppText token="caption" color="ink2">
                  {t('order.deliverHint')}
                </AppText>
              </View>
              {otpField}
              <View style={{ gap: 8 }}>
                <AppText token="labelM" color="ink2">
                  {t('order.collectedLabel')}
                </AppText>
                <TextInput
                  value={collected}
                  onChangeText={(v) => setCollected(v.replace(/[^\d.]/g, ''))}
                  keyboardType="decimal-pad"
                  placeholder={String(order.codDuePaise / 100)}
                  placeholderTextColor={colors.ink3}
                  style={{
                    backgroundColor: colors.surface2,
                    borderWidth: 1,
                    borderColor: colors.line2,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    fontFamily: 'PlusJakartaSans-Bold',
                    fontSize: 22,
                    color: colors.ink,
                  }}
                />
                <AppText token="caption" color="ink3">
                  {t('order.collectedHint')}
                </AppText>
              </View>
              <SlideToConfirm
                label={t('order.deliverSlide')}
                disabled={!otpOk || act.isPending}
                onConfirm={() => {
                  const rupees =
                    collected.trim() === '' ? order.codDuePaise / 100 : parseFloat(collected);
                  act.mutate(
                    {
                      id: order.id,
                      action: 'deliver',
                      otp,
                      collectedPaise: Math.round((Number.isFinite(rupees) ? rupees : 0) * 100),
                    },
                    { onSuccess: () => router.back() },
                  );
                  setOtp('');
                }}
              />
            </Card>
          )}

          {act.isError ? (
            <AppText token="caption" color="critical">
              {act.error instanceof Error ? act.error.message : t('common.retry')}
            </AppText>
          ) : null}
        </Animated.View>
      )}
    </Screen>
  );
}
