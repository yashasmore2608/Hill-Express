import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DriverOrderDto, DriverSummaryDto } from '@hillexpress/shared';
import { apiFetch } from './api';
import { useAuth } from './auth';

export function useDriverSummary() {
  const { accessToken, status } = useAuth();
  return useQuery({
    queryKey: ['driver', 'summary'],
    queryFn: () => apiFetch<DriverSummaryDto>('/driver/summary', { token: accessToken }),
    enabled: status === 'signedIn',
  });
}

export function useDriverQueue() {
  const { accessToken, status } = useAuth();
  return useQuery({
    queryKey: ['driver', 'orders'],
    queryFn: () => apiFetch<DriverOrderDto[]>('/driver/orders', { token: accessToken }),
    enabled: status === 'signedIn',
    refetchInterval: 10_000, // new assignments must surface on their own
  });
}

export function useSetDuty() {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: 'AVAILABLE' | 'OFFLINE') =>
      apiFetch<{ status: string }>('/driver/status', {
        method: 'PATCH',
        token: accessToken,
        body: { status },
      }),
    onSettled: () => void qc.invalidateQueries({ queryKey: ['driver'] }),
  });
}

type DriverAction =
  | { id: string; action: 'accept' }
  | { id: string; action: 'pickup'; otp: string }
  | { id: string; action: 'deliver'; otp: string; collectedPaise: number };

export function useDriverAction() {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DriverAction) => {
      const { id, action, ...body } = input;
      return apiFetch<{ ok: true }>(`/driver/orders/${id}/${action}`, {
        method: 'POST',
        token: accessToken,
        body,
      });
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['driver'] }),
  });
}
