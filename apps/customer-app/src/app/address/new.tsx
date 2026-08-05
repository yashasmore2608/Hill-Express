import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '@hillexpress/ui';
import { useAuth } from '../../lib/auth';
import { AddressForm } from '../../components/address-form';

export default function NewAddress() {
  const { t } = useTranslation();
  const router = useRouter();
  const { status } = useAuth();

  if (status === 'signedOut') return <Redirect href="/(auth)/sign-in" />;

  return (
    <Screen title={t('address.title')} onBack={() => router.back()}>
      <AddressForm onDone={() => router.back()} />
    </Screen>
  );
}
