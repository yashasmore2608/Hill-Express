import { Pressable, type PressableProps, type ViewStyle } from 'react-native';
import { radius, touchTarget } from '@hillexpress/shared';
import { AppText } from './app-text';
import { useTheme } from './theme-context';

interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'critical';
  /** Driver app passes 'driver' → 56dp min target instead of 48. */
  target?: keyof typeof touchTarget;
  style?: ViewStyle;
}

export function Button({
  label,
  variant = 'primary',
  target = 'default',
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();

  const bg: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: colors.moss,
    secondary: colors.surface2,
    ghost: 'transparent',
    critical: colors.criticalSoft,
  };
  const fg: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: colors.onMoss,
    secondary: colors.ink,
    ghost: colors.moss,
    critical: colors.critical,
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      // Material ripple on Android — never a bare opacity fade.
      android_ripple={{ color: `${colors.ink}22`, borderless: false }}
      style={({ pressed }) => [
        {
          minHeight: touchTarget[target],
          borderRadius: radius.m,
          paddingHorizontal: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: bg[variant],
          opacity: disabled ? 0.45 : pressed ? 0.92 : 1,
          // Press feedback: ripple + a 0.98 settle — reads as physical, not painted.
          transform: [{ scale: pressed ? 0.98 : 1 }],
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: colors.line2,
        },
        style,
      ]}
      {...rest}
    >
      <AppText token="labelM" style={{ color: fg[variant] }}>
        {label}
      </AppText>
    </Pressable>
  );
}
