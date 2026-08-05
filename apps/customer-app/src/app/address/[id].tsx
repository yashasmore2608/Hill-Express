import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '@hillexpress/ui';
import { useAuth } from '../../lib/auth';
import { useAddresses } from '../../lib/catalog';
import { AddressForm } from '../../components/address-form';
import { ListSkeleton } from '../../components/skeletons';

export default function EditAddress() {
  const { t } = useTranslation();
  const router = useRouter();
  const { status } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: addresses, isPending } = useAddresses();

  if (status === 'signedOut') return <Redirect href="/(auth)/sign-in" />;
  const existing = addresses?.find((a) => a.id === id);

  return (
    <Screen title={t('address.editTitle')} onBack={() => router.back()}>
      {isPending || !existing ? (
        <ListSkeleton rows={3} height={90} />
      ) : (
        <AddressForm existing={existing} onDone={() => router.back()} />
      )}
    </Screen>
  );
}
