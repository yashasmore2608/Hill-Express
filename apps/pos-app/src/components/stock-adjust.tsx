import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import type { ProductDto } from '@hillexpress/shared';
import { AppText, Button, useTheme } from '@hillexpress/ui';
import { useAdjustStock, type StockMove } from '../lib/pos';

/**
 * Stock movement, typed.
 *
 * The old control was four buttons — −10 −1 +1 +10 — which is fine for a
 * correction of two and useless for the two things that actually happen at a
 * counter: a delivery arrives (add 48) and someone counts the shelf (it says
 * 44, there are 47). Reaching 48 took five taps and a recount was not
 * expressible at all.
 *
 * Three modes, because an operator means three different things:
 *
 *   Add     — stock came in
 *   Remove  — damage, waste, own use
 *   Set to  — "I counted it"
 *
 * `Set to` is the important one and is resolved SERVER-side: the POS only ever
 * receives availableQty (stock − reserved), so a shelf count compared against
 * what is on screen would write the wrong movement whenever a live cart holds
 * stock. The client sends the count; the server computes the delta.
 */

type Mode = 'add' | 'remove' | 'set';

const MODES: { key: Mode; label: string }[] = [
  { key: 'add', label: 'Add' },
  { key: 'remove', label: 'Remove' },
  { key: 'set', label: 'Set to' },
];

export function StockAdjust({ product }: { product: ProductDto }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const adjust = useAdjustStock();

  const [mode, setMode] = useState<Mode>('add');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  // The API takes integers: stockQty is DECIMAL(12,3) in the database but
  // `delta`/`setTo` are z.number().int(), so 12.5 kg of onions is not yet
  // expressible through this endpoint.
  const n = parseInt(amount, 10);
  const valid = Number.isFinite(n) && n >= 0 && amount.trim() !== '';

  // What the operator is about to do, spelled out before they do it. The
  // preview is the whole point of typing: 44 → 47 is checkable, "+3" is not.
  const current = product.availableQty;
  const next = !valid ? null : mode === 'set' ? n : mode === 'add' ? current + n : current - n;
  const wouldGoNegative = next !== null && next < 0;
  const noChange = next !== null && next === current;

  const apply = () => {
    if (!valid || wouldGoNegative || noChange) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const trimmed = note.trim();
    const move: StockMove =
      mode === 'set'
        ? { id: product.id, setTo: n, ...(trimmed ? { note: trimmed } : {}) }
        : { id: product.id, delta: mode === 'add' ? n : -n, ...(trimmed ? { note: trimmed } : {}) };
    adjust.mutate(move, {
      onSuccess: () => {
        setAmount('');
        setNote('');
      },
    });
  };

  return (
    <View style={{ gap: 12 }}>
      {/* Mode. Three words, not icons — "Set to" has no glyph anyone reads. */}
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {MODES.map((m) => {
          const on = mode === m.key;
          return (
            <Pressable
              key={m.key}
              onPress={() => setMode(m.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor: on ? colors.ink : colors.surface2,
              }}
            >
              <AppText token="labelM" style={{ color: on ? colors.surface : colors.ink2 }}>
                {m.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'stretch' }}>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.surface2,
            borderWidth: 1,
            borderColor: colors.line2,
            borderRadius: 12,
            paddingHorizontal: 14,
            justifyContent: 'center',
          }}
        >
          <TextInput
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder={mode === 'set' ? 'Counted quantity' : 'Quantity'}
            placeholderTextColor={colors.ink3}
            accessibilityLabel={mode === 'set' ? 'Counted quantity' : 'Quantity to change by'}
            style={{
              fontFamily: 'PlusJakartaSans-Bold',
              fontSize: 22,
              color: colors.ink,
              paddingVertical: 12,
            }}
          />
        </View>

        {/* Outcome, not arithmetic the operator has to do in their head. */}
        <View
          style={{
            minWidth: 128,
            paddingHorizontal: 14,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: wouldGoNegative ? colors.criticalSoft : colors.surface2,
          }}
        >
          {next === null ? (
            <AppText token="caption" color="ink3">
              now {current}
            </AppText>
          ) : (
            <AppText
              token="priceM"
              style={{ fontSize: 18, color: wouldGoNegative ? colors.critical : colors.ink }}
            >
              {current} → {next}
            </AppText>
          )}
        </View>
      </View>

      <View
        style={{
          backgroundColor: colors.surface2,
          borderWidth: 1,
          borderColor: colors.line2,
          borderRadius: 12,
          paddingHorizontal: 14,
        }}
      >
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Why? (optional — saved to the ledger)"
          placeholderTextColor={colors.ink3}
          accessibilityLabel="Reason for this stock change"
          maxLength={200}
          style={{
            fontFamily: 'PlusJakartaSans-Regular',
            fontSize: 15,
            color: colors.ink,
            paddingVertical: 12,
          }}
        />
      </View>

      {wouldGoNegative ? (
        <AppText token="caption" color="critical">
          {`Only ${current} in stock — cannot remove ${n}.`}
        </AppText>
      ) : noChange ? (
        <AppText token="caption" color="ink3">
          That matches the current count — nothing to record.
        </AppText>
      ) : null}

      <Button
        label={mode === 'set' ? 'Record count' : mode === 'add' ? 'Add stock' : 'Remove stock'}
        onPress={apply}
        disabled={!valid || wouldGoNegative || noChange || adjust.isPending}
      />

      {adjust.isError ? (
        <AppText token="caption" color="critical">
          {adjust.error instanceof Error ? adjust.error.message : t('common.retry')}
        </AppText>
      ) : null}
    </View>
  );
}
