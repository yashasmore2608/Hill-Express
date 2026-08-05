import { Pressable, ScrollView, Switch, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { AppText, Card, StatusPill, useTheme } from '@hillexpress/ui';
import { useAuth } from '../lib/auth';
import { usePatchStore, usePosSummary } from '../lib/pos';
import { ListSkeleton } from '../components/skeletons';

function Tile({ label, value, tone }: { label: string; value: number; tone?: 'warn' | 'crit' }) {
  const { colors } = useTheme();
  const valueColor =
    tone === 'crit' ? colors.critical : tone === 'warn' ? colors.warning : colors.ink;
  return (
    <Card style={{ flex: 1, padding: 14, gap: 2 }}>
      <AppText token="displayL" style={{ color: valueColor, fontSize: 26, lineHeight: 32 }}>
        {value}
      </AppText>
      <AppText token="caption" color="ink2">
        {label}
      </AppText>
    </Card>
  );
}

function ActionRow({
  icon,
  label,
  hint,
  badge,
  onPress,
  accent,
}: {
  icon: string;
  label: string;
  hint?: string;
  badge?: number;
  onPress: () => void;
  accent?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: `${colors.ink}11` }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: accent ? colors.mossSoft : colors.surface,
        borderWidth: 1,
        borderColor: accent ? colors.moss : colors.line,
        borderRadius: 16,
        padding: 16,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
      <AppText token="titleL">{icon}</AppText>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText token="bodyL" style={{ fontFamily: 'PlusJakartaSans-SemiBold' }}>
          {label}
        </AppText>
        {hint ? (
          <AppText token="caption" color="ink2">
            {hint}
          </AppText>
        ) : null}
      </View>
      {badge && badge > 0 ? (
        <View
          style={{
            minWidth: 26,
            height: 26,
            borderRadius: 999,
            backgroundColor: colors.emberBright,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 8,
          }}
        >
          <AppText token="labelM" style={{ color: '#FFFFFF', fontVariant: ['tabular-nums'] }}>
            {badge}
          </AppText>
        </View>
      ) : (
        <AppText token="bodyM" color="ink3">
          ›
        </AppText>
      )}
    </Pressable>
  );
}

export default function PosHome() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { status } = useAuth();
  const { data, isPending } = usePosSummary();
  const patchStore = usePatchStore();

  if (status === 'signedOut') return <Redirect href="/(auth)/sign-in" />;
  if (status === 'loading') return null;

  const store = data?.store;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.ground }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View
        style={{
          backgroundColor: colors.spruce,
          paddingTop: insets.top + 20,
          paddingHorizontal: 20,
          paddingBottom: 24,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <View style={{ gap: 4, flex: 1 }}>
          <AppText token="micro" style={{ color: '#8FD9BE' }}>
            {store?.code ?? t('common.appName')}
          </AppText>
          <AppText token="titleL" style={{ color: '#F2F8F5' }} numberOfLines={2}>
            {store?.name ?? ''}
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.signOut')}
          onPress={() => router.push('/account')}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
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

      <View style={{ padding: 20, gap: 14 }}>
        {isPending || !store ? (
          <ListSkeleton rows={4} height={80} />
        ) : (
          <Animated.View entering={FadeInDown.duration(220)} style={{ gap: 14 }}>
            {/* ── The switch that turns the store on ── */}
            <Card
              elevated
              style={{
                borderColor: store.isOpen ? colors.moss : colors.line,
                borderWidth: store.isOpen ? 2 : 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <View style={{ gap: 6, flex: 1 }}>
                <StatusPill
                  label={store.isOpen ? t('home.open') : t('home.closed')}
                  tone={store.isOpen ? 'ok' : 'crit'}
                />
                <AppText token="caption" color="ink2">
                  {store.isOpen ? t('home.openHint') : t('home.closedHint')}
                </AppText>
              </View>
              <Switch
                value={store.isOpen}
                onValueChange={(next) => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  patchStore.mutate({ isOpen: next });
                }}
                trackColor={{ false: colors.surface3, true: colors.moss }}
                thumbColor="#FFFFFF"
              />
            </Card>

            {/* ── Packing time ── */}
            <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ gap: 2, flex: 1 }}>
                <AppText token="labelM">{t('home.prepTime')}</AppText>
                <AppText token="caption" color="ink3">
                  {t('home.prepHint')}
                </AppText>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Pressable
                  accessibilityLabel="Decrease packing time"
                  disabled={store.defaultPrepMin <= 5}
                  onPress={() => patchStore.mutate({ defaultPrepMin: store.defaultPrepMin - 5 })}
                  style={({ pressed }) => ({
                    width: 40,
                    height: 40,
                    borderRadius: 999,
                    backgroundColor: colors.surface2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: store.defaultPrepMin <= 5 ? 0.4 : 1,
                    transform: [{ scale: pressed ? 0.92 : 1 }],
                  })}
                >
                  <AppText token="titleM">−</AppText>
                </Pressable>
                <AppText token="priceL" style={{ minWidth: 64, textAlign: 'center' }}>
                  {t('home.prepMinutes', { min: store.defaultPrepMin })}
                </AppText>
                <Pressable
                  accessibilityLabel="Increase packing time"
                  disabled={store.defaultPrepMin >= 60}
                  onPress={() => patchStore.mutate({ defaultPrepMin: store.defaultPrepMin + 5 })}
                  style={({ pressed }) => ({
                    width: 40,
                    height: 40,
                    borderRadius: 999,
                    backgroundColor: colors.surface2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: store.defaultPrepMin >= 60 ? 0.4 : 1,
                    transform: [{ scale: pressed ? 0.92 : 1 }],
                  })}
                >
                  <AppText token="titleM">＋</AppText>
                </Pressable>
              </View>
            </Card>

            {/* ── Counts ── */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Tile label={t('home.products')} value={data.productCount} />
              <Tile label={t('home.lowStock')} value={data.lowStockCount} tone="warn" />
              <Tile label={t('home.outOfStock')} value={data.outOfStockCount} tone="crit" />
            </View>

            {/* ── Actions ── */}
            <ActionRow
              icon="🧾"
              label={t('home.orders')}
              hint={t('home.ordersHint')}
              badge={data.activeOrders}
              accent={data.activeOrders > 0}
              onPress={() => router.push('/orders')}
            />
            <ActionRow
              icon="📦"
              label={t('home.catalogue')}
              hint={t('home.catalogueHint')}
              onPress={() => router.push('/catalogue')}
            />
            <ActionRow
              icon="📄"
              label={t('home.import')}
              hint={t('home.importHint')}
              onPress={() => router.push('/import')}
            />
          </Animated.View>
        )}
      </View>
    </ScrollView>
  );
}
