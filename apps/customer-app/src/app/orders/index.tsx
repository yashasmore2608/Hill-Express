import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { formatINR, paise, type OrderSummaryDto } from '@hillexpress/shared';
import { AppText, IconButton, StatusPill, useTheme } from '@hillexpress/ui';
import { useAuth } from '../../lib/auth';
import { useOrders } from '../../lib/orders';
import { ListSkeleton } from '../../components/skeletons';

const TONE: Record<string, 'ok' | 'warn' | 'crit' | 'accent' | 'neutral'> = {
  PLACED: 'warn',
  ACCEPTED: 'ok',
  PACKING: 'ok',
  READY_FOR_PICKUP: 'ok',
  PICKED_UP: 'accent',
  OUT_FOR_DELIVERY: 'accent',
  DELIVERED: 'ok',
  REJECTED: 'crit',
  CANCELLED: 'neutral',
};

const KEY: Record<string, string> = {
  PLACED: 'placed',
  ACCEPTED: 'accepted',
  PACKING: 'packing',
  READY_FOR_PICKUP: 'ready',
  PICKED_UP: 'pickedUp',
  OUT_FOR_DELIVERY: 'outForDelivery',
  DELIVERED: 'delivered',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};

export default function OrdersList() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { status } = useAuth();
  const query = useOrders();
  const items = useMemo(() => (query.data?.pages ?? []).flatMap((p) => p.items), [query.data]);

  if (status === 'signedOut') return <Redirect href="/(auth)/sign-in" />;

  const renderItem = ({ item }: { item: OrderSummaryDto }) => (
    <Pressable
      onPress={() => router.push({ pathname: '/orders/[id]', params: { id: item.id } })}
      android_ripple={{ color: `${colors.ink}11` }}
      style={({ pressed }) => ({
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: 16,
        padding: 16,
        gap: 10,
        marginHorizontal: 20,
        marginVertical: 5,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <AppText token="labelM">{item.orderNumber}</AppText>
        <AppText token="priceM">{formatINR(paise(item.finalPaise))}</AppText>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <StatusPill
          label={t(`orders.s.${KEY[item.fulfillmentStatus] ?? 'placed'}`)}
          tone={TONE[item.fulfillmentStatus] ?? 'neutral'}
        />
        <AppText token="caption" color="ink3">
          {t('orders.itemsAndDate', {
            count: item.itemCount,
            date: new Date(item.placedAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
            }),
          })}
        </AppText>
      </View>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.ground }}>
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <IconButton
          icon="←"
          label={t('common.back')}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
        <AppText token="titleL">{t('orders.title')}</AppText>
      </View>

      {query.isPending ? (
        <View style={{ paddingHorizontal: 20 }}>
          <ListSkeleton rows={4} />
        </View>
      ) : (
        <FlashList
          data={items}
          keyExtractor={(o) => o.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingVertical: 6, paddingBottom: insets.bottom + 32 }}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          onEndReachedThreshold={0.6}
          ListEmptyComponent={
            <View style={{ padding: 56, alignItems: 'center', gap: 10 }}>
              <AppText token="displayL" style={{ fontSize: 56, lineHeight: 68 }}>
                🧾
              </AppText>
              <AppText token="titleM">{t('orders.empty')}</AppText>
            </View>
          }
        />
      )}
    </View>
  );
}
