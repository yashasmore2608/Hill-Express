import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { formatINR, paise, type PosOrderDto } from '@hillexpress/shared';
import { AppText, Button, Card, StatusPill, useTheme } from '@hillexpress/ui';
import { useOrderAction } from '../lib/orders';
import { elapsedMin, isLate } from '../lib/clock';
import { PickList } from './pick-list';

/**
 * One order, one card, one action.
 *
 * The shape every Indian partner app uses, on purpose: a store that has run
 * Swiggy Partner or Zomato RP should not have to learn anything here. Header,
 * items, money, one big button at the bottom — and the button is whatever the
 * state machine says the store may do next, never a menu of choices.
 */

/**
 * Convention wording, not our internal statuses — and a tone per outcome, so a
 * store scanning Past can tell at a glance which orders earned money and which
 * did not. Everything used to be `neutral`, which made every finished order
 * look identical.
 *
 * `accent` (ember) follows the rule set in StatusPill: things IN MOTION.
 */
const STAGE_LABEL: Record<
  string,
  { label: string; tone: 'ok' | 'warn' | 'accent' | 'crit' | 'neutral' }
> = {
  PLACED: { label: 'New', tone: 'accent' },
  ACCEPTED: { label: 'Accepted', tone: 'warn' },
  PACKING: { label: 'Preparing', tone: 'warn' },
  READY_FOR_PICKUP: { label: 'Ready', tone: 'ok' },
  // Out of the store's hands but not finished — in motion, so ember.
  PICKED_UP: { label: 'Picked up', tone: 'accent' },
  OUT_FOR_DELIVERY: { label: 'On the way', tone: 'accent' },
  DELIVERED: { label: 'Delivered', tone: 'ok' },
  // The store's own refusal, worth spotting in history; a customer's
  // cancellation is not the store's doing, so it stays quiet.
  REJECTED: { label: 'Rejected', tone: 'crit' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
};

/** Nothing was sold and nothing will be collected. */
const VOID_STATUSES = new Set(['REJECTED', 'CANCELLED']);

function Handover({ code }: { code: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.mossSoft,
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
        gap: 2,
      }}
    >
      <AppText token="micro" color="ok">
        Read this code to the driver
      </AppText>
      {/* Read aloud across a counter, so it is the biggest thing on the card and
          widely tracked — 6/8 and 1/7 blur at arm's length otherwise. */}
      <AppText
        token="displayL"
        style={{ fontSize: 40, lineHeight: 48, letterSpacing: 10, color: colors.ok }}
      >
        {code}
      </AppText>
    </View>
  );
}

