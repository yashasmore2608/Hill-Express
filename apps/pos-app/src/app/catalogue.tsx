import { useEffect, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { ProductDto } from '@hillexpress/shared';
import { AppText, IconButton, Price, StatusPill, useTheme } from '@hillexpress/ui';
import { useAuth } from '../lib/auth';
import { usePosProducts, type StockFilter } from '../lib/pos';
import { ListSkeleton } from '../components/skeletons';

function Row({ product, onPress }: { product: ProductDto; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const out = product.availableQty === 0;
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: `${colors.ink}11` }}
      style={({ pressed }) => ({
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: 14,
        padding: 14,
        gap: 10,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText token="bodyM" numberOfLines={1} style={{ fontFamily: 'PlusJakartaSans-Medium' }}>
            {product.name}
          </AppText>
          <AppText token="caption" color="ink3">
            {product.sku ?? '—'} · {product.packSize}
          </AppText>
        </View>
        <Price amountPaise={product.pricePaise} mrpPaise={product.mrpPaise} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <StatusPill
          label={`${t('catalog.stock')} ${product.availableQty}`}
          tone={out ? 'crit' : product.lowStock ? 'warn' : 'ok'}
        />
        {!product.isAvailable ? <StatusPill label={t('catalog.hidden')} tone="crit" /> : null}
      </View>
    </Pressable>
  );
}

export default function Catalogue() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { status } = useAuth();

  const [filter, setFilter] = useState<StockFilter>('all');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const query = usePosProducts({ search: debounced || undefined, filter });
  const items = useMemo(() => (query.data?.pages ?? []).flatMap((p) => p.items), [query.data]);

  if (status === 'signedOut') return <Redirect href="/(auth)/sign-in" />;

  const filters: { key: StockFilter; label: string }[] = [
    { key: 'all', label: t('catalog.filterAll') },
    { key: 'low', label: t('catalog.filterLow') },
    { key: 'out', label: t('catalog.filterOut') },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.ground }}>
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, gap: 14, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconButton icon="←" label={t('common.back')} onPress={() => router.back()} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText token="titleL">{t('catalog.title')}</AppText>
            <AppText token="caption" color="ink3">
              {items.length} products
            </AppText>
          </View>
        </View>

        <View
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.line2,
            borderRadius: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 14,
            minHeight: 46,
          }}
        >
          <AppText token="bodyM">🔍</AppText>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('catalog.searchPlaceholder')}
            placeholderTextColor={colors.ink3}
            style={{
              flex: 1,
              fontFamily: 'PlusJakartaSans-Regular',
              fontSize: 15,
              color: colors.ink,
              paddingVertical: 11,
            }}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {filters.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={({ pressed }) => ({
                  paddingHorizontal: 18,
                  paddingVertical: 9,
                  borderRadius: 999,
                  backgroundColor: active ? colors.moss : colors.surface,
                  borderWidth: 1,
                  borderColor: active ? colors.moss : colors.line2,
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                })}
              >
                <AppText token="labelM" style={{ color: active ? colors.onMoss : colors.ink }}>
                  {f.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {query.isPending ? (
        <View style={{ paddingHorizontal: 20 }}>
          <ListSkeleton rows={5} height={90} />
        </View>
      ) : (
        <FlashList
          data={items}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: 20, paddingVertical: 5 }}>
              <Row
                product={item}
                onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.id } })}
              />
            </View>
          )}
          contentContainerStyle={{ paddingVertical: 6, paddingBottom: insets.bottom + 32 }}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          onEndReachedThreshold={0.6}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={{ padding: 48, alignItems: 'center' }}>
              <AppText token="bodyM" color="ink2">
                {t('catalog.empty')}
              </AppText>
            </View>
          }
        />
      )}
    </View>
  );
}
