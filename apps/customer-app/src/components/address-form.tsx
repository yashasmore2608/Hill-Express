import { useEffect, useState } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import type { AddressDto } from '@hillexpress/shared';
import { AppText, Button, Card, StatusPill, useTheme } from '@hillexpress/ui';
import { ApiError, apiFetch } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useServiceability } from '../lib/catalog';

function Field({ label, hint, ...input }: { label: string; hint?: string } & TextInputProps) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <AppText token="labelM" color="ink2">
        {label}
      </AppText>
      <View
        style={{
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.line2,
          borderRadius: 12,
          paddingHorizontal: 14,
        }}
      >
        <TextInput
          placeholderTextColor={colors.ink3}
          style={{
            fontFamily: 'PlusJakartaSans-Regular',
            fontSize: 15,
            color: colors.ink,
            paddingVertical: 13,
          }}
          {...input}
        />
      </View>
      {hint ? (
        <AppText token="caption" color="ink3">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

interface AddressFormProps {
  /** Present = edit mode; absent = create. */
  existing?: AddressDto;
  onDone: () => void;
}

/** One form for both add and edit — the fields and validation can't drift. */
export function AddressForm({ existing, onDone }: AddressFormProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const isEdit = Boolean(existing);

  const [label, setLabel] = useState(existing?.label ?? 'Home');
  const [house, setHouse] = useState(existing?.house ?? '');
  const [street, setStreet] = useState(existing?.street ?? '');
  const [landmark, setLandmark] = useState(existing?.landmark ?? '');
  const [city, setCity] = useState(existing?.city ?? '');
  const [pincode, setPincode] = useState(existing?.pincode ?? '');
  const [instructions, setInstructions] = useState(existing?.instructions ?? '');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    existing ? { lat: existing.lat, lng: existing.lng } : null,
  );
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate once the record arrives (edit screens render before the fetch).
  useEffect(() => {
    if (!existing) return;
    setLabel(existing.label);
    setHouse(existing.house);
    setStreet(existing.street);
    setLandmark(existing.landmark ?? '');
    setCity(existing.city);
    setPincode(existing.pincode);
    setInstructions(existing.instructions ?? '');
    setCoords({ lat: existing.lat, lng: existing.lng });
  }, [existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const serviceability = useServiceability(pincode);

  const useMyLocation = async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return;
    const pos = await Location.getCurrentPositionAsync({});
    setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const valid =
    house.trim() && street.trim() && city.trim() && /^[1-9]\d{5}$/.test(pincode);

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(isEdit ? `/addresses/${existing!.id}` : '/addresses', {
        method: isEdit ? 'PATCH' : 'POST',
        token: accessToken,
        body: {
          label,
          house: house.trim(),
          street: street.trim(),
          landmark: landmark.trim() || undefined,
          city: city.trim(),
          pincode,
          instructions: instructions.trim() || undefined,
          lat: coords?.lat ?? 31.1048,
          lng: coords?.lng ?? 77.1734,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ['addresses'] });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('common.retry'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!existing || busy) return;
    setBusy(true);
    try {
      await apiFetch(`/addresses/${existing.id}`, { method: 'DELETE', token: accessToken });
      await queryClient.invalidateQueries({ queryKey: ['addresses'] });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('common.retry'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <View style={{ gap: 8 }}>
        <AppText token="labelM" color="ink2">
          {t('address.labelField')}
        </AppText>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[
            { key: t('address.home'), icon: '🏠' },
            { key: t('address.work'), icon: '💼' },
          ].map((c) => {
            const active = label === c.key;
            return (
              <Pressable
                key={c.key}
                onPress={() => setLabel(c.key)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: active ? colors.moss : colors.surface,
                  borderWidth: 1,
                  borderColor: active ? colors.moss : colors.line2,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}
              >
                <AppText token="bodyM">{c.icon}</AppText>
                <AppText token="labelM" style={{ color: active ? colors.onMoss : colors.ink }}>
                  {c.key}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Card style={{ gap: 14 }}>
        <Field label={t('address.house')} value={house} onChangeText={setHouse} />
        <Field label={t('address.street')} value={street} onChangeText={setStreet} />
        <Field label={t('address.landmark')} value={landmark} onChangeText={setLandmark} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Field label={t('address.city')} value={city} onChangeText={setCity} />
          <Field
            label={t('address.pincode')}
            value={pincode}
            onChangeText={(v: string) => setPincode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
          />
        </View>
        {serviceability.data ? (
          <StatusPill
            label={
              serviceability.data.serviceable
                ? `✓  ${t('address.serviceable')}`
                : t('address.notServiceable')
            }
            tone={serviceability.data.serviceable ? 'ok' : 'crit'}
          />
        ) : null}
        <Field
          label={t('address.instructions')}
          hint={t('address.instructionsHint')}
          value={instructions}
          onChangeText={setInstructions}
        />
      </Card>

      <Button
        label={coords ? `📍  ${t('address.locationSet')}` : `📍  ${t('address.useLocation')}`}
        variant={coords ? 'ghost' : 'secondary'}
        onPress={() => void useMyLocation()}
      />

      {error ? (
        <AppText token="caption" color="critical">
          {error}
        </AppText>
      ) : null}

      <Button
        label={isEdit ? t('address.update') : t('address.save')}
        onPress={() => void save()}
        disabled={!valid || busy}
      />

      {isEdit ? (
        confirmDelete ? (
          <View style={{ gap: 8 }}>
            <AppText token="caption" color="critical">
              {t('address.deleteConfirm')}
            </AppText>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button label={t('address.delete')} variant="critical" onPress={() => void remove()} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label={t('address.keep')}
                  variant="secondary"
                  onPress={() => setConfirmDelete(false)}
                />
              </View>
            </View>
          </View>
        ) : (
          <Button
            label={t('address.delete')}
            variant="ghost"
            onPress={() => setConfirmDelete(true)}
          />
        )
      ) : null}
    </>
  );
}
