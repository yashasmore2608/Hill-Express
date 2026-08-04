import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './app-text';
import { IconButton } from './icon-button';
import { useTheme } from './theme-context';

interface ScreenProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  /** Right-aligned header slot (account button, actions). */
  right?: ReactNode;
  /** Static screens pass false to own their scrolling (FlashList etc.). */
  scroll?: boolean;
  /** Extra bottom padding for floating bars. */
  bottomInset?: number;
  children: ReactNode;
}

/**
 * Every screen's chassis: real safe-area insets (notches, gesture bars),
 * the standard header row, consistent gutters. Screens never hardcode
 * paddingTop again.
 */
export function Screen({
  title,
  subtitle,
  onBack,
  right,
  scroll = true,
  bottomInset = 0,
  children,
}: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const header =
    title || onBack || right ? (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 20,
          paddingBottom: 12,
        }}
      >
        {onBack ? <IconButton icon="←" label="Back" onPress={onBack} /> : null}
        <View style={{ flex: 1, gap: 2 }}>
          {title ? (
            <AppText token="titleL" numberOfLines={1}>
              {title}
            </AppText>
          ) : null}
          {subtitle ? (
            <AppText token="caption" color="ink3" numberOfLines={1}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {right}
      </View>
    ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.ground, paddingTop: insets.top + 12 }}>
      {header}
      {scroll ? (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 32 + bottomInset,
            gap: 16,
          }}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
      )}
    </View>
  );
}
