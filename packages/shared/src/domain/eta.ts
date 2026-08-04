/**
 * ETA engine — the Swiggy/Zomato decomposition with hill-tuned constants.
 * Constants come from the delivery_config table (ops-tunable), NEVER hardcoded.
 *
 *   ETA = prep + driverToStore + pickupDwell + storeToCustomer + dropDwell + buffer
 *
 * Product rules implemented here:
 *  1. Show a RANGE (low–high), not a point estimate.
 *  2. The displayed promise is clamped monotonically — may shrink, never grow.
 */

export interface DeliveryConfigValues {
  roadFactor: number; // hills: straight-line badly understates road distance
  avgSpeedKmph: number;
  avgSpeedUphillKmph: number;
  avgSpeedDownhillKmph: number;
  pickupDwellMin: number;
  dropDwellMin: number;
  safetyBufferMin: number;
  etaRangeLowPct: number; // e.g. 0.85
  etaRangeHighPct: number; // e.g. 1.20
}

export const HILL_DEFAULTS: DeliveryConfigValues = {
  roadFactor: 1.7,
  avgSpeedKmph: 16,
  avgSpeedUphillKmph: 13,
  avgSpeedDownhillKmph: 19,
  pickupDwellMin: 3,
  dropDwellMin: 5,
  safetyBufferMin: 7,
  etaRangeLowPct: 0.85,
  etaRangeHighPct: 1.2,
};

export interface LatLng {
  lat: number;
  lng: number;
  /** Elevation in metres — when present on both ends, up/downhill speeds apply. */
  elevationM?: number | null;
}

const EARTH_RADIUS_KM = 6371;

export const haversineKm = (a: LatLng, b: LatLng): number => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
};

const legMinutes = (from: LatLng, to: LatLng, cfg: DeliveryConfigValues): number => {
  const roadKm = haversineKm(from, to) * cfg.roadFactor;
  let speed = cfg.avgSpeedKmph;
  if (from.elevationM != null && to.elevationM != null) {
    const climb = to.elevationM - from.elevationM;
    if (climb > 30) speed = cfg.avgSpeedUphillKmph;
    else if (climb < -30) speed = cfg.avgSpeedDownhillKmph;
  }
  return (roadKm / speed) * 60;
};

export interface EtaInput {
  prepMinutes: number; // from POS operator (FR-P-003)
  store: LatLng;
  customer: LatLng;
  /** Driver's live position if assigned; null → flat estimate for the leg. */
  driver?: LatLng | null;
  /** Used when no driver is assigned yet. */
  unassignedDriverLegMin?: number;
}

export interface EtaResult {
  etaMinutes: number;
  lowMinutes: number;
  highMinutes: number;
  distanceKm: number;
}

export const computeEta = (input: EtaInput, cfg: DeliveryConfigValues): EtaResult => {
  const driverLeg = input.driver
    ? legMinutes(input.driver, input.store, cfg)
    : (input.unassignedDriverLegMin ?? 8);
  const dropLeg = legMinutes(input.store, input.customer, cfg);

  const raw =
    input.prepMinutes +
    driverLeg +
    cfg.pickupDwellMin +
    dropLeg +
    cfg.dropDwellMin +
    cfg.safetyBufferMin;

  const eta = Math.ceil(raw);
  return {
    etaMinutes: eta,
    lowMinutes: Math.max(1, Math.floor(eta * cfg.etaRangeLowPct)),
    highMinutes: Math.ceil(eta * cfg.etaRangeHighPct),
    distanceKm: Math.round(haversineKm(input.store, input.customer) * cfg.roadFactor * 100) / 100,
  };
};

/**
 * Monotonic clamp for the customer-visible promise: recompute freely on every
 * state change, but the number shown may only hold or shrink. A promise that
 * jumps 30 → 25 → 40 is the single biggest source of angry calls.
 */
export const clampEtaForDisplay = (previous: EtaResult | null, next: EtaResult): EtaResult =>
  previous === null
    ? next
    : {
        etaMinutes: Math.min(previous.etaMinutes, next.etaMinutes),
        lowMinutes: Math.min(previous.lowMinutes, next.lowMinutes),
        highMinutes: Math.min(previous.highMinutes, next.highMinutes),
        distanceKm: next.distanceKm,
      };
