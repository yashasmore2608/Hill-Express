import { View } from 'react-native';
import { radius } from '@hillexpress/shared';
import { AppText } from './app-text';
import { useTheme } from './theme-context';

type Tone = 'ok' | 'warn' | 'crit' | 'accent' | 'neutral';

interface StatusPillProps {
  /** Colour is never the only signal — the label always carries the meaning. */
  label: string;
  tone: Tone;
}

/**
 * Semantic status — a register deliberately separate from the brand accent.
 * `accent` (ember) is reserved for things IN MOTION: out-for-delivery, live ETA.
 */
export function StatusPill({ label, tone }: StatusPillProps) {
  const { colors } = useTheme();

  const map: Record<Tone, { bg: string; fg: string }> = {
    ok: { bg: colors.mossSoft, fg: colors.ok },
    warn: { bg: colors.warningSoft, fg: colors.warning },
    crit: { bg: colors.criticalSoft, fg: colors.critical },
    accent: { bg: colors.emberSoft, fg: colors.ember },
    neutral: { bg: colors.surface2, fg: colors.ink2 },
  };
  const t = map[tone];

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: t.bg,
        borderRadius: radius.pill,
        paddingHorizontal: 9,
        paddingVertical: 4,
      }}
    >
      <AppText token="micro" style={{ color: t.fg }}>
        {label}
      </AppText>
    </View>
  );
}
