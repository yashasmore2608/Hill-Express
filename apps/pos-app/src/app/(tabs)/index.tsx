import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { PosOrderDto } from '@hillexpress/shared';
import { AppText, useTheme } from '@hillexpress/ui';
import { usePatchStore, usePosSummary } from '../../lib/pos';
import { usePosQueue } from '../../lib/orders';
import { OrderCard } from '../../components/order-card';
import { ListSkeleton } from '../../components/skeletons';

/**
 * Orders — the shift screen.
 *
 * Deliberately the shape of every partner app: an online toggle at the top,
 * status tabs under it, one column of cards below, oldest first. An earlier
 * version sorted by remaining slack and split the screen into a queue rail and
 * a work surface; it was better designed and worse to learn, and rows that
 * reorder under a moving finger are their own bug.
 *
 * FIFO within a tab is not laziness — it is what the API already returns and
 * what an operator predicts. Lateness is a badge on the card, not a sort key.
 */

type TabKey = 'new' | 'preparing' | 'ready' | 'past';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready' },
  { key: 'past', label: 'Past' },
];

/** Our two-axis statuses, folded into the four words operators already know. */
/**
 * A card stretched across a landscape tablet leaves half of every row empty and
 * drags the eye from quantity to name across dead space. Capping the column is
 * what every app does on a wide screen — the phone layout is unaffected.
 */
const MAX_CONTENT = 640;

const IN_TAB: Record<Exclude<TabKey, 'past'>, string[]> = {
  new: ['PLACED'],
  preparing: ['ACCEPTED', 'PACKING'],
  ready: ['READY_FOR_PICKUP'],
};

export default function Orders() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<TabKey>('new');
  const scope = tab === 'past' ? 'history' : 'active';
  const { data: orders, isPending } = usePosQueue(scope);
  const { data: summary } = usePosSummary();
  const patchStore = usePatchStore();

  // One clock read per render, shared by every card, so all the timers on
  // screen agree with each other.
  const now = Date.now();

  const visible: PosOrderDto[] = useMemo(() => {
    if (!orders) return [];
    if (tab === 'past') return orders;
    const wanted = IN_TAB[tab];
    return orders.filter((o) => wanted.includes(o.fulfillmentStatus));
  }, [orders, tab]);

  // Counts come from the active queue whatever tab is showing, so the badges
  // stay true while the operator is looking at Past.
  const activeQueue = scope === 'active' ? orders : undefined;
  const countFor = (key: TabKey): number | null => {
    if (key === 'past' || !activeQueue) return null;
    return activeQueue.filter((o) => IN_TAB[key].includes(o.fulfillmentStatus)).length;
  };

  const store = summary?.store;
  const isOpen = store?.isOpen ?? false;

  return (
    <View style={{ flex: 1, backgroundColor: colors.ground }}>
      {/* Online toggle — the first thing a partner app shows, because it is the
          one control that stops the day. */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 16,
          paddingBottom: 12,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <AppText token="titleM" numberOfLines={1}>
            {store?.name ?? t('common.appName')}
          </AppText>
          <AppText token="caption" style={{ color: isOpen ? colors.ok : colors.critical }}>
            {isOpen ? t('home.open') : t('home.closed')}
          </AppText>
        </View>
        <Switch
          value={isOpen}
          onValueChange={(v) => patchStore.mutate({ isOpen: v })}
          trackColor={{ false: colors.surface3, true: colors.moss }}
          thumbColor="#FFFFFF"
          accessibilityLabel={isOpen ? t('home.open') : t('home.closed')}
        />
      </View>

      {/* Status tabs. The order moves tab to tab, exactly as elsewhere. */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
        }}
      >
        {TABS.map((tb) => {
          const on = tab === tb.key;
          const count = countFor(tb.key);
          return (
            <Pressable
              key={tb.key}
              onPress={() => setTab(tb.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={{
                flex: 1,
                paddingVertical: 12,
                alignItems: 'center',
                gap: 2,
                borderBottomWidth: 2.5,
                borderBottomColor: on ? colors.moss : 'transparent',
              }}
            >
              <AppText token="labelM" color={on ? 'moss' : 'ink3'}>
                {tb.label}
                {count ? `  ${count}` : ''}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {isPending ? (
        <View style={{ padding: 16 }}>
          <ListSkeleton rows={3} height={150} />
        </View>
      ) : visible.length === 0 ? (
        <View style={{ padding: 32, alignItems: 'center' }}>
          <AppText token="bodyM" color="ink3" style={{ textAlign: 'center' }}>
            {tab === 'past' ? t('orders.emptyHistory') : t('orders.emptyActive')}
          </AppText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 16,
            gap: 14,
            paddingBottom: insets.bottom + 24,
            width: '100%',
            maxWidth: MAX_CONTENT,
            alignSelf: 'center',
          }}
          showsVerticalScrollIndicator={false}
        >
          {visible.map((o) => (
            <OrderCard key={o.id} order={o} now={now} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
