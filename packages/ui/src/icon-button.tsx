import { Pressable, type PressableProps } from 'react-native';
import { AppText } from './app-text';
import { useTheme } from './theme-context';

interface IconButtonProps extends Omit<PressableProps, 'children'> {
  icon: string;
  label: string; // accessibility — never optional
  size?: number;
}

/** Circular tap target (back, menu, close). Ripple + scale, ≥44dp. */
export function IconButton({ icon, label, size = 44, style, ...rest }: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      android_ripple={{ color: `${colors.ink}22`, borderless: true }}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: 999,
          backgroundColor: colors.surface2,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
        typeof style === 'object' ? style : null,
      ]}
      {...rest}
    >
      <AppText token="titleM">{icon}</AppText>
    </Pressable>
  );
}
