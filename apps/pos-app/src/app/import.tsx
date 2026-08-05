import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { AppText, Button, Card, Screen, StatusPill, useTheme } from '@hillexpress/ui';
import { useAuth } from '../lib/auth';
import { useImportCsv } from '../lib/pos';

export default function ImportScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { status } = useAuth();
  const importCsv = useImportCsv();

  const [file, setFile] = useState<{ name: string; content: string } | null>(null);

  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'text/plain'],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    const content = await fetch(asset.uri).then((r) => r.text());
    setFile({ name: asset.name, content });
    importCsv.reset();
  };

  const run = () => {
    if (!file) return;
    importCsv.mutate(
      { fileName: file.name, content: file.content },
      {
        onSuccess: (r) =>
          void Haptics.notificationAsync(
            r.errorRows === 0
              ? Haptics.NotificationFeedbackType.Success
              : Haptics.NotificationFeedbackType.Warning,
          ),
      },
    );
  };

  if (status === 'signedOut') return <Redirect href="/(auth)/sign-in" />;
  const result = importCsv.data;

  return (
    <Screen title={t('import.title')} onBack={() => router.back()}>
      <Card style={{ backgroundColor: colors.surface2, borderColor: colors.line, gap: 8 }}>
        <AppText token="labelM" color="ink2">
          📄 CSV format
        </AppText>
        <AppText token="caption" color="ink2">
          {t('import.hint')}
        </AppText>
      </Card>

      {file ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <AppText token="titleL">📄</AppText>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText token="bodyM" numberOfLines={1}>
              {file.name}
            </AppText>
            <AppText token="caption" color="ink3">
              {(file.content.length / 1024).toFixed(1)} KB
            </AppText>
          </View>
        </Card>
      ) : null}

      <Button
        label={file ? '↻  ' + t('import.pick') : t('import.pick')}
        variant="secondary"
        onPress={() => void pick()}
      />

      {file ? (
        <Button
          label={importCsv.isPending ? t('import.running') : t('import.run', { name: file.name })}
          onPress={run}
          disabled={importCsv.isPending}
        />
      ) : null}

      {importCsv.isError ? (
        <AppText token="caption" color="critical">
          {importCsv.error instanceof Error ? importCsv.error.message : t('common.retry')}
        </AppText>
      ) : null}

      {result ? (
        <Animated.View entering={FadeInDown.duration(220)}>
          <Card elevated style={{ gap: 12 }}>
            <View style={{ gap: 4 }}>
              <AppText token="displayL" color={result.errorRows === 0 ? 'ok' : 'warning'}>
                {result.successRows}/{result.totalRows}
              </AppText>
              <AppText token="bodyM" color="ink2">
                {t('import.done', { success: result.successRows, total: result.totalRows })}
              </AppText>
              <AppText token="caption" color="ink3">
                {t('import.breakdown', { created: result.created, updated: result.updated })}
              </AppText>
            </View>

            {result.errorRows > 0 ? (
              <View style={{ gap: 8 }}>
                <StatusPill label={t('import.failedRows', { count: result.errorRows })} tone="crit" />
                <View style={{ gap: 6 }}>
                  {result.errors.map((e) => (
                    <View
                      key={e.rowNumber}
                      style={{
                        backgroundColor: colors.criticalSoft,
                        borderRadius: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 7,
                      }}
                    >
                      <AppText token="caption" color="critical">
                        {t('import.rowError', { row: e.rowNumber, message: e.message })}
                      </AppText>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <StatusPill label="✓  All rows imported" tone="ok" />
            )}
          </Card>
        </Animated.View>
      ) : null}
    </Screen>
  );
}
