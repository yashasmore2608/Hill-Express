import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateProductInput,
  ImportResultDto,
  PatchProductInput,
  PatchStoreInput,
  PosSummaryDto,
  ProductDto,
  ProductPageDto,
} from '@hillexpress/shared';
import { apiFetch } from './api';
import { useAuth } from './auth';

export type StockFilter = 'all' | 'low' | 'out';

export function usePosSummary() {
  const { accessToken, status } = useAuth();
  return useQuery({
    queryKey: ['pos', 'summary'],
    queryFn: () => apiFetch<PosSummaryDto>('/pos/summary', { token: accessToken }),
    enabled: status === 'signedIn',
  });
}

export function usePatchStore() {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PatchStoreInput) =>
      apiFetch<{ isOpen: boolean; defaultPrepMin: number }>('/pos/store', {
        method: 'PATCH',
        token: accessToken,
        body,
      }),
    // Optimistic: the switch flips under the finger, reconciles after.
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: ['pos', 'summary'] });
      const prev = qc.getQueryData<PosSummaryDto>(['pos', 'summary']);
      if (prev) {
        qc.setQueryData<PosSummaryDto>(['pos', 'summary'], {
          ...prev,
          store: { ...prev.store, ...body },
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['pos', 'summary'], ctx.prev);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['pos', 'summary'] }),
  });
}

export function usePosProducts(opts: { search?: string; filter?: StockFilter }) {
  const { accessToken, status } = useAuth();
  return useInfiniteQuery({
    queryKey: ['pos', 'products', opts.filter ?? 'all', opts.search ?? null],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (opts.search) params.set('search', opts.search);
      if (opts.filter && opts.filter !== 'all') params.set('filter', opts.filter);
      if (pageParam) params.set('cursor', pageParam);
      return apiFetch<ProductPageDto>(`/pos/products?${params.toString()}`, {
        token: accessToken,
      });
    },
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: status === 'signedIn',
  });
}

export function usePatchProduct() {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: PatchProductInput }) =>
      apiFetch<ProductDto>(`/pos/products/${id}`, { method: 'PATCH', token: accessToken, body }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['pos', 'products'] });
      void qc.invalidateQueries({ queryKey: ['pos', 'summary'] });
    },
  });
}

/**
 * Stock movement. Exactly one of `delta` (a change) or `setTo` (a shelf
 * recount) — the server rejects both or neither, and resolves `setTo` itself
 * because only it can see raw stockQty behind the reserved-quantity subtraction.
 */
export type StockMove =
  | { id: string; delta: number; setTo?: never; note?: string }
  | { id: string; setTo: number; delta?: never; note?: string };

export function useAdjustStock() {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, delta, setTo, note }: StockMove) =>
      apiFetch<ProductDto>(`/pos/products/${id}/stock`, {
        method: 'POST',
        token: accessToken,
        body: delta !== undefined ? { delta, note } : { setTo, note },
      }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['pos', 'products'] });
      void qc.invalidateQueries({ queryKey: ['pos', 'summary'] });
    },
  });
}

/**
 * The store's existing categories, so adding a product is a tap rather than
 * typed text. Category is find-or-create BY NAME on the server, so a typo
 * silently spawns a duplicate category — picking one removes that whole class
 * of mistake. The catalog endpoint is public and store-scoped by id.
 */
export function usePosCategories() {
  const { user, status } = useAuth();
  const storeId = user?.storeId;
  return useQuery({
    queryKey: ['pos', 'categories', storeId],
    queryFn: () =>
      apiFetch<{ id: string; name: string; productCount?: number }[]>(
        `/stores/${storeId}/categories`,
      ),
    enabled: status === 'signedIn' && !!storeId,
  });
}

export function useCreateProduct() {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateProductInput) =>
      apiFetch<ProductDto>('/pos/products', { method: 'POST', token: accessToken, body }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['pos'] });
    },
  });
}

export function useImportCsv() {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { fileName: string; content: string }) =>
      apiFetch<ImportResultDto>('/pos/import', { method: 'POST', token: accessToken, body }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['pos'] });
    },
  });
}
