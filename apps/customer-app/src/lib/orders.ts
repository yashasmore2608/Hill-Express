import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useRef } from 'react';
import type { OrderDetailDto, OrderPageDto } from '@hillexpress/shared';
import { apiFetch } from './api';
import { useAuth } from './auth';
import { useCartStore } from './cart';

const ACTIVE = new Set(['PLACED', 'ACCEPTED', 'PACKING', 'READY_FOR_PICKUP', 'PICKED_UP', 'OUT_FOR_DELIVERY']);

export function useOrders() {
  const { accessToken, status } = useAuth();
  return useInfiniteQuery({
    queryKey: ['orders'],
    queryFn: ({ pageParam }) =>
      apiFetch<OrderPageDto>(`/orders${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`, {
        token: accessToken,
      }),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: status === 'signedIn',
  });
}

export function useOrder(id: string | undefined) {
  const { accessToken, status } = useAuth();
  return useQuery({
    queryKey: ['order', id],
    queryFn: () => apiFetch<OrderDetailDto>(`/orders/${id}`, { token: accessToken }),
    enabled: status === 'signedIn' && Boolean(id),
    // Live orders poll until sockets land (M11); settled orders stop.
    refetchInterval: (q) => (q.state.data && ACTIVE.has(q.state.data.fulfillmentStatus) ? 10_000 : false),
  });
}

/**
 * One idempotency key PER CHECKOUT ATTEMPT, minted when the user first hits
 * the button and kept across retries — a flaky-network resubmit returns the
 * SAME order. A new key is only minted after success or explicit reset.
 */
export function usePlaceOrder() {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  const clearCart = useCartStore((s) => s.clear);
  const keyRef = useRef<string | null>(null);

  const mutation = useMutation({
    mutationFn: (body: { storeId: string; addressId: string; items: { productId: string; qty: number }[] }) => {
      keyRef.current = keyRef.current ?? Crypto.randomUUID();
      return apiFetch<OrderDetailDto>('/orders', {
        method: 'POST',
        token: accessToken,
        body: { ...body, paymentMethod: 'COD', idempotencyKey: keyRef.current },
      });
    },
    onSuccess: () => {
      keyRef.current = null; // next checkout is a new order
      clearCart();
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
  return mutation;
}

export function useCancelOrder() {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiFetch<OrderDetailDto>(`/orders/${id}/cancel`, {
        method: 'POST',
        token: accessToken,
        body: { reason },
      }),
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['order', v.id] });
      void qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
