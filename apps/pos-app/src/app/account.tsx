import { View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Button, Card, Screen, ThemeToggle, useTheme } from '@hillexpress/ui';
import { useAuth } from '../lib/auth';
import { usePosSummary } from '../lib/pos';

export default function Account() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { status, user, signOut } = useAuth();
  const { data } = usePosSummary();

  if (status === 'signedOut') return <Redirect href="/(auth)/sign-in" />;

  return (
    <Screen title={t('common.appName')} onBack={() => router.back()}>
      <Card elevated style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            backgroundColor: colors.mossSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText token="titleL">🏪</AppText>
        </View>
        <View style={{ gap: 2, flex: 1 }}>
          <AppText token="titleM" numberOfLines={2}>
            {data?.store.name ?? ''}
          </AppText>
          <AppText token="caption" color="ink3">
            {data?.store.code} · {user?.phone}
          </AppText>
        </View>
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

      <Button label={t('home.signOut')} variant="critical" onPress={() => void signOut()} />
    </Screen>
  );
}
