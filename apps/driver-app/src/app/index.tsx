import { Pressable, ScrollView, Switch, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { formatINR, paise } from '@hillexpress/shared';
import { AppText, Card, StatusPill, useTheme } from '@hillexpress/ui';
import { useAuth } from '../lib/auth';
import { useDriverQueue, useDriverSummary, useSetDuty } from '../lib/driver';
import { ListSkeleton } from '../components/skeletons';

const STATUS_LABEL: Record<string, string> = {
  ACCEPTED: 'order.waitingStore',
  PACKING: 'order.waitingStore',
  READY_FOR_PICKUP: 'order.readyToCollect',
  PICKED_UP: 'order.statusOnBoard',
  OUT_FOR_DELIVERY: 'order.statusOnBoard',
};

export default function DriverHome() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { status, signOut } = useAuth();
  const { data: me, isPending } = useDriverSummary();
  const { data: orders } = useDriverQueue();
  const duty = useSetDuty();

  if (status === 'signedOut') return <Redirect href="/(auth)/sign-in" />;
  if (status === 'loading') return null;

  const onDuty = me?.status === 'AVAILABLE' || me?.status === 'ON_DELIVERY';
  const codPct = me ? Math.min(100, (me.codOutstandingPaise / me.codLimitPaise) * 100) : 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.ground }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={{
          backgroundColor: colors.spruce,
          paddingTop: insets.top + 20,
          paddingHorizontal: 20,
          paddingBottom: 24,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ gap: 4, flex: 1 }}>
            <AppText token="micro" style={{ color: '#8FD9BE' }}>
              {t('common.appName')}
            </AppText>
            <AppText token="titleL" style={{ color: '#F2F8F5' }}>
              {me?.name ?? ''}
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.appName')}
            onPress={() => router.push('/account')}
            style={({ pressed }) => ({
              width: 48,
              height: 48,
              borderRadius: 999,
              backgroundColor: '#FFFFFF1A',
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ scale: pressed ? 0.94 : 1 }],
            })}
          >
            <AppText token="titleM" style={{ color: '#F2F8F5' }}>
              ☰
            </AppText>
          </Pressable>
        </View>
      </View>

      <View style={{ padding: 20, gap: 14 }}>
        {isPending || !me ? (
          <ListSkeleton rows={3} height={90} />
        ) : (
          <Animated.View entering={FadeInDown.duration(220)} style={{ gap: 14 }}>
            {/* ── Duty ── */}
            <Card
              elevated
              style={{
                borderWidth: onDuty ? 2 : 1,
                borderColor: onDuty ? colors.moss : colors.line,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <View style={{ gap: 6, flex: 1 }}>
                <StatusPill
                  label={onDuty ? t('home.onDuty') : t('home.offDuty')}
                  tone={onDuty ? 'ok' : 'neutral'}
                />
                <AppText token="caption" color="ink2">
                  {onDuty ? t('home.onDutyHint') : t('home.offDutyHint')}
                </AppText>
              </View>
              <Switch
                value={onDuty}
                disabled={me.status === 'ON_DELIVERY' || duty.isPending}
                onValueChange={(next) => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  duty.mutate(next ? 'AVAILABLE' : 'OFFLINE');
                }}
                trackColor={{ false: colors.surface3, true: colors.moss }}
                thumbColor="#FFFFFF"
              />
            </Card>

            {/* ── Cash in hand — ember, with a limit gauge ── */}
            <Card style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <View style={{ gap: 2 }}>
                  <AppText token="caption" color="ink2">
                    {t('home.codCarrying')}
                  </AppText>
                  <AppText token="displayL" color="ember">
                    {formatINR(paise(me.codOutstandingPaise))}
                  </AppText>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <AppText token="displayL" style={{ fontSize: 24, lineHeight: 30 }}>
                    {me.deliveredToday}
                  </AppText>
                  <AppText token="caption" color="ink2">
                    {t('home.deliveredToday')}
                  </AppText>
                </View>
              </View>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surface3 }}>
                <View
                  style={{
                    height: 6,
                    borderRadius: 3,
                    width: `${codPct}%`,
                    backgroundColor: codPct > 80 ? colors.critical : colors.emberBright,
                  }}
                />
              </View>
              <AppText token="caption" color="ink3">
                {t('home.codLimit', { limit: formatINR(paise(me.codLimitPaise)) })}
              </AppText>
            </Card>

            {/* ── Deliveries ── */}
            <AppText token="titleM">{t('home.deliveries')}</AppText>
            {(orders ?? []).length === 0 ? (
              <View style={{ padding: 36, alignItems: 'center', gap: 10 }}>
                <AppText token="displayL" style={{ fontSize: 52, lineHeight: 64 }}>
                  🛵
                </AppText>
                <AppText token="bodyM" color="ink2" style={{ textAlign: 'center' }}>
                  {t('home.empty')}
                </AppText>
              </View>
            ) : (
              (orders ?? []).map((o, i) => {
                const isNew = o.assignmentStatus === 'ASSIGNED';
                return (
                  <Animated.View key={o.id} entering={FadeInDown.duration(220).delay(Math.min(i, 5) * 45)}>
                    <Pressable
                      onPress={() => router.push({ pathname: '/order/[id]', params: { id: o.id } })}
                      android_ripple={{ color: `${colors.ink}11` }}
                      style={({ pressed }) => ({
                        backgroundColor: colors.surface,
                        borderWidth: isNew ? 2 : 1,
                        borderColor: isNew ? colors.emberBright : colors.line,
                        borderRadius: 16,
                        padding: 16,
                        gap: 10,
                        transform: [{ scale: pressed ? 0.99 : 1 }],
                      })}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <AppText token="titleM">{o.orderNumber}</AppText>
                        <AppText token="priceM" color="ember">
                          {formatINR(paise(o.codDuePaise))}
                        </AppText>
                      </View>
                      <AppText token="bodyM" color="ink2" numberOfLines={1}>
                        📍 {o.address.street}, {o.address.city}
                      </AppText>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <StatusPill
                          label={t(STATUS_LABEL[o.fulfillmentStatus] ?? 'order.statusAssigned')}
                          tone={isNew ? 'accent' : 'ok'}
                        />
                        <AppText token="caption" color="ink3">
                          {t('order.items', { count: o.itemCount })}
                        </AppText>
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              })
            )}
          </Animated.View>
        )}
      </View>
    </ScrollView>
  );
}
