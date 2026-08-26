import { useEffect, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { ProductDto } from '@hillexpress/shared';
import { AppText, Price, StatusPill, useTheme } from '@hillexpress/ui';
import { useAuth } from '../../lib/auth';
import { usePosProducts, usePosSummary, type StockFilter } from '../../lib/pos';
import { ListSkeleton } from '../../components/skeletons';

/**
 * Stock can be fractional (availableQty is DECIMAL(12,3) behind the DTO), so
 * trim the noise rather than printing "31.500".
 */
const stockText = (n: number): string =>
  Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)));

function Row({ product, onPress }: { product: ProductDto; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const out = product.availableQty === 0;
  const low = !out && product.lowStock;
  const stockColor = out ? colors.critical : low ? colors.warning : colors.ink;

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: `${colors.ink}11` }}
      accessibilityRole="button"
      accessibilityLabel={
        out
          ? `${product.name}, ${t('catalog.outOfStock')}`
          : `${product.name}, ${stockText(product.availableQty)} ${t('catalog.stockLeft')}${low ? ', low stock' : ''}`
      }
      style={({ pressed }) => ({
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: 14,
        padding: 14,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText token="bodyM" numberOfLines={2} style={{ fontFamily: 'PlusJakartaSans-Medium' }}>
            {product.name}
          </AppText>
          <AppText token="caption" color="ink3">
            {product.sku ?? '—'} · {product.packSize}
          </AppText>
          {/* Hidden is a property of the PRODUCT, not of its stock, so it stays
              on the left with the identity rather than in the number column.

              The DTO's `isAvailable` is `p.isAvailable && availableQty > 0`, so
              it goes false the moment stock hits zero — badging that as HIDDEN
              blames the operator for something they did not do, and repeats
              what OUT OF STOCK already says. Only claim it was hidden when
              stock cannot be the explanation. */}
          {!product.isAvailable && !out ? (
            <View style={{ marginTop: 4 }}>
              <StatusPill label={t('catalog.hidden')} tone="crit" />
            </View>
          ) : null}
        </View>

        {/* Price above, stock below, right-aligned.
            Two lines, not four. The first version labelled every row "IN STOCK"
            — a whole line per product to say nothing is wrong, on the ~90% of
            rows where nothing is wrong. Silence is the normal state; only an
            exception earns a word. The number also came down from 24px, where
            it out-shouted the price and left the row with no clear lead. */}
        <View style={{ alignItems: 'flex-end', gap: 8 }}>
          <Price amountPaise={product.pricePaise} mrpPaise={product.mrpPaise} />

          {out ? (
            // Zero needs no digit — the words already carry it, and they carry
            // it to someone who cannot tell the red from the amber.
            <StatusPill label={t('catalog.outOfStock')} tone="crit" />
          ) : (
            <AppText token="priceM" style={{ fontSize: 18, lineHeight: 22, color: stockColor }}>
              {stockText(product.availableQty)}
              <AppText token="caption" style={{ color: low ? stockColor : colors.ink3 }}>
                {`  ${t('catalog.stockLeft')}`}
              </AppText>
            </AppText>
          )}
        </View>
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
  const summary = usePosSummary();
  const items = useMemo(() => (query.data?.pages ?? []).flatMap((p) => p.items), [query.data]);

  if (status === 'signedOut') return <Redirect href="/(auth)/sign-in" />;

  const filters: { key: StockFilter; label: string }[] = [
    { key: 'all', label: t('catalog.filterAll') },
    { key: 'low', label: t('catalog.filterLow') },
    { key: 'out', label: t('catalog.filterOut') },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.ground }}>
      <View
        style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, gap: 14, paddingBottom: 12 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText token="titleL">{t('catalog.title')}</AppText>
            <AppText token="caption" color="ink3">
              {/* items.length is only what has been PAGED IN, so unfiltered it
                  under-reports the catalogue — it read "20 products" against a
                  real 26. The summary carries the true total; the loaded count
                  is only meaningful once a search or filter narrows things. */}
              {debounced || filter !== 'all'
                ? `${items.length} shown`
                : `${summary.data?.productCount ?? items.length} products`}
            </AppText>
          </View>
          {/* The catalogue had no way in: creating a product meant authoring a
              CSV and using bulk import for a single new SKU. */}
          <Pressable
            onPress={() => router.push('/product/new')}
            accessibilityRole="button"
            accessibilityLabel="Add product"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 16,
              paddingVertical: 11,
              borderRadius: 999,
              backgroundColor: colors.ink,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            })}
          >
            <AppText token="titleM" style={{ color: colors.surface, lineHeight: 20 }}>
              +
            </AppText>
            <AppText token="labelM" style={{ color: colors.surface }}>
              Add product
            </AppText>
          </Pressable>
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
