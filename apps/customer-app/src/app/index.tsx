import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Card, IconButton, StatusPill, useTheme } from '@hillexpress/ui';
import { useAuth } from '../lib/auth';
import { useBanners, useCategories, useDefaultStore, useStores } from '../lib/catalog';
import { useCartHydration } from '../lib/cart';
import { useOrders } from '../lib/orders';
import { categoryTint, categoryVisual } from '../lib/emoji';
import { CartBar } from '../components/cart-bar';
import { BannerCarousel } from '../components/banner-carousel';
import { CategoryGridSkeleton } from '../components/skeletons';

const LIVE = new Set(['PLACED', 'ACCEPTED', 'PACKING', 'READY_FOR_PICKUP', 'PICKED_UP', 'OUT_FOR_DELIVERY']);

export default function Home() {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { status } = useAuth();
  const { isPending: storesLoading } = useStores();
  const store = useDefaultStore();
  const { data: categories, isPending: catsLoading } = useCategories(store?.id);
  const { data: banners, isPending: bannersLoading } = useBanners(store?.id);
  const { data: orderPages } = useOrders();
  useCartHydration();

  if (status === 'signedOut') return <Redirect href="/(auth)/sign-in" />;
  if (status === 'loading') return null;

  const liveOrder = (orderPages?.pages ?? [])
    .flatMap((p) => p.items)
    .find((o) => LIVE.has(o.fulfillmentStatus));

  return (
    <View style={{ flex: 1, backgroundColor: colors.ground }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Spruce hero: the brand ground, cold and quiet ── */}
        <View
          style={{
            backgroundColor: colors.spruce,
            paddingTop: insets.top + 20,
            paddingHorizontal: 20,
            paddingBottom: 28,
            borderBottomLeftRadius: 28,
            borderBottomRightRadius: 28,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ gap: 6, flex: 1 }}>
              {store ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 999,
                        backgroundColor: store.isOpen ? '#35C48F' : '#F0776B',
                      }}
                    />
                    <AppText token="micro" style={{ color: store.isOpen ? '#8FD9BE' : '#F0A79E' }}>
                      {store.isOpen ? t('home.open') : t('home.closed', { time: store.openTime })}
                    </AppText>
                  </View>
                  <AppText token="displayL" style={{ color: '#F2F8F5' }}>
                    {t('home.deliveryIn', { low: store.etaLowMinutes, high: store.etaHighMinutes })}
                  </AppText>
                  <AppText token="bodyM" style={{ color: '#9FC4B4' }}>
                    {store.name}
                  </AppText>
                </>
              ) : (
                <AppText token="displayL" style={{ color: '#F2F8F5' }}>
                  {t('common.appName')}
                </AppText>
              )}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('account.title')}
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

          {/* Search sits ON the hero edge — the first affordance you see */}
          <Pressable
            accessibilityRole="search"
            onPress={() => router.push({ pathname: '/category/[id]', params: { id: 'all', focus: '1' } })}
            style={({ pressed }) => ({
              marginTop: 20,
              backgroundColor: colors.surface,
              borderRadius: 14,
              minHeight: 52,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingHorizontal: 16,
              opacity: pressed ? 0.9 : 1,
              elevation: 4,
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
            })}
          >
            <AppText token="bodyL">🔍</AppText>
            <AppText token="bodyM" color="ink3">
              {t('home.searchPlaceholder')}
            </AppText>
          </Pressable>
        </View>

        {/* ── Promo carousel — full-bleed, so it owns its own gutters ── */}
        <View style={{ paddingTop: 20 }}>
          <BannerCarousel banners={banners} isPending={bannersLoading} />
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 20 }}>
          {/* ── Live order strip — ember, because it is the thing in motion ── */}
          {liveOrder ? (
            <Animated.View entering={FadeInDown.duration(220)}>
              <Pressable
                onPress={() => router.push({ pathname: '/orders/[id]', params: { id: liveOrder.id } })}
                style={({ pressed }) => ({
                  backgroundColor: colors.emberSoft,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.emberBright,
                  padding: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  transform: [{ scale: pressed ? 0.99 : 1 }],
                })}
              >
                <View style={{ gap: 2, flex: 1 }}>
                  <AppText token="micro" color="ember">
                    {t('home.liveOrder')}
                  </AppText>
                  <AppText token="labelM">{liveOrder.orderNumber}</AppText>
                  {liveOrder.etaLowMinutes != null ? (
                    <AppText token="caption" color="ink2">
                      {t('orders.eta', {
                        low: liveOrder.etaLowMinutes,
                        high: liveOrder.etaHighMinutes,
                      })}
                    </AppText>
                  ) : null}
                </View>
                <AppText token="titleM" color="ember">
                  →
                </AppText>
              </Pressable>
            </Animated.View>
          ) : null}

          {/* ── Categories ── */}
          <View style={{ gap: 12 }}>
            <AppText token="titleM">{t('home.categories')}</AppText>
            {catsLoading || storesLoading ? (
              <CategoryGridSkeleton />
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {(categories ?? []).map((c, i) => (
                  <Animated.View
                    key={c.id}
                    entering={FadeInDown.duration(200).delay(Math.min(i, 8) * 35)}
                    style={{ width: '30.5%' }}
                  >
                    <Pressable
                      onPress={() =>
                        router.push({ pathname: '/category/[id]', params: { id: c.id, name: c.name } })
                      }
                      android_ripple={{ color: `${colors.ink}11` }}
                      style={({ pressed }) => ({
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: colors.line,
                        borderRadius: 16,
                        paddingVertical: 12,
                        paddingHorizontal: 8,
                        alignItems: 'center',
                        gap: 8,
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                      })}
                    >
                      <View
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 14,
                          backgroundColor: categoryTint(c.name, mode),
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <AppText token="displayL" style={{ fontSize: 26, lineHeight: 34 }}>
                          {categoryVisual(c.name).emoji}
                        </AppText>
                      </View>
                      <AppText token="caption" numberOfLines={2} style={{ textAlign: 'center' }}>
                        {c.name}
                      </AppText>
                    </Pressable>
                  </Animated.View>
                ))}
              </View>
            )}
          </View>

          {/* ── Delivery promise card ── */}
          {store ? (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <AppText token="displayL" style={{ fontSize: 30, lineHeight: 38 }}>
                🏔️
              </AppText>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText token="labelM">{t('home.promiseTitle')}</AppText>
                <AppText token="caption" color="ink2">
                  {store.freeDeliveryAbovePaise
                    ? t('home.promiseFree', {
                        amount: `₹${Math.floor(store.freeDeliveryAbovePaise / 100)}`,
                      })
                    : t('home.promiseCod')}
                </AppText>
              </View>
              <StatusPill label={t('cart.cod')} tone="accent" />
            </Card>
          ) : null}
        </View>
      </ScrollView>
      <CartBar />
    </View>
  );
}
