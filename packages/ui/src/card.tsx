import { View, type ViewProps } from 'react-native';
import { radius } from '@hillexpress/shared';
import { useTheme } from './theme-context';

interface CardProps extends ViewProps {
  /** Soft ambient shadow — list cards and floating surfaces. */
  elevated?: boolean;
  padded?: boolean;
}

/** The one card. Surface + hairline + radius.l everywhere — no ad-hoc boxes. */
export function Card({ elevated, padded = true, style, ...rest }: CardProps) {
  const { colors, mode } = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.l,
          borderWidth: 1,
          borderColor: colors.line,
          ...(padded ? { padding: 16 } : {}),
          ...(elevated
            ? {
                elevation: mode === 'dark' ? 0 : 3,
                shadowColor: '#0A1611',
                shadowOpacity: 0.07,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 6 },
              }
            : {}),
        },
        style,
      ]}
    />
  );
}
