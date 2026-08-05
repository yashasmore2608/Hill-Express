/**
 * API response shapes — the contract both the NestJS mappers and the mobile
 * apps compile against. Change a field here and every surface fails to
 * compile until it's handled. That is the point.
 */

export interface StoreSummaryDto {
  id: string;
  name: string;
  code: string;
  isOpen: boolean;
  deliveryFeePaise: number;
  freeDeliveryAbovePaise: number | null;
  openTime: string;
  closeTime: string;
  /** Teaser range shown before an address is chosen — real ETA lands at checkout. */
  etaLowMinutes: number;
  etaHighMinutes: number;
}

export interface CategoryDto {
  id: string;
  name: string;
  sortOrder: number;
  productCount: number;
}

export interface ProductDto {
  id: string;
  storeId: string;
  categoryId: string;
  sku: string | null;
  name: string;
  unit: string;
  packSize: string;
  pricePaise: number;
  mrpPaise: number | null;
  /** stock − reserved, floor 0 — what a customer can actually take. */
  availableQty: number;
  /** min(availableQty, per-order cap). The stepper's hard ceiling. */
  maxQty: number;
  /** Increment the stepper moves by — 1 for packets, 0.5 for loose kg. */
  stepQty: number;
  /** Smallest sellable amount; going below it removes the line. */
  minQty: number;
  lowStock: boolean;
  isAvailable: boolean;
  imageUrl: string | null;
  blurhash: string | null;
}

export interface ProductPageDto {
  items: ProductDto[];
  nextCursor: string | null;
}

export interface BillDto {
  itemTotalPaise: number;
  deliveryFeePaise: number;
  totalPaise: number;
  /** Paise still to add for free delivery; null when store has no threshold, 0 when reached. */
  freeDeliveryRemainingPaise: number | null;
}

export interface CartItemDto {
  productId: string;
  /** DECIMAL(12,3) — fractional for loose goods. */
  qty: number;
  product: ProductDto;
}

export interface CartDto {
  storeId: string;
  items: CartItemDto[];
  bill: BillDto;
}

/** Spec 5.3 — the address as used for an order, frozen at placement. */
export interface OrderAddressDto {
  recipientName: string | null;
  recipientMobile: string | null;
  house: string;
  street: string;
  landmark: string | null;
  locality: string | null;
  city: string;
  district: string | null;
  state: string | null;
  pincode: string;
  lat: number;
  lng: number;
  instructions: string | null;
}

export interface AddressDto {
  id: string;
  label: string;
  house: string;
  street: string;
  landmark: string | null;
  city: string;
  pincode: string;
  lat: number;
  lng: number;
  instructions: string | null;
  zoneId: string | null;
  serviceable: boolean;
}

export interface ServiceabilityDto {
  serviceable: boolean;
  zoneId: string | null;
}

// ── Orders ────────────────────────────────────────────────────────────

export interface OrderItemLineDto {
  productId: string;
  name: string;
  packSize: string;
  unit: string;
  qty: number;
  pricePaise: number;
  lineTotalPaise: number;
}

export interface OrderTimelineDto {
  toStatus: string;
  at: string; // ISO
  note: string | null;
}

export interface OrderSummaryDto {
  id: string;
  orderNumber: string;
  /** FulfillmentStatus value — typed loosely so DTOs stay JSON-plain. */
  fulfillmentStatus: string;
  finalPaise: number;
  itemCount: number;
  placedAt: string; // ISO
  etaLowMinutes: number | null;
  etaHighMinutes: number | null;
}

export interface OrderDetailDto extends OrderSummaryDto {
  items: OrderItemLineDto[];
  itemTotalPaise: number;
  deliveryFeePaise: number;
  codDuePaise: number;
  paymentMethod: string;
  address: { label: string; house: string; street: string; city: string; pincode: string };
  timeline: OrderTimelineDto[];
  /** True only while the customer may still cancel (PLACED). */
  cancellable: boolean;
  /** "Share OTP 4417 with Ravi" — present only for the owner, while live. */
  deliveryOtp: string | null;
}

export interface OrderPageDto {
  items: OrderSummaryDto[];
  nextCursor: string | null;
}

