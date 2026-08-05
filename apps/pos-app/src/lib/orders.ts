import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PosOrderDto } from '@hillexpress/shared';
import { apiFetch } from './api';
import { useAuth } from './auth';

/** Polls every 8s — new orders must surface without a tap. Sockets land M11/M12. */
export function usePosQueue(scope: 'active' | 'history') {
  const { accessToken, status } = useAuth();
  return useQuery({
    queryKey: ['pos', 'orders', scope],
    queryFn: () => apiFetch<PosOrderDto[]>(`/pos/orders?scope=${scope}`, { token: accessToken }),
    enabled: status === 'signedIn',
    refetchInterval: scope === 'active' ? 8_000 : false,
  });
}

type Action = 'accept' | 'reject' | 'packing' | 'ready';

export function useOrderAction() {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
      body,
    }: {
      id: string;
      action: Action;
      body?: { reason?: string; prepMinutes?: number };
    }) =>
      apiFetch<PosOrderDto>(`/pos/orders/${id}/${action}`, {
        method: 'POST',
        token: accessToken,
        body: body ?? {},
      }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['pos', 'orders'] });
      void qc.invalidateQueries({ queryKey: ['pos', 'summary'] });
    },
  });
}
