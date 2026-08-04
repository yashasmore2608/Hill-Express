import { Text, type TextProps, type TextStyle } from 'react-native';
import { textStyle, type TypeTokenName, type ColorToken } from '@hillexpress/shared';
import { useTheme } from './theme-context';

interface AppTextProps extends TextProps {
  /** One of the ten type tokens. Anything not on the scale does not get built. */
  token?: TypeTokenName;
  /** Named color from the ramp — resolves per theme automatically. */
  color?: ColorToken;
}

export function AppText({ token = 'bodyM', color = 'ink', style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  return (
    <Text
      {...rest}
      style={[textStyle(token) as TextStyle, { color: colors[color] }, style]}
    />
  );
}