export function OrderCard({ order, now }: { order: PosOrderDto; now: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const act = useOrderAction();
  const [confirmReject, setConfirmReject] = useState(false);
  const [outstanding, setOutstanding] = useState(order.items.length);

  const status = order.fulfillmentStatus;
  const stage = STAGE_LABEL[status] ?? { label: status, tone: 'neutral' as const };
  const late = isLate(order, now);
  const isCod = order.paymentMethod === 'COD';

  const voided = VOID_STATUSES.has(status);
  const settled = status === 'DELIVERED';
  // Delivered reports what was TAKEN; everything still in flight reports what
  // is owed. Short collections surface rather than hide behind the due amount.
  const short = settled && isCod ? Math.max(0, order.codDuePaise - order.codCollectedPaise) : 0;
  const moneyAmount = settled
    ? isCod
      ? order.codCollectedPaise
      : order.finalPaise
    : isCod
      ? order.codDuePaise
      : order.finalPaise;
  const moneyLabel = settled
    ? isCod
      ? t('orders.collected')
      : t('orders.prepaid')
    : isCod
      ? t('orders.cod')
      : t('orders.prepaid');
  const moneyColor = settled
    ? short > 0
      ? colors.critical
      : colors.ok
    : isCod
      ? colors.ember
      : colors.ink3;
  const mins = elapsedMin(order, now);

  const run = (action: 'accept' | 'reject' | 'packing' | 'ready', body?: { reason?: string }) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    act.mutate({ id: order.id, action, body });
    setConfirmReject(false);
  };

  return (
    <Card elevated style={{ gap: 14 }}>
      {/* Header: who, when, how late. */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText token="titleM" numberOfLines={1}>
            {order.orderNumber}
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <AppText token="caption" color="ink3">
              {t('orders.age', { min: mins })}
            </AppText>
            {late ? <StatusPill label="Late" tone="crit" /> : null}
          </View>
        </View>
        <StatusPill label={stage.label} tone={stage.tone} />
      </View>

      {/* Items. Tickable only while packing — the rest of the time they are a
          reference, and a checkbox that does nothing invites a wrong tap. */}
      {status === 'PACKING' ? (
        <PickList
          items={order.items}
          onProgress={(picked, total) => setOutstanding(total - picked)}
        />
      ) : (
        <PickList items={order.items} readOnly />
      )}

      <View style={{ height: 1, backgroundColor: colors.line }} />

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
        {/* Calling the customer is the exception, so it sits low-contrast on
            the left; the money is the thing acted on, so it owns the right. */}
        <Pressable
          onPress={() => void Linking.openURL(`tel:${order.customerPhone}`)}
          accessibilityRole="link"
          accessibilityLabel={`Call ${order.customerPhone}`}
          style={{ flex: 1 }}
        >
          <AppText token="labelM" color="moss" numberOfLines={1}>
            {order.customerName ?? order.customerPhone}
          </AppText>
        </Pressable>

        {/* Method is a LABEL, the amount is DATA — so they get different
            weights. Ember means money that must still change hands, which is
            why it stops once the cash is in: a delivered order shouting
            "CASH ON DELIVERY" reads as a debt that no longer exists. */}
        {voided ? null : (
          <View style={{ alignItems: 'flex-end' }}>
            <AppText token="micro" style={{ color: moneyColor }}>
              {moneyLabel}
            </AppText>
            <AppText token="priceL" style={{ fontSize: 26, lineHeight: 32, color: moneyColor }}>
              {formatINR(paise(moneyAmount))}
            </AppText>
            {short > 0 ? (
              // The schema keeps collected separate from due precisely so this
              // is visible. Never let it be inferred from two numbers.
              <AppText token="micro" color="critical">
                {`Short by ${formatINR(paise(short))}`}
              </AppText>
            ) : null}
          </View>
        )}
      </View>

      {order.pickupOtp ? <Handover code={order.pickupOtp} /> : null}

      {act.isError ? (
        <AppText token="caption" color="critical">
          {act.error instanceof Error ? act.error.message : t('common.retry')}
        </AppText>
      ) : null}

      {/* One decision, at the bottom, where the thumb already is. */}
      {status === 'PLACED' ? (
        confirmReject ? (
          <View style={{ gap: 8 }}>
            <AppText token="caption" color="critical">
              {t('orders.rejectConfirm')}
            </AppText>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button
                  label={t('orders.rejectOutOfStock')}
                  variant="critical"
                  onPress={() => run('reject', { reason: 'Items out of stock' })}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label={t('orders.keep')}
                  variant="secondary"
                  onPress={() => setConfirmReject(false)}
                />
              </View>
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 3 }}>
              <Button
                label={t('orders.accept')}
                onPress={() => run('accept')}
                disabled={act.isPending}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={t('orders.reject')}
                variant="critical"
                onPress={() => setConfirmReject(true)}
              />
            </View>
          </View>
        )
      ) : null}

      {status === 'ACCEPTED' ? (
        <Button
          label={t('orders.startPacking')}
          onPress={() => run('packing')}
          disabled={act.isPending}
        />
      ) : null}

      {status === 'PACKING' ? (
        <View style={{ gap: 8 }}>
          {outstanding > 0 ? (
            // Advisory, never blocking: the bag in their hand is the authority,
            // not the ticks on this screen.
            <AppText token="caption" color="ink3">
              {`${outstanding} item${outstanding === 1 ? '' : 's'} not ticked`}
            </AppText>
          ) : null}
          <Button
            label={t('orders.markReady')}
            onPress={() => run('ready')}
            disabled={act.isPending}
          />
        </View>
      ) : null}

      {status === 'READY_FOR_PICKUP' ? (
        <AppText token="labelM" color="ink3" style={{ textAlign: 'center' }}>
          {t('orders.waitingDriver')}
        </AppText>
      ) : null}
    </Card>
  );
}
