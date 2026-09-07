import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
// Prisma is a value import — Prisma.sql/Prisma.join build the batched stock UPDATEs.
import { Prisma } from '@prisma/client';
import type { Order, OrderAddress, OrderItem, OrderStatusHistory } from '@prisma/client';
import {
  ACTIVE_FULFILLMENT_STATUSES,
  canTransitionAssignment,
  canTransitionFulfillment,
  computeBill,
  computeEta,
  customerCanCancel,
  decodeCursor,
  encodeCursor,
  formatOrderNumber,
  lineTotalPaise,
  HILL_DEFAULTS,
  type ActorType,
  type AssignmentStatus,
  type DriverOrderDto,
  type FulfillmentStatus,
  type OrderDetailDto,
  type OrderPageDto,
  type OrderSummaryDto,
  type PlaceOrderInput,
  type PosOrderDto,
} from '@hillexpress/shared';
import { PrismaService, TX } from '../prisma/prisma.service';
import { AddressesService } from '../addresses/addresses.service';
import { InvoicesService } from '../invoices/invoices.service';
import { otpFor } from '../config/secrets';
import { env } from '../config/env';

type OrderWithItems = Order & { items: OrderItem[] };

/** Prisma DECIMAL -> plain number for JSON. Quantities only; money is int. */
const qty = (d: Prisma.Decimal | number): number => Number(d);

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly addresses: AddressesService,
    private readonly invoices: InvoicesService,
  ) {}

  // ═══════════════════════ PLACE (customer) ═══════════════════════
  async place(userId: string, input: PlaceOrderInput): Promise<OrderDetailDto> {
    const db = this.prisma.db;

    // Idempotency FIRST: hill networks retry. Same key → same order,
    // no matter how many times the request lands.
    const existing = await db.order.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { items: true, history: true, address: true, addressSnapshot: true },
    });
    if (existing) {
      if (existing.userId !== userId) throw new ForbiddenException('Not your order');
      return this.toDetail(existing, existing.address, existing.history);
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Account not found');
    if (user.codBlocked) {
      throw new ForbiddenException('Cash-on-delivery is blocked on this account — contact support');
    }

    const store = await db.store.findFirst({
      where: { id: input.storeId, isBlocked: false },
      include: { config: true, zone: { include: { config: true } } },
    });
    if (!store) throw new NotFoundException('Store not found');
    if (!store.isOpen) throw new BadRequestException('The store is closed right now');

    let address = await db.address.findFirst({
      where: { id: input.addressId, userId, deletedAt: null },
    });
    if (!address) throw new NotFoundException('Address not found');
    if (!address.zoneId) {
      // Re-resolve rather than trusting a stale null: coverage may have been
      // added since the address was saved.
      const zoneId = await this.addresses.resolveZoneFor(address.pincode);
      if (!zoneId) throw new BadRequestException('This address is outside our delivery area');
      address = await db.address.update({ where: { id: address.id }, data: { zoneId } });
    }

    // ── COD risk controls: with no prepayment these are load-bearing ──
    //
    // DEMO_MODE lifts them. A demo account places order after order from one
    // phone number, and the first-timer caps (one open order, ₹500) stop that
    // dead — which looks like a broken checkout rather than the fraud control
    // it is. Off by default, and lifted only alongside the OTP bypass that
    // already makes a DEMO_MODE deployment untrusted.
    if (!env.DEMO_MODE) {
      const openCod = await db.order.count({
        where: {
          userId,
          paymentMethod: 'COD',
          fulfillmentStatus: { in: [...ACTIVE_FULFILLMENT_STATUSES] },
        },
      });
      if (openCod >= user.maxOpenCodOrders) {
        throw new BadRequestException(
          'You already have an order on the way — you can order again once it is delivered',
        );
      }
    }

    // ── Load products & compute the authoritative bill ──
    const products = await db.product.findMany({
      where: {
        id: { in: input.items.map((i) => i.productId) },
        storeId: store.id,
        deletedAt: null,
        isAvailable: true,
      },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    for (const line of input.items) {
      if (!byId.has(line.productId)) {
        throw new BadRequestException('An item in your cart is no longer available');
      }
    }

    const bill = computeBill(
      input.items.map((i) => ({ pricePaise: byId.get(i.productId)!.pricePaise, qty: i.qty })),
      store,
    );
    if (!env.DEMO_MODE && bill.totalPaise > user.maxCodOrderPaise) {
      throw new BadRequestException(
        `Cash-on-delivery orders are limited to ₹${Math.floor(user.maxCodOrderPaise / 100)} for now — the limit rises after a few successful deliveries`,
      );
    }

    // ── ETA promise, logged from order #1 (this data trains the model) ──
    const cfgRow = store.config ?? store.zone.config;
    const cfg = cfgRow
      ? {
          roadFactor: cfgRow.roadFactor,
          avgSpeedKmph: cfgRow.avgSpeedKmph,
          avgSpeedUphillKmph: cfgRow.avgSpeedUphill,
          avgSpeedDownhillKmph: cfgRow.avgSpeedDownhill,
          pickupDwellMin: cfgRow.pickupDwellMin,
          dropDwellMin: cfgRow.dropDwellMin,
          safetyBufferMin: cfgRow.safetyBufferMin,
          etaRangeLowPct: cfgRow.etaRangeLowPct,
          etaRangeHighPct: cfgRow.etaRangeHighPct,
        }
      : HILL_DEFAULTS;
    const eta = computeEta(
      {
        prepMinutes: store.defaultPrepMin,
        store: { lat: store.lat, lng: store.lng, elevationM: store.elevationM },
        customer: { lat: address.lat, lng: address.lng, elevationM: address.elevationM },
      },
      cfg,
    );

    // ── The transaction: reserve → number → order → snapshot → clear cart ──
    const order = await db.$transaction(async (tx) => {
      // Atomic reservation, one UPDATE per line. The WHERE clause IS the
      // race-condition fix: two checkouts for the last packet cannot both
      // pass. 0 rows affected → sold out → whole transaction rolls back.
      for (const line of input.items) {
        // Explicit ::decimal casts: the columns are DECIMAL(12,3) now, and a
        // JS number binds as float8 — comparing float8 to numeric can round
        // 0.1+0.2 into rejecting a line that is actually in stock.
        const affected = await tx.$executeRaw`
          UPDATE "Product"
             SET "reservedQty" = "reservedQty" + ${line.qty}::decimal
           WHERE "id" = ${line.productId}
             AND "stockQty" - "reservedQty" >= ${line.qty}::decimal`;
        if (affected === 0) {
          throw new BadRequestException(
            `"${byId.get(line.productId)!.name}" just sold out — remove it and try again`,
          );
        }
      }

      // Human-readable order number: HE-YYMMDD-#### from a per-day sequence.
      const now = new Date();
      const dateKey = now.toISOString().slice(2, 10).replace(/-/g, '');
      const seqRow = await tx.orderSeq.upsert({
        where: { date: dateKey },
        create: { date: dateKey, seq: 1 },
        update: { seq: { increment: 1 } },
      });

      const created = await tx.order.create({
        data: {
          orderNumber: formatOrderNumber(now, seqRow.seq),
          idempotencyKey: input.idempotencyKey,
          userId,
          storeId: store.id,
          addressId: address.id,
          zoneId: address.zoneId!,
          itemTotalPaise: bill.itemTotalPaise,
          deliveryFeePaise: bill.deliveryFeePaise,
          finalPaise: bill.totalPaise,
          codDuePaise: bill.totalPaise,
          paymentMethod: 'COD',
          prepMinutes: store.defaultPrepMin,
          etaMinutes: eta.etaMinutes,
          etaLowMinutes: eta.lowMinutes,
          etaHighMinutes: eta.highMinutes,
          etaPromisedAt: now,
          distanceKm: eta.distanceKm,
          items: {
            create: input.items.map((line) => {
              const p = byId.get(line.productId)!;
              // Snapshot as of NOW — prices change, this invoice must not.
              return {
                productId: p.id,
                nameSnapshot: p.name,
                unitSnapshot: p.unit,
                packSizeSnapshot: p.packSize,
                pricePaise: p.pricePaise,
                mrpPaise: p.mrpPaise,
                qty: line.qty,
                // Same rounding function the app used to show the bill, so a
                // fractional quantity can't make the two disagree by a paisa.
                lineTotalPaise: lineTotalPaise(p.pricePaise, line.qty),
              };
            }),
          },
          // Spec 5.3: freeze the address AS USED. Order.addressId still points
          // at the live row, but everything displayed reads this snapshot —
          // editing an address must not rewrite where past orders went.
          addressSnapshot: {
            create: {
              sourceAddressId: address.id,
              recipientName: user.name,
              recipientMobile: user.phone,
              house: address.house,
              street: address.street,
              landmark: address.landmark,
              city: address.city,
              pincode: address.pincode,
              lat: address.lat,
              lng: address.lng,
              instructions: address.instructions,
            },
          },
          history: {
            create: { toStatus: 'PLACED', actorType: 'CUSTOMER', actorId: userId },
          },
          payments: {
            create: { method: 'COD', status: 'PENDING', amountPaise: bill.totalPaise },
          },
        },
        include: { items: true, history: true },
      });

      // Reservation is auditable like every other stock move.
      await tx.stockLedger.createMany({
        data: input.items.map((line) => ({
          productId: line.productId,
          storeId: store.id,
          delta: -line.qty,
          reason: 'ORDER_RESERVE' as const,
          orderId: created.id,
          actorType: 'CUSTOMER' as const,
          actorId: userId,
        })),
      });

      // The basket became an order — clear it.
      const cart = await tx.cart.findUnique({
        where: { userId_storeId: { userId, storeId: store.id } },
      });
      if (cart) await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      await tx.notificationOutbox.create({
        data: {
          eventType: 'order.placed',
          payload: { orderId: created.id, storeId: store.id, orderNumber: created.orderNumber },
        },
      });

      return created;
    }, TX);

    return this.toDetail(order, address, order.history);
  }

  // ═══════════════════════ TRANSITIONS ═══════════════════════
  /**
   * EVERY status change goes through here. The state machine in
   * packages/shared decides legality — controllers never touch the field.
   */
  private async applyTransition(
    orderId: string,
    to: FulfillmentStatus,
    actor: ActorType,
    actorId: string,
    opts: {
      storeId?: string; // POS scope check
      userId?: string; // customer scope check
      driverId?: string; // driver scope check
      note?: string;
      data?: Prisma.OrderUpdateInput;
      releaseStock?: boolean;
      /** Pickup: commit the reservation — stock leaves the shelf for real. */
      sellStock?: boolean;
      /** Extra same-transaction work (COD ledger, promotions, …). */
      after?: (tx: Prisma.TransactionClient, order: OrderWithItems) => Promise<void>;
    } = {},
  ): Promise<void> {
    const db = this.prisma.db;

    await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order) throw new NotFoundException('Order not found');
      if (opts.storeId && order.storeId !== opts.storeId)
        throw new ForbiddenException('Not your store');
      if (opts.userId && order.userId !== opts.userId)
        throw new ForbiddenException('Not your order');
      if (opts.driverId && order.driverId !== opts.driverId)
        throw new ForbiddenException('Not your delivery');

      const from = order.fulfillmentStatus as FulfillmentStatus;
      if (!canTransitionFulfillment(from, to, actor)) {
        throw new BadRequestException(`Cannot move this order from ${from} to ${to}`);
      }

      await tx.order.update({
        where: { id: orderId },
        data: { fulfillmentStatus: to, ...(opts.data ?? {}) },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: from,
          toStatus: to,
          actorType: actor,
          actorId,
          note: opts.note,
        },
      });

      if (opts.releaseStock) {
        // Reject/cancel: hand the reservation back, ledgered.
        // One statement, not one per line — inside a transaction each round
        // trip to Neon is 150–400 ms and a 20-line order would blow the budget.
        await tx.$executeRaw`
          UPDATE "Product" AS p
             SET "reservedQty" = p."reservedQty" - v.qty
            FROM (VALUES ${Prisma.join(
              order.items.map((i) => Prisma.sql`(${i.productId}::text, ${qty(i.qty)}::decimal)`),
            )}) AS v(id, qty)
           WHERE p."id" = v.id`;
        await tx.stockLedger.createMany({
          data: order.items.map((item) => ({
            productId: item.productId,
            storeId: order.storeId,
            delta: qty(item.qty),
            reason: 'ORDER_RELEASE' as const,
            orderId,
            actorType: actor,
            actorId,
          })),
        });
      }

      if (opts.sellStock) {
        // Pickup: reservation becomes a sale — both counters move, ledgered.
        await tx.$executeRaw`
          UPDATE "Product" AS p
             SET "stockQty"    = p."stockQty"    - v.qty,
                 "reservedQty" = p."reservedQty" - v.qty
            FROM (VALUES ${Prisma.join(
              order.items.map((i) => Prisma.sql`(${i.productId}::text, ${qty(i.qty)}::decimal)`),
            )}) AS v(id, qty)
           WHERE p."id" = v.id`;
        await tx.stockLedger.createMany({
          data: order.items.map((item) => ({
            productId: item.productId,
            storeId: order.storeId,
            delta: -qty(item.qty),
            reason: 'ORDER_SELL' as const,
            orderId,
            actorType: actor,
            actorId,
          })),
        });
      }

      if (opts.after) await opts.after(tx, order);

      await tx.notificationOutbox.create({
        data: {
          eventType: `order.${to.toLowerCase()}`,
          payload: { orderId, orderNumber: order.orderNumber, from, to },
        },
      });
    }, TX);
  }

  cancelByCustomer(userId: string, orderId: string, reason: string) {
    return this.getForCustomer(userId, orderId).then(async (order) => {
      if (!customerCanCancel(order.fulfillmentStatus as FulfillmentStatus)) {
        throw new BadRequestException(
          'The store has already started on this order — call support to cancel',
        );
      }
      await this.applyTransition(orderId, 'CANCELLED', 'CUSTOMER', userId, {
        userId,
        note: reason,
        data: { cancelledAt: new Date(), cancelReason: reason },
        releaseStock: true,
      });
      return this.detailForCustomer(userId, orderId);
    });
  }

  accept(storeId: string, actorId: string, orderId: string, prepMinutes?: number) {
    return this.applyTransition(orderId, 'ACCEPTED', 'STORE', actorId, {
      storeId,
      data: { acceptedAt: new Date(), ...(prepMinutes ? { prepMinutes } : {}) },
    }).then(() => this.posOrder(storeId, orderId));
  }

  reject(storeId: string, actorId: string, orderId: string, reason: string) {
    return this.applyTransition(orderId, 'REJECTED', 'STORE', actorId, {
      storeId,
      note: reason,
      data: { rejectReason: reason },
      releaseStock: true,
    }).then(() => this.posOrder(storeId, orderId));
  }

  startPacking(storeId: string, actorId: string, orderId: string) {
    return this.applyTransition(orderId, 'PACKING', 'STORE', actorId, { storeId }).then(() =>
      this.posOrder(storeId, orderId),
    );
  }

  markReady(storeId: string, actorId: string, orderId: string) {
    return this.applyTransition(orderId, 'READY_FOR_PICKUP', 'STORE', actorId, {
      storeId,
      data: { readyAt: new Date() },
    }).then(() => this.posOrder(storeId, orderId));
  }

  // ═══════════════════════ READS ═══════════════════════
  private toSummary(o: OrderWithItems): OrderSummaryDto {
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      fulfillmentStatus: o.fulfillmentStatus,
      finalPaise: o.finalPaise,
      itemCount: o.items.reduce((n, i) => n + qty(i.qty), 0),
      placedAt: o.placedAt.toISOString(),
      etaLowMinutes: o.etaLowMinutes,
      etaHighMinutes: o.etaHighMinutes,
    };
  }

  /**
   * Spec 5.3: display reads the SNAPSHOT, never the live address row.
   * `label` isn't snapshotted (it's a personal nickname, not part of the
   * delivery record) so it falls back to the live row, then to a constant.
   */
  private toDetail(
    o: OrderWithItems & { addressSnapshot?: OrderAddress | null },
    address: { label: string; house: string; street: string; city: string; pincode: string },
    history: OrderStatusHistory[],
  ): OrderDetailDto {
    const snap = o.addressSnapshot;
    const shown = snap
      ? {
          label: address?.label ?? 'Delivery address',
          house: snap.house,
          street: snap.street,
          city: snap.city,
          pincode: snap.pincode,
        }
      : address;
    return {
      ...this.toSummary(o),
      items: o.items.map((i) => ({
        productId: i.productId,
        name: i.nameSnapshot,
        packSize: i.packSizeSnapshot,
        unit: i.unitSnapshot,
        qty: qty(i.qty),
        pricePaise: i.pricePaise,
        lineTotalPaise: i.lineTotalPaise,
      })),
      itemTotalPaise: o.itemTotalPaise,
      deliveryFeePaise: o.deliveryFeePaise,
      codDuePaise: o.codDuePaise,
      paymentMethod: o.paymentMethod,
      address: {
        label: shown.label,
        house: shown.house,
        street: shown.street,
        city: shown.city,
        pincode: shown.pincode,
      },
      timeline: [...history]
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((h) => ({ toStatus: h.toStatus, at: h.createdAt.toISOString(), note: h.note })),
      cancellable: customerCanCancel(o.fulfillmentStatus as FulfillmentStatus),
      // "Share OTP 4417 with Ravi" — the customer's proof of delivery.
      deliveryOtp: ACTIVE_FULFILLMENT_STATUSES.includes(o.fulfillmentStatus as FulfillmentStatus)
        ? otpFor(o.id, 'DELIVERY')
        : null,
    };
  }

  private async getForCustomer(userId: string, orderId: string) {
    const order = await this.prisma.db.order.findFirst({
      where: { id: orderId, userId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async listForCustomer(userId: string, cursor?: string, limit = 20): Promise<OrderPageDto> {
    const db = this.prisma.db;
    const cur = cursor ? decodeCursor(cursor) : null;
    const where: Prisma.OrderWhereInput = cur
      ? {
          userId,
          OR: [
            { placedAt: { lt: new Date(cur.n) } },
            { placedAt: new Date(cur.n), id: { lt: cur.i } },
          ],
        }
      : { userId };
    const rows = await db.order.findMany({
      where,
      include: { items: true },
      orderBy: [{ placedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      items: page.map((o) => this.toSummary(o)),
      nextCursor:
        rows.length > limit && last
          ? encodeCursor({ n: last.placedAt.toISOString(), i: last.id })
          : null,
    };
  }

  async detailForCustomer(userId: string, orderId: string): Promise<OrderDetailDto> {
    const order = await this.prisma.db.order.findFirst({
      where: { id: orderId, userId },
      include: { items: true, history: true, address: true, addressSnapshot: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.toDetail(order, order.address, order.history);
  }

  // ── POS queue ──
  private toPosDto(
    o: OrderWithItems & { user: { name: string | null; phone: string } },
  ): PosOrderDto {
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      fulfillmentStatus: o.fulfillmentStatus,
      placedAt: o.placedAt.toISOString(),
      finalPaise: o.finalPaise,
      codDuePaise: o.codDuePaise,
      paymentMethod: o.paymentMethod,
      codCollectedPaise: o.codCollectedPaise,
      itemCount: o.items.reduce((n, i) => n + qty(i.qty), 0),
      items: o.items.map((i) => ({
        productId: i.productId,
        name: i.nameSnapshot,
        packSize: i.packSizeSnapshot,
        unit: i.unitSnapshot,
        qty: qty(i.qty),
        pricePaise: i.pricePaise,
        lineTotalPaise: i.lineTotalPaise,
      })),
      customerName: o.user.name,
      customerPhone: o.user.phone,
      prepMinutes: o.prepMinutes,
      // The store reads this to the arriving driver — only once packed.
      pickupOtp: o.fulfillmentStatus === 'READY_FOR_PICKUP' ? otpFor(o.id, 'PICKUP') : null,
    };
  }

  async posQueue(storeId: string, scope: 'active' | 'history'): Promise<PosOrderDto[]> {
    const db = this.prisma.db;
    const rows = await db.order.findMany({
      where: {
        storeId,
        fulfillmentStatus:
          scope === 'active'
            ? { in: ['PLACED', 'ACCEPTED', 'PACKING', 'READY_FOR_PICKUP'] }
            : { in: ['DELIVERED', 'REJECTED', 'CANCELLED', 'PICKED_UP', 'OUT_FOR_DELIVERY'] },
      },
      include: { items: true, user: { select: { name: true, phone: true } } },
      orderBy: { placedAt: scope === 'active' ? 'asc' : 'desc' }, // oldest first: FIFO packing
      take: 100,
    });
    return rows.map((o) => this.toPosDto(o));
  }

  // ═══════════════════════ ADMIN DISPATCH (§1.3) ═══════════════════════
  /** Cash a driver is answerable for: ledger balance + undelivered COD on board. */
  async driverCodExposure(driverId: string): Promise<number> {
    const db = this.prisma.db;
    const [ledger, carrying] = await Promise.all([
      db.codLedger.aggregate({ where: { driverId }, _sum: { amountPaise: true } }),
      db.order.aggregate({
        where: {
          driverId,
          fulfillmentStatus: {
            in: ['READY_FOR_PICKUP', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'ACCEPTED', 'PACKING'],
          },
        },
        _sum: { codDuePaise: true },
      }),
    ]);
    return (ledger._sum.amountPaise ?? 0) + (carrying._sum.codDuePaise ?? 0);
  }

  async adminAssign(adminId: string, orderId: string, driverId: string) {
    const db = this.prisma.db;
    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    const from = order.assignmentStatus as AssignmentStatus;
    const via: AssignmentStatus =
      from === 'UNASSIGNED' || from === 'REASSIGNED' ? 'ASSIGNED' : from;
    if (!canTransitionAssignment(from, via, 'ADMIN') && from !== 'REASSIGNED') {
      throw new BadRequestException(`Order is already ${from.toLowerCase().replace(/_/g, ' ')}`);
    }

    const driver = await db.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Driver not found');
    if (driver.status === 'SUSPENDED') throw new BadRequestException('Driver is suspended');
    if (driver.status === 'OFFLINE') throw new BadRequestException('Driver is off duty');

    // FR-A-005: the COD limit is enforced HERE, at assignment — never later.
    const exposure = await this.driverCodExposure(driverId);
    if (exposure + order.codDuePaise > driver.codLimitPaise) {
      throw new BadRequestException(
        `${driver.name} would carry ₹${Math.ceil((exposure + order.codDuePaise) / 100)} — over the ₹${Math.floor(driver.codLimitPaise / 100)} COD limit. Collect a deposit first.`,
      );
    }

    await db.$transaction(async (tx) => {
      await tx.driverAssignment.updateMany({
        where: { orderId, active: true },
        data: { active: false, endedAt: new Date(), endReason: 'Reassigned' },
      });
      await tx.driverAssignment.create({
        data: { orderId, driverId, assignedBy: adminId },
      });
      await tx.order.update({
        where: { id: orderId },
        data: { driverId, assignmentStatus: 'ASSIGNED', assignedAt: new Date() },
      });
      await tx.notificationOutbox.create({
        data: {
          eventType: 'order.assigned',
          payload: { orderId, orderNumber: order.orderNumber, driverId },
        },
      });
    }, TX);
    return { ok: true as const };
  }

  // ═══════════════════════ DRIVER FLOW ═══════════════════════
  private toDriverDto(
    o: OrderWithItems & {
      user: { name: string | null; phone: string };
      address: {
        label: string;
        house: string;
        street: string;
        landmark: string | null;
        city: string;
        pincode: string;
        lat: number;
        lng: number;
        instructions: string | null;
      };
      store: { name: string; lat: number; lng: number };
    },
  ): DriverOrderDto {
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      fulfillmentStatus: o.fulfillmentStatus,
      assignmentStatus: o.assignmentStatus,
      codDuePaise: o.codDuePaise,
      itemCount: o.items.reduce((n, i) => n + qty(i.qty), 0),
      items: o.items.map((i) => ({
        productId: i.productId,
        name: i.nameSnapshot,
        packSize: i.packSizeSnapshot,
        unit: i.unitSnapshot,
        qty: qty(i.qty),
        pricePaise: i.pricePaise,
        lineTotalPaise: i.lineTotalPaise,
      })),
      customerName: o.user.name,
      customerPhone: o.user.phone,
      address: o.address,
      storeName: o.store.name,
      storeLat: o.store.lat,
      storeLng: o.store.lng,
      placedAt: o.placedAt.toISOString(),
    };
  }

  async driverQueue(driverId: string): Promise<DriverOrderDto[]> {
    const rows = await this.prisma.db.order.findMany({
      where: {
        driverId,
        // PLACED included: dispatch may assign a driver before the store has
        // accepted, and that delivery is the driver's from the moment it lands.
        fulfillmentStatus: { in: [...ACTIVE_FULFILLMENT_STATUSES] },
      },
      include: {
        items: true,
        user: { select: { name: true, phone: true } },
        address: true,
        store: { select: { name: true, lat: true, lng: true } },
      },
      orderBy: { assignedAt: 'asc' },
    });
    return rows.map((o) => this.toDriverDto(o));
  }

  async driverAcceptAssignment(driverId: string, orderId: string) {
    const db = this.prisma.db;
    const order = await db.order.findFirst({ where: { id: orderId, driverId } });
    if (!order) throw new NotFoundException('Order not found');
    if (
      !canTransitionAssignment(
        order.assignmentStatus as AssignmentStatus,
        'ACCEPTED_BY_DRIVER',
        'DRIVER',
      )
    ) {
      throw new BadRequestException('This delivery is not waiting on your acceptance');
    }
    await db.$transaction([
      db.order.update({ where: { id: orderId }, data: { assignmentStatus: 'ACCEPTED_BY_DRIVER' } }),
      db.driver.update({ where: { id: driverId }, data: { status: 'ON_DELIVERY' } }),
      db.notificationOutbox.create({
        data: { eventType: 'order.driver_accepted', payload: { orderId, driverId } },
      }),
    ]);
    return { ok: true as const };
  }

  async driverPickup(driverId: string, orderId: string, otp: string) {
    if (otp !== otpFor(orderId, 'PICKUP')) {
      throw new BadRequestException('Wrong pickup code — ask the store to read it again');
    }
    await this.applyTransition(orderId, 'PICKED_UP', 'DRIVER', driverId, {
      driverId,
      data: { pickedUpAt: new Date() },
      sellStock: true, // reservation becomes a sale, ledgered
    });
    // Leaving the store IS going out for delivery — system step, same breath.
    await this.applyTransition(orderId, 'OUT_FOR_DELIVERY', 'SYSTEM', driverId, { driverId });
    return { ok: true as const };
  }

  async driverDeliver(driverId: string, orderId: string, otp: string, collectedPaise: number) {
    if (otp !== otpFor(orderId, 'DELIVERY')) {
      throw new BadRequestException('Wrong delivery code — ask the customer for their code');
    }
    await this.applyTransition(orderId, 'DELIVERED', 'DRIVER', driverId, {
      driverId,
      data: {
        deliveredAt: new Date(),
        codCollectedPaise: collectedPaise,
        paymentStatus: 'PAID',
      },
      after: async (tx, order) => {
        // ── The money path: append-only, shortfalls VISIBLE ──
        await tx.codLedger.create({
          data: {
            driverId,
            orderId,
            entryType: 'COLLECTED',
            amountPaise: collectedPaise,
          },
        });
        const shortfall = order.codDuePaise - collectedPaise;
        if (shortfall > 0) {
          await tx.codLedger.create({
            data: {
              driverId,
              orderId,
              entryType: 'SHORTFALL',
              amountPaise: shortfall,
              note: `Collected ₹${(collectedPaise / 100).toFixed(2)} of ₹${(order.codDuePaise / 100).toFixed(2)}`,
            },
          });
        }
        await tx.payment.updateMany({
          where: { orderId },
          data: { status: 'PAID' },
        });

        // ── COD trust promotion: caps rise with proven deliveries ──
        const user = await tx.user.update({
          where: { id: order.userId },
          data: { completedOrders: { increment: 1 } },
        });
        if (user.completedOrders === 3) {
          await tx.user.update({
            where: { id: order.userId },
            data: { maxCodOrderPaise: 200_000, maxOpenCodOrders: 2 }, // ₹2,000
          });
        }

        // Free the driver if nothing else is on board.
        const remaining = await tx.order.count({
          where: {
            driverId,
            id: { not: orderId },
            fulfillmentStatus: {
              in: ['ACCEPTED', 'PACKING', 'READY_FOR_PICKUP', 'PICKED_UP', 'OUT_FOR_DELIVERY'],
            },
          },
        });
        if (remaining === 0) {
          await tx.driver.update({ where: { id: driverId }, data: { status: 'AVAILABLE' } });
        }
      },
    });

    // Stage 14. Deliberately AFTER the transaction commits, not inside it:
    // the delivery is what the driver is waiting on, and rendering a PDF is
    // not a reason to hold row locks or risk the whole handover failing.
    // `backfill()` re-issues anything that slips through here.
    await this.invoices.issueForOrder(orderId, driverId).catch(() => {
      /* logged by InvoicesService; delivery already succeeded */
    });

    return { ok: true as const };
  }

  async posOrder(storeId: string, orderId: string): Promise<PosOrderDto> {
    const order = await this.prisma.db.order.findFirst({
      where: { id: orderId, storeId },
      include: { items: true, user: { select: { name: true, phone: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.toPosDto(order);
  }
}
