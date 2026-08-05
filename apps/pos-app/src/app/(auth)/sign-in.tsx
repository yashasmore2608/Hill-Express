import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Button, useTheme } from '@hillexpress/ui';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

export default function SignIn() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { requestOtp } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [digits, setDigits] = useState('');
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = INDIAN_MOBILE.test(digits);

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await requestOtp(`+91${digits}`);
      router.push({
        pathname: '/(auth)/otp',
        params: { phone: digits, devOtp: res.devOtp ?? '' },
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('common.retry'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.ground }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 72,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 32,
          gap: 36,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown.duration(280)} style={{ gap: 14 }}>
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 18,
              backgroundColor: colors.spruce,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AppText token="displayL" style={{ fontSize: 32, lineHeight: 40 }}>
              🏔️
            </AppText>
          </View>
          <AppText token="micro" color="moss">
            {t('common.appName')}
          </AppText>
          <AppText token="displayL" style={{ fontSize: 34, lineHeight: 40 }}>
            {t('auth.title')}
          </AppText>
          <AppText token="bodyL" color="ink2">
            {t('auth.subtitle')}
          </AppText>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(280).delay(80)} style={{ gap: 10 }}>
          <AppText token="labelM" color="ink2">
            {t('auth.phoneLabel')}
          </AppText>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: colors.surface,
              borderWidth: focused || error ? 2 : 1,
              borderColor: error ? colors.critical : focused ? colors.moss : colors.line2,
              borderRadius: 14,
              paddingHorizontal: 16,
              minHeight: 58,
            }}
          >
            <AppText token="titleM" color="ink3">
              +91
            </AppText>
            <View style={{ width: 1, height: 24, backgroundColor: colors.line2 }} />
            <TextInput
              value={digits}
              onChangeText={(v) => {
                setDigits(v.replace(/\D/g, '').slice(0, 10));
                setError(null);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              keyboardType="number-pad"
              maxLength={10}
              placeholder={t('auth.phonePlaceholder')}
              placeholderTextColor={colors.ink3}
              autoFocus
              onSubmitEditing={submit}
              style={{
                flex: 1,
                fontFamily: 'PlusJakartaSans-SemiBold',
                fontSize: 18,
                letterSpacing: 1.2,
                color: colors.ink,
                paddingVertical: 15,
              }}
            />
          </View>
          {error ? (
            <AppText token="caption" color="critical">
              {error}
            </AppText>
          ) : null}
        </Animated.View>

        <View style={{ flex: 1 }} />

        <Animated.View entering={FadeInDown.duration(280).delay(140)} style={{ gap: 14 }}>
          <Button label={t('auth.continue')} onPress={submit} disabled={!valid || busy} />
          <AppText token="caption" color="ink3" style={{ textAlign: 'center' }}>
            {t('auth.terms')}
          </AppText>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
