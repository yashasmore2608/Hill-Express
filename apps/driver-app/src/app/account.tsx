import { View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { formatINR, paise } from '@hillexpress/shared';
import { AppText, Button, Card, Screen, ThemeToggle, useTheme } from '@hillexpress/ui';
import { useAuth } from '../lib/auth';
import { useDriverSummary } from '../lib/driver';

export default function Account() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { status, signOut } = useAuth();
  const { data: me } = useDriverSummary();

  if (status === 'signedOut') return <Redirect href="/(auth)/sign-in" />;

  return (
    <Screen title={t('common.appName')} onBack={() => router.back()}>
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
          <AppText token="titleL">🛵</AppText>
        </View>
        <View style={{ gap: 2, flex: 1 }}>
          <AppText token="titleM">{me?.name ?? ''}</AppText>
          <AppText token="caption" color="ink3">
            {t('account.deliveredTotal', { count: me?.deliveredToday ?? 0 })}
          </AppText>
        </View>
      </Card>

      <Card style={{ gap: 4 }}>
        <AppText token="caption" color="ink2">
          {t('home.codCarrying')}
        </AppText>
        <AppText token="displayL" color="ember">
          {formatINR(paise(me?.codOutstandingPaise ?? 0))}
        </AppText>
        <AppText token="caption" color="ink3">
          {t('home.codLimit', { limit: formatINR(paise(me?.codLimitPaise ?? 0)) })}
        </AppText>
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
