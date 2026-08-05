import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { AppText, Button, useTheme } from '@hillexpress/ui';
import { LIMITS } from '@hillexpress/shared';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';

const RESEND_SECONDS = 30;

export default function Otp() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { requestOtp, verifyOtp } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ phone: string; devOtp?: string }>();
  const phone = typeof params.phone === 'string' ? params.phone : '';

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState(params.devOtp || '');
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const inputRef = useRef<TextInput>(null);

  // One hidden input drives four boxes — the numeric keyboard stays up and
  // paste/autofill work, which four separate inputs always break.
  const boxes = Array.from({ length: LIMITS.otpLength }, (_, i) => code[i] ?? '');

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const submit = async (value: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await verifyOtp(`+91${phone}`, value);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/');
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setCode('');
      setError(e instanceof ApiError ? e.message : t('common.retry'));
    } finally {
      setBusy(false);
    }
  };

  const onChange = (v: string) => {
    const clean = v.replace(/\D/g, '').slice(0, LIMITS.otpLength);
    setCode(clean);
    setError(null);
    if (clean.length === LIMITS.otpLength) void submit(clean);
  };

  const resend = async () => {
    if (resendIn > 0 || busy) return;
    try {
      const res = await requestOtp(`+91${phone}`);
      setDevOtp(res.devOtp ?? '');
      setResendIn(RESEND_SECONDS);
      setCode('');
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('common.retry'));
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.ground }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 72,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 32,
          gap: 32,
        }}
      >
        <Animated.View entering={FadeInDown.duration(260)} style={{ gap: 10 }}>
          <AppText token="displayL" style={{ fontSize: 32, lineHeight: 38 }}>
            {t('auth.otpTitle')}
          </AppText>
          <AppText token="bodyL" color="ink2">
            {t('auth.otpSubtitle', { phone })}
          </AppText>
          {devOtp ? (
            <View
              style={{
                alignSelf: 'flex-start',
                backgroundColor: colors.emberSoft,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 7,
              }}
            >
              <AppText token="caption" color="ember">
                {t('auth.devOtpHint', { otp: devOtp })}
              </AppText>
            </View>
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(260).delay(70)}>
          <Pressable onPress={() => inputRef.current?.focus()}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {boxes.map((ch, i) => {
                const active = i === code.length;
                return (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      height: 68,
                      borderRadius: 14,
                      borderWidth: active || ch ? 2 : 1,
                      borderColor: error
                        ? colors.critical
                        : active
                          ? colors.moss
                          : ch
                            ? colors.line2
                            : colors.line,
                      backgroundColor: colors.surface,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AppText token="displayL" style={{ fontSize: 28, lineHeight: 34 }}>
                      {ch}
                    </AppText>
                  </View>
                );
              })}
            </View>
            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={onChange}
              keyboardType="number-pad"
              maxLength={LIMITS.otpLength}
              autoFocus
              caretHidden
              style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
            />
          </Pressable>
          {error ? (
            <AppText token="caption" color="critical" style={{ marginTop: 10 }}>
              {error}
            </AppText>
          ) : null}
        </Animated.View>

        <View style={{ flex: 1 }} />

        <View style={{ gap: 10 }}>
          <Button
            label={t('auth.verify')}
            onPress={() => void submit(code)}
            disabled={code.length !== LIMITS.otpLength || busy}
          />
          <Button
            label={resendIn > 0 ? t('auth.resendIn', { s: resendIn }) : t('auth.resend')}
            variant="ghost"
            onPress={() => void resend()}
            disabled={resendIn > 0 || busy}
          />
          <Button label={t('auth.changeNumber')} variant="ghost" onPress={() => router.back()} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
