import { Pressable, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Button, Card, Screen, ThemeToggle, useTheme } from '@hillexpress/ui';
import { useAuth } from '../lib/auth';
import { useCartStore } from '../lib/cart';
import { useAddresses } from '../lib/catalog';

function Row({ icon, label, hint, onPress }: { icon: string; label: string; hint?: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: `${colors.ink}11` }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 15,
        paddingHorizontal: 16,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <AppText token="titleM">{icon}</AppText>
      <View style={{ flex: 1, gap: 1 }}>
        <AppText token="bodyL">{label}</AppText>
        {hint ? (
          <AppText token="caption" color="ink3">
            {hint}
          </AppText>
        ) : null}
      </View>
      <AppText token="bodyM" color="ink3">
        ›
      </AppText>
    </Pressable>
  );
}

export default function Account() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { status, user, signOut } = useAuth();
  const clearCart = useCartStore((s) => s.clear);
  const { data: addresses } = useAddresses();

  if (status === 'signedOut') return <Redirect href="/(auth)/sign-in" />;

  return (
    <Screen title={t('account.title')} onBack={() => router.back()}>
      {/* Identity */}
      <Card elevated style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 999,
            backgroundColor: colors.mossSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText token="titleL" color="moss">
            {(user?.phone ?? '').slice(-2)}
          </AppText>
        </View>
        <View style={{ gap: 2 }}>
          <AppText token="caption" color="ink3">
            {t('account.signedInAs')}
          </AppText>
          <AppText token="titleM">{user?.phone}</AppText>
        </View>
      </Card>

      <Card padded={false} style={{ overflow: 'hidden' }}>
        <Row icon="🧾" label={t('orders.title')} onPress={() => router.push('/orders')} />
        <View style={{ height: 1, backgroundColor: colors.line, marginLeft: 52 }} />
        <Row
          icon="📍"
          label={t('account.addresses')}
          hint={t('account.addressCount', { count: addresses?.length ?? 0 })}
          onPress={() => router.push('/address/new')}
        />
      </Card>

      <Card style={{ gap: 12 }}>
        <View style={{ gap: 2 }}>
          <AppText token="labelM">{t('account.appearance')}</AppText>
          <AppText token="caption" color="ink3">
            {t('account.appearanceHint')}
          </AppText>
        </View>
        <ThemeToggle />
      </Card>

      <Button
        label={t('account.signOut')}
        variant="critical"
        onPress={() => {
          clearCart();
          void signOut();
        }}
      />

      <AppText token="caption" color="ink3" style={{ textAlign: 'center' }}>
        {t('account.version')}
      </AppText>
    </Screen>
  );
}
