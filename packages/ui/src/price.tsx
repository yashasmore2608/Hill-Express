import { View, type TextStyle } from 'react-native';
import { formatINR, paise, type Paise } from '@hillexpress/shared';
import { AppText } from './app-text';
import { useTheme } from './theme-context';

interface PriceProps {
  /** Integer paise — the ONLY money input type anywhere in the UI. */
  amountPaise: number;
  /** Strike-through MRP, shown when greater than the price. */
  mrpPaise?: number | null;
  size?: 'l' | 'm';
}

/**
 * The sole sanctioned way to render money. Indian digit grouping (2,2,3),
 * tabular figures so lists never go ragged and totals never reflow.
 */
export function Price({ amountPaise, mrpPaise, size = 'm' }: PriceProps) {
  const { colors } = useTheme();
  const value: Paise = paise(amountPaise);
  const showMrp = mrpPaise != null && mrpPaise > amountPaise;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
      <AppText token={size === 'l' ? 'priceL' : 'priceM'}>{formatINR(value)}</AppText>
      {showMrp ? (
        <AppText
          token="caption"
          color="ink3"
          style={{ textDecorationLine: 'line-through' } as TextStyle}
        >
          {formatINR(paise(mrpPaise))}
        </AppText>
      ) : null}
    </View>
  );
}
