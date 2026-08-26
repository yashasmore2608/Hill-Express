import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { UNITS, type Unit } from '@hillexpress/shared';
import { AppText, Button, Card, Screen, useTheme } from '@hillexpress/ui';
import { useAuth } from '../../lib/auth';
import { useCreateProduct, usePosCategories } from '../../lib/pos';

/**
 * Add one product.
 *
 * The first version asked for nine fields across two cards, including SKU and a
 * low-stock threshold — system concerns a shopkeeper adding one packet of
 * biscuits should never have to think about. Six things are asked now, and all
 * six are facts about the product itself:
 *
 *   Name · Category · Sold as · Pack size · Price · Opening stock
 *
 * SKU is derived server-side (AT-001, DA-002…) in the same house style the
 * import files use. MRP and the low-stock threshold moved behind "More
 * options" — both have sensible defaults and both are editable afterwards on
 * the product screen, so neither belongs in the path of a first save.
 */
export default function NewProduct() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { status } = useAuth();
  const create = useCreateProduct();
  const categories = usePosCategories();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [newCategory, setNewCategory] = useState(false);
  const [unit, setUnit] = useState<Unit>('PIECE');
  const [packSize, setPackSize] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');

  const [more, setMore] = useState(false);
  const [mrp, setMrp] = useState('');
  const [lowAt, setLowAt] = useState('');

  if (status === 'signedOut') return <Redirect href="/(auth)/sign-in" />;

  const pricePaise = Math.round(parseFloat(price) * 100);
  const mrpPaise = mrp.trim() === '' ? null : Math.round(parseFloat(mrp) * 100);
  const stockN = stock.trim() === '' ? 0 : parseInt(stock, 10);

  const ready =
    name.trim() !== '' &&
    category.trim() !== '' &&
    packSize.trim() !== '' &&
    Number.isFinite(pricePaise) &&
    pricePaise >= 100 &&
    Number.isFinite(stockN) &&
    stockN >= 0;

  // MRP below the selling price would print a discount that is really a markup.
  const mrpBelowPrice = mrpPaise != null && Number.isFinite(pricePaise) && mrpPaise < pricePaise;

  const submit = () => {
    if (!ready || mrpBelowPrice) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    create.mutate(
      {
        name: name.trim(),
        category: category.trim(),
        unit,
        packSize: packSize.trim(),
        pricePaise,
        ...(mrpPaise != null ? { mrpPaise } : {}),
        stock: stockN,
        ...(lowAt.trim() !== '' ? { lowStockAt: parseInt(lowAt, 10) } : {}),
      },
      {
        onSuccess: (product) => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.replace(`/product/${product.id}`);
        },
      },
    );
  };

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    opts: { keyboard?: 'default' | 'decimal-pad' | 'number-pad'; placeholder?: string } = {},
  ) => (
    <View style={{ gap: 6, flex: 1 }}>
      <AppText token="labelM" color="ink2">
        {label}
      </AppText>
      <View
        style={{
          backgroundColor: colors.surface2,
          borderWidth: 1,
          borderColor: colors.line2,
          borderRadius: 12,
          paddingHorizontal: 14,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType={opts.keyboard ?? 'default'}
          placeholder={opts.placeholder}
          // Every field has a real label above it, so the placeholder is a hint
          // and must not read as a filled value.
          placeholderTextColor={colors.line2}
          accessibilityLabel={label}
          style={{
            fontFamily: 'PlusJakartaSans-Bold',
            fontSize: 17,
            color: colors.ink,
            paddingVertical: 13,
          }}
        />
      </View>
    </View>
  );

  const chip = (label: string, on: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 999,
        backgroundColor: on ? colors.ink : colors.surface2,
      }}
    >
      <AppText token="labelM" style={{ color: on ? colors.surface : colors.ink2 }}>
        {label}
      </AppText>
    </Pressable>
  );

  return (
    <Screen title="Add product" onBack={() => router.back()}>
      <Card style={{ gap: 16 }}>
        {field('Name', name, setName, { placeholder: 'Aashirvaad Select Atta' })}

        {/* Category: pick, don't type. The server does find-or-create on the
            NAME, so "Dairy " or "dairy" would quietly become a second category
            sitting beside the real one. */}
        <View style={{ gap: 6 }}>
          <AppText token="labelM" color="ink2">
            Category
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {(categories.data ?? []).map((c) =>
              chip(c.name, !newCategory && category === c.name, () => {
                setNewCategory(false);
                setCategory(c.name);
              }),
            )}
            {chip('+ New', newCategory, () => {
              setNewCategory(true);
              setCategory('');
            })}
          </View>
          {newCategory
            ? field('New category name', category, setCategory, { placeholder: 'Frozen' })
            : null}
        </View>

        <View style={{ gap: 6 }}>
          <AppText token="labelM" color="ink2">
            Sold as
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {UNITS.map((u) => chip(u.toLowerCase(), unit === u, () => setUnit(u)))}
          </View>
        </View>

        {field('Pack size', packSize, setPackSize, { placeholder: '5 kg · 500 ml · 4 × 75 g' })}

        <View style={{ flexDirection: 'row', gap: 12 }}>
          {field('Price (₹)', price, setPrice, { keyboard: 'decimal-pad', placeholder: '315' })}
          {field('Opening stock', stock, setStock, { keyboard: 'number-pad', placeholder: '0' })}
        </View>
      </Card>

      <Pressable
        onPress={() => setMore((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: more }}
        style={{ paddingVertical: 12, alignItems: 'center' }}
      >
        <AppText token="labelM" color="moss">
          {more ? 'Fewer options' : 'More options'}
        </AppText>
      </Pressable>

      {more ? (
        <Card style={{ gap: 14 }}>
          {field('MRP (₹, optional)', mrp, setMrp, {
            keyboard: 'decimal-pad',
            placeholder: '348',
          })}
          {mrpBelowPrice ? (
            <AppText token="caption" color="critical">
              MRP is below the selling price — that would print as a markup, not a saving.
            </AppText>
          ) : null}
          {field('Low-stock alert at', lowAt, setLowAt, {
            keyboard: 'number-pad',
            placeholder: '5',
          })}
          <AppText token="caption" color="ink3">
            A product code is created automatically. Opening stock is written as the first ledger
            entry, so the count stays provable from day one.
          </AppText>
        </Card>
      ) : null}

      {create.isError ? (
        <AppText token="caption" color="critical">
          {create.error instanceof Error ? create.error.message : t('common.retry')}
        </AppText>
      ) : null}

      <Button
        label="Add to catalogue"
        onPress={submit}
        disabled={!ready || mrpBelowPrice || create.isPending}
      />
    </Screen>
  );
}
