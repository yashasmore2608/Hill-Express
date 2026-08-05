import { create } from 'zustand';
import { useCallback, useEffect } from 'react';
import { computeBill, type BillDto, type CartDto, type ProductDto } from '@hillexpress/shared';
import { apiFetch } from './api';
import { useAuth } from './auth';
import { useDefaultStore } from './catalog';

interface CartLine {
  product: ProductDto;
  qty: number;
}

interface CartState {
  storeId: string | null;
  lines: Record<string, CartLine>;
  hydrate: (cart: CartDto) => void;
  setLocal: (storeId: string, product: ProductDto, qty: number) => void;
  clear: () => void;
}

/**
 * Optimistic local cart: the finger NEVER waits on the network. Server sync
 * is debounced per product; the server clamps to live stock and its response
 * re-hydrates on conflict. Set-qty semantics make retries harmless.
 */
export const useCartStore = create<CartState>((set) => ({
  storeId: null,
  lines: {},
  hydrate: (cart) =>
    set({
      storeId: cart.storeId,
      lines: Object.fromEntries(
        cart.items.map((i) => [i.productId, { product: i.product, qty: i.qty }]),
      ),
    }),
  setLocal: (storeId, product, qty) =>
    set((s) => {
      const lines = { ...s.lines };
      if (qty <= 0) delete lines[product.id];
      else lines[product.id] = { product, qty: Math.min(qty, product.maxQty) };
      return { storeId, lines };
    }),
  clear: () => set({ storeId: null, lines: {} }),
}));

export const useCartCount = (): number =>
  useCartStore((s) => Object.values(s.lines).reduce((n, l) => n + l.qty, 0));

export const useCartBill = (): BillDto | null => {
  const lines = useCartStore((s) => s.lines);
  const store = useDefaultStore();
  if (!store) return null;
  return computeBill(
    Object.values(lines).map((l) => ({ pricePaise: l.product.pricePaise, qty: l.qty })),
    store,
  );
};

// Debounce timers per product, module scope — survive re-renders.
const timers: Record<string, ReturnType<typeof setTimeout>> = {};
const SYNC_DEBOUNCE_MS = 400;

/** The one write path the UI uses. Instant local, debounced server push. */
export function useSetQty() {
  const { accessToken, status } = useAuth();
  const setLocal = useCartStore((s) => s.setLocal);
  const hydrate = useCartStore((s) => s.hydrate);

  return useCallback(
    (storeId: string, product: ProductDto, qty: number) => {
      setLocal(storeId, product, qty);
      if (status !== 'signedIn') return; // guest carts sync on sign-in (M8 hardens this)

      clearTimeout(timers[product.id]);
      timers[product.id] = setTimeout(() => {
        apiFetch<CartDto>('/cart/items', {
          method: 'PUT',
          token: accessToken,
          body: { storeId, productId: product.id, qty },
        })
          .then((cart) => {
            // Only re-hydrate when the server disagreed (stock clamp) —
            // otherwise let rapid taps on other items proceed untouched.
            const serverQty = cart.items.find((i) => i.productId === product.id)?.qty ?? 0;
            if (serverQty !== qty) hydrate(cart);
          })
          .catch(() => {
            // Push failed (offline?) — refetch truth when possible.
            apiFetch<CartDto>(`/cart?storeId=${storeId}`, { token: accessToken })
              .then(hydrate)
              .catch(() => {});
          });
      }, SYNC_DEBOUNCE_MS);
    },
    [accessToken, status, setLocal, hydrate],
  );
}

/** Hydrate the local cart from the server once per sign-in. */
export function useCartHydration() {
  const { accessToken, status } = useAuth();
  const store = useDefaultStore();
  const hydrate = useCartStore((s) => s.hydrate);

  useEffect(() => {
    if (status !== 'signedIn' || !store) return;
    apiFetch<CartDto>(`/cart?storeId=${store.id}`, { token: accessToken })
      .then(hydrate)
      .catch(() => {});
  }, [status, store, accessToken, hydrate]);
}
