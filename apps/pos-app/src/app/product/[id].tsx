import { useEffect, useState } from 'react';
import { Pressable, Switch, TextInput, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import type { ProductDto } from '@hillexpress/shared';
import { AppText, Button, Card, Screen, StatusPill, useTheme } from '@hillexpress/ui';
import { useAuth } from '../../lib/auth';
import { usePatchProduct, usePosProducts } from '../../lib/pos';
import { StockAdjust } from '../../components/stock-adjust';
import { ListSkeleton } from '../../components/skeletons';

export default function EditProduct() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { status } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  // The list query already holds the row — find it, no extra request.
  const listQuery = usePosProducts({});
  const product: ProductDto | undefined = listQuery.data?.pages
    .flatMap((p) => p.items)
    .find((p) => p.id === id);

  const patch = usePatchProduct();

  const [price, setPrice] = useState('');
  const [mrp, setMrp] = useState('');
  const [lowAt, setLowAt] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (product && price === '' && mrp === '') {
      setPrice(String(product.pricePaise / 100));
      setMrp(product.mrpPaise != null ? String(product.mrpPaise / 100) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  if (status === 'signedOut') return <Redirect href="/(auth)/sign-in" />;

  const save = () => {
    if (!product) return;
    const pricePaise = Math.round(parseFloat(price) * 100);
    const mrpPaise = mrp.trim() === '' ? null : Math.round(parseFloat(mrp) * 100);
    if (!Number.isFinite(pricePaise) || pricePaise <= 0) return;
    patch.mutate(
      {
        id: product.id,
        body: {
          pricePaise,
          mrpPaise,
          ...(lowAt.trim() !== '' ? { lowStockAt: parseInt(lowAt, 10) } : {}),
        },
      },
      {
        onSuccess: () => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setSaved(true);
          setTimeout(() => setSaved(false), 1600);
        },
      },
    );
  };

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    keyboard: 'decimal-pad' | 'number-pad',
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
          keyboardType={keyboard}
          placeholderTextColor={colors.ink3}
          style={{
            fontFamily: 'PlusJakartaSans-Bold',
            fontSize: 18,
            color: colors.ink,
            paddingVertical: 13,
          }}
        />
      </View>
    </View>
  );

  return (
    <Screen
      title={product?.name ?? ''}
      subtitle={product ? `${product.sku ?? '—'} · ${product.packSize}` : undefined}
      onBack={() => router.back()}
    >
      {!product ? (
        <ListSkeleton rows={3} height={90} />
      ) : (
        <>
          <Card style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {field(t('product.price'), price, setPrice, 'decimal-pad')}
              {field(t('product.mrp'), mrp, setMrp, 'decimal-pad')}
            </View>
            {field(t('product.lowStockAt'), lowAt, setLowAt, 'number-pad')}
            <Button
              label={saved ? `✓  ${t('product.saved')}` : t('common.save')}
              onPress={save}
              disabled={patch.isPending}
            />
          </Card>

          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText token="labelM">{t('product.visible')}</AppText>
              <AppText token="caption" color="ink3">
                {t('product.visibleHint')}
              </AppText>
            </View>
            <Switch
              value={product.isAvailable}
              onValueChange={(v) => patch.mutate({ id: product.id, body: { isAvailable: v } })}
              trackColor={{ false: colors.surface3, true: colors.moss }}
              thumbColor="#FFFFFF"
            />
          </Card>

          {/* Stock — ledgered, never a raw write */}
          <Card style={{ gap: 14 }}>
            <View style={{ gap: 3 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <AppText token="titleM">{t('product.stockTitle')}</AppText>
                <StatusPill
                  label={t('product.current', { n: product.availableQty })}
                  tone={product.availableQty === 0 ? 'crit' : product.lowStock ? 'warn' : 'ok'}
                />
              </View>
              <AppText token="caption" color="ink3">
                {t('product.stockHint')}
              </AppText>
            </View>
            <StockAdjust product={product} />
          </Card>
        </>
      )}
    </Screen>
  );
}