/** Queue card for the store operator — includes customer contact (plain phone per spec). */
export interface PosOrderDto {
  id: string;
  orderNumber: string;
  fulfillmentStatus: string;
  placedAt: string;
  finalPaise: number;
  codDuePaise: number;
  itemCount: number;
  items: OrderItemLineDto[];
  customerName: string | null;
  customerPhone: string;
  prepMinutes: number | null;
  /** Present only while READY_FOR_PICKUP — the store reads it to the driver. */
  pickupOtp: string | null;
}

// ── Driver ────────────────────────────────────────────────────────────

export interface DriverSummaryDto {
  id: string;
  name: string;
  status: string;
  /** SUM of the COD ledger — cash currently in the driver's pocket. */
  codOutstandingPaise: number;
  codLimitPaise: number;
  deliveredToday: number;
}

export interface DriverOrderDto {
  id: string;
  orderNumber: string;
  fulfillmentStatus: string;
  assignmentStatus: string;
  codDuePaise: number;
  itemCount: number;
  items: OrderItemLineDto[];
  customerName: string | null;
  customerPhone: string;
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
  storeName: string;
  storeLat: number;
  storeLng: number;
  placedAt: string;
}

// ── Admin dispatch ────────────────────────────────────────────────────

export interface AdminDriverDto {
  id: string;
  name: string;
  phone: string;
  status: string;
  codOutstandingPaise: number;
  codLimitPaise: number;
  activeOrders: number;
  lastSeenAt: string | null;
}

// ── Admin analytics ───────────────────────────────────────────────────

export interface AdminKpisDto {
  /** Delivered revenue only — placed-but-unfinished orders aren't money yet. */
  revenuePaise: number;
  revenueDeltaPct: number | null;
  orders: number;
  ordersDeltaPct: number | null;
  avgOrderValuePaise: number;
  deliveredCount: number;
  cancelledCount: number;
  rejectedCount: number;
  /** delivered / (delivered + cancelled + rejected) */
  fulfilmentRatePct: number;
  activeOrders: number;
  codOutstandingPaise: number;
  lowStockCount: number;
  outOfStockCount: number;
  newCustomers: number;
  /** Median minutes from placed → delivered, for orders in range. */
  medianDeliveryMinutes: number | null;
  /** Share of delivered orders that beat their promised high ETA. */
  onTimePct: number | null;
}

export interface TimePointDto {
  /** ISO date (YYYY-MM-DD) */
  date: string;
  revenuePaise: number;
  orders: number;
}

export interface StatusSliceDto {
  status: string;
  count: number;
}

export interface TopProductDto {
  productId: string;
  name: string;
  qty: number;
  revenuePaise: number;
}

export interface HourBucketDto {
  hour: number; // 0–23
  orders: number;
}

export interface AdminAnalyticsDto {
  rangeDays: number;
  kpis: AdminKpisDto;
  series: TimePointDto[];
  statusMix: StatusSliceDto[];
  topProducts: TopProductDto[];
  ordersByHour: HourBucketDto[];
  categoryRevenue: Array<{ category: string; revenuePaise: number }>;
}

export interface AdminDispatchOrderDto {
  id: string;
  orderNumber: string;
  fulfillmentStatus: string;
  assignmentStatus: string;
  codDuePaise: number;
  itemCount: number;
  placedAt: string;
  storeName: string;
  addressArea: string;
  driverId: string | null;
  driverName: string | null;
}

// ── Promo banners ─────────────────────────────────────────────────────

export interface BannerDto {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  /** Solid/gradient fallback so a banner never renders empty. */
  bgColor: string;
  ctaLabel: string | null;
  linkType: 'NONE' | 'CATEGORY' | 'PRODUCT' | 'SEARCH';
  linkValue: string | null;
}

/** Admin view — adds the scheduling fields the customer feed hides. */
export interface AdminBannerDto extends BannerDto {
  storeId: string | null;
  sortOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  /** Computed: active AND inside its date window right now. */
  liveNow: boolean;
}

// ── POS / store operator ──────────────────────────────────────────────

export interface PosSummaryDto {
  store: {
    id: string;
    name: string;
    code: string;
    isOpen: boolean;
    isBlocked: boolean;
    defaultPrepMin: number;
    openTime: string;
    closeTime: string;
  };
  productCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  /** Orders in PLACED..READY_FOR_PICKUP — the queue's badge count. */
  activeOrders: number;
}

export interface ImportRowErrorDto {
  rowNumber: number;
  message: string;
}

export interface ImportResultDto {
  jobId: string;
  fileName: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  created: number;
  updated: number;
  errors: ImportRowErrorDto[];
}
