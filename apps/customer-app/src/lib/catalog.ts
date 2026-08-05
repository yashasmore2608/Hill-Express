import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type {
  AddressDto,
  BannerDto,
  CategoryDto,
  ProductDto,
  ProductPageDto,
  ServiceabilityDto,
  StoreSummaryDto,
} from '@hillexpress/shared';
import { apiFetch } from './api';
import { useAuth } from './auth';

/** Catalogue reads are public — browsing never demands a login. */

export function useStores() {
  return useQuery({
    queryKey: ['stores'],
    queryFn: () => apiFetch<StoreSummaryDto[]>('/stores'),
  });
}

/** v1 launches with one store; multi-store selection slots in here later. */
export function useDefaultStore(): StoreSummaryDto | undefined {
  const { data } = useStores();
  return data?.[0];
}

export function useCategories(storeId: string | undefined) {
  return useQuery({
    queryKey: ['categories', storeId],
    queryFn: () => apiFetch<CategoryDto[]>(`/stores/${storeId}/categories`),
    enabled: Boolean(storeId),
  });
}

export function useProducts(
  storeId: string | undefined,
  opts: { categoryId?: string; search?: string } = {},
) {
  return useInfiniteQuery({
    queryKey: ['products', storeId, opts.categoryId ?? null, opts.search ?? null],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (opts.categoryId) params.set('categoryId', opts.categoryId);
      if (opts.search) params.set('search', opts.search);
      if (pageParam) params.set('cursor', pageParam);
      return apiFetch<ProductPageDto>(`/stores/${storeId}/products?${params.toString()}`);
    },
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(storeId),
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => apiFetch<ProductDto>(`/products/${id}`),
    enabled: Boolean(id),
  });
}

export function useBanners(storeId: string | undefined) {
  return useQuery({
    queryKey: ['banners', storeId ?? null],
    queryFn: () =>
      apiFetch<BannerDto[]>(`/banners${storeId ? `?storeId=${storeId}` : ''}`),
    staleTime: 5 * 60_000, // promos change on ops timescales, not per-scroll
  });
}

export function useServiceability(pincode: string) {
  const valid = /^[1-9]\d{5}$/.test(pincode);
  return useQuery({
    queryKey: ['serviceability', pincode],
    queryFn: () => apiFetch<ServiceabilityDto>(`/serviceability?pincode=${pincode}`),
    enabled: valid,
  });
}

export function useAddresses() {
  const { accessToken, status } = useAuth();
  return useQuery({
    queryKey: ['addresses'],
    queryFn: () => apiFetch<AddressDto[]>('/addresses', { token: accessToken }),
    enabled: status === 'signedIn',
  });
}
