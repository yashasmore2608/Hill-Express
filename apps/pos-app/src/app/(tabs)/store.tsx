import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { AppText, Button, Card, ThemeToggle, useTheme } from '@hillexpress/ui';
import { useAuth } from '../../lib/auth';
import { usePatchStore, usePosSummary } from '../../lib/pos';

/**
 * Store — everything that is not an order or a product.
 *
 * The old home screen was a list of navigation rows to other screens; the tab
 * bar does that job now, so what remains here is what home actually OWNED:
 * packing time, the stock counters, and the account controls that used to sit
 * on their own screen. Nothing was dropped in the move.
 */

function Counter({ label, value, tone }: { label: string; value: number; tone?: 'warn' | 'crit' }) {
  const { colors } = useTheme();
  const color = tone === 'crit' ? colors.critical : tone === 'warn' ? colors.warning : colors.ink;
  return (
    <Card style={{ flex: 1, padding: 14, gap: 2 }}>
      <AppText token="displayL" style={{ color, fontSize: 26, lineHeight: 32 }}>
        {value}
      </AppText>
      <AppText token="caption" color="ink2">
        {label}
      </AppText>
    </Card>
  );
}

function PrepButton({ by, onPress }: { by: number; onPress: (by: number) => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => onPress(by)}
      accessibilityRole="button"
      accessibilityLabel={by < 0 ? 'Less packing time' : 'More packing time'}
      style={{
        width: 48,
        height: 48,
        borderRadius: 999,
        backgroundColor: colors.surface2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AppText token="titleM">{by < 0 ? '\u2212' : '+'}</AppText>
    </Pressable>
  );
}

export default function Store() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { data } = usePosSummary();
  const patchStore = usePatchStore();

  const store = data?.store;
  const prep = store?.defaultPrepMin ?? 15;

  // Bounds mirror patchStoreSchema (5–120) so the buttons can never send a
  // value the API will reject.
  const stepPrep = (by: number) => {
    const next = Math.min(120, Math.max(5, prep + by));
    if (next === prep) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    patchStore.mutate({ defaultPrepMin: next });
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.ground }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 32,
        gap: 14,
        // Same column cap as Orders — see MAX_CONTENT there.
        width: '100%',
        maxWidth: 640,
        alignSelf: 'center',
      }}
      showsVerticalScrollIndicator={false}
    >
      <Card elevated style={{ gap: 4 }}>
        <AppText token="titleM" numberOfLines={2}>
          {store?.name ?? ''}
        </AppText>
        <AppText token="caption" color="ink3">
          {store?.code} · {user?.phone}
        </AppText>
      </Card>

      {/* Packing time keeps its stepper: it moves in fives between 5 and 120,
          so typing would be more work, not less. */}
      <Card style={{ gap: 12 }}>
        <View style={{ gap: 2 }}>
          <AppText token="labelM">{t('home.prepTime')}</AppText>
          <AppText token="caption" color="ink3">
            {t('home.prepHint')}
          </AppText>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <PrepButton by={-5} onPress={stepPrep} />
          <AppText token="priceL" style={{ flex: 1, textAlign: 'center' }}>
            {t('home.prepMinutes', { min: prep })}
          </AppText>
          <PrepButton by={+5} onPress={stepPrep} />
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Counter label={t('home.products')} value={data?.productCount ?? 0} />
        <Counter label={t('home.lowStock')} value={data?.lowStockCount ?? 0} tone="warn" />
        <Counter label={t('home.outOfStock')} value={data?.outOfStockCount ?? 0} tone="crit" />
      </View>

      <Card style={{ gap: 12 }}>
        <View style={{ gap: 2 }}>
          <AppText token="labelM">{t('account.appearance')}</AppText>
          <AppText token="caption" color="ink3">
            {t('account.appearanceHint')}
          </AppText>
        </View>
        <ThemeToggle />
      </Card>

      <Button label={t('home.import')} variant="secondary" onPress={() => router.push('/import')} />
      <Button label={t('home.signOut')} variant="critical" onPress={() => void signOut()} />
    </ScrollView>
  );
}
