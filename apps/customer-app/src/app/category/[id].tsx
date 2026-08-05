import { useEffect, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { ProductDto } from '@hillexpress/shared';
import { AppText, IconButton, useTheme } from '@hillexpress/ui';
import { useCategories, useDefaultStore, useProducts } from '../../lib/catalog';
import { categoryVisual } from '../../lib/emoji';
import { ProductCard } from '../../components/product-card';
import { CartBar } from '../../components/cart-bar';
import { ProductGridSkeleton } from '../../components/skeletons';

export default function CategoryScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; name?: string; focus?: string }>();
  const isAll = params.id === 'all';

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const store = useDefaultStore();
  const { data: categories } = useCategories(store?.id);
  const category = categories?.find((c) => c.id === params.id);
  const categoryName = params.name ?? category?.name ?? '';

  // Typing a search widens to the whole store — finding "atta" must not
  // depend on which category screen you happened to be standing in.
  const query = useProducts(store?.id, {
    categoryId: isAll || debounced ? undefined : params.id,
    search: debounced || undefined,
  });

  const items: ProductDto[] = useMemo(
    () => (query.data?.pages ?? []).flatMap((p) => p.items),
    [query.data],
  );

  const catById = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c.name])),
    [categories],
  );

  const title = isAll ? t('catalog.all') : categoryName;

  return (
    <View style={{ flex: 1, backgroundColor: colors.ground }}>
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, gap: 14, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconButton icon="←" label={t('common.back')} onPress={() => router.back()} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText token="titleL" numberOfLines={1}>
              {debounced ? t('catalog.results') : title}
            </AppText>
            <AppText token="caption" color="ink3">
              {t('home.items', { count: items.length })}
            </AppText>
          </View>
          {!debounced && categoryName ? (
            <AppText token="displayL" style={{ fontSize: 28, lineHeight: 34 }}>
              {categoryVisual(categoryName).emoji}
            </AppText>
          ) : null}
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
            minHeight: 48,
          }}
        >
          <AppText token="bodyM">🔍</AppText>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('home.searchPlaceholder')}
            placeholderTextColor={colors.ink3}
            autoFocus={params.focus === '1'}
            returnKeyType="search"
            style={{
              flex: 1,
              fontFamily: 'PlusJakartaSans-Regular',
              fontSize: 15,
              color: colors.ink,
              paddingVertical: 12,
            }}
          />
          {search.length > 0 ? (
            <Pressable accessibilityLabel={t('catalog.clear')} onPress={() => setSearch('')}>
              <AppText token="bodyM" color="ink3">
                ✕
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </View>

      {query.isPending ? (
        <View style={{ paddingHorizontal: 20 }}>
          <ProductGridSkeleton />
        </View>
      ) : (
        <FlashList
          data={items}
          numColumns={2}
          keyExtractor={(p) => p.id}
          renderItem={({ item, index }) => (
            <View style={{ flex: 1, padding: 6 }}>
              <ProductCard
                product={item}
                categoryName={catById.get(item.categoryId) ?? ''}
                index={index}
              />
            </View>
          )}
          contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 120 }}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          onEndReachedThreshold={0.6}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={{ padding: 48, alignItems: 'center', gap: 10 }}>
              <AppText token="displayL" style={{ fontSize: 44, lineHeight: 56 }}>
                🔍
              </AppText>
              <AppText token="titleM" style={{ textAlign: 'center' }}>
                {debounced ? t('catalog.empty', { search: debounced }) : t('catalog.emptyCategory')}
              </AppText>
              <AppText token="caption" color="ink3" style={{ textAlign: 'center' }}>
                {t('catalog.emptyHint')}
              </AppText>
            </View>
          }
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <View style={{ padding: 12 }}>
                <ProductGridSkeleton rows={1} />
              </View>
            ) : null
          }
        />
      )}
      <CartBar />
    </View>
  );
}
