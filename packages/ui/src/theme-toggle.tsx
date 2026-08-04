import { Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { ThemeMode } from '@hillexpress/shared';
import { AppText } from './app-text';
import { useTheme } from './theme-context';

const OPTIONS: Array<{ mode: ThemeMode; icon: string; label: string }> = [
  { mode: 'light', icon: '☀️', label: 'Light' },
  { mode: 'dark', icon: '🌙', label: 'Dark' },
];

/**
 * Segmented light/dark switch. Renders nothing when the app pins a mode,
 * so the driver app doesn't offer a control that would do nothing.
 */
export function ThemeToggle() {
  const { mode, colors, canToggle, setMode } = useTheme();
  if (!canToggle) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surface2,
        borderRadius: 999,
        padding: 4,
        gap: 4,
      }}
    >
      {OPTIONS.map((o) => {
        const active = mode === o.mode;
        return (
          <Pressable
            key={o.mode}
            accessibilityRole="button"
            accessibilityLabel={`${o.label} theme`}
            accessibilityState={{ selected: active }}
            onPress={() => {
              void Haptics.selectionAsync();
              setMode(o.mode);
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: active ? colors.surface : 'transparent',
              transform: [{ scale: pressed ? 0.96 : 1 }],
            })}
          >
            <AppText token="caption">{o.icon}</AppText>
            <AppText token="labelM" color={active ? 'ink' : 'ink3'}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
