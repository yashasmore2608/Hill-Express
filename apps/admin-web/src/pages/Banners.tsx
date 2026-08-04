import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminBannerDto, CategoryDto, StoreSummaryDto } from '@hillexpress/shared';
import { ApiError, api } from '../lib/api';
import { Button, Card, EmptyState, Skeleton } from '../components/ui';

type Draft = {
  title: string;
  subtitle: string;
  imageUrl: string;
  bgColor: string;
  ctaLabel: string;
  linkType: 'NONE' | 'CATEGORY' | 'PRODUCT' | 'SEARCH';
  linkValue: string;
  sortOrder: number;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
};

const EMPTY: Draft = {
  title: '',
  subtitle: '',
  imageUrl: '',
  bgColor: '#0B3D2E',
  ctaLabel: '',
  linkType: 'NONE',
  linkValue: '',
  sortOrder: 0,
  isActive: true,
  startsAt: '',
  endsAt: '',
};

/** datetime-local gives 'YYYY-MM-DDTHH:mm'; the API wants a real ISO string. */
const toIso = (local: string) => (local ? new Date(local).toISOString() : '');
const toLocal = (iso: string | null) =>
  iso ? new Date(iso).toISOString().slice(0, 16) : '';

const SWATCHES = ['#0B3D2E', '#16704F', '#D4661F', '#2A78D6', '#6B4FA8', '#C0392F'];

export default function Banners() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const banners = useQuery({
    queryKey: ['admin-banners'],
    queryFn: () => api<AdminBannerDto[]>('/admin/banners'),
  });
  const stores = useQuery({
    queryKey: ['stores'],
    queryFn: () => api<StoreSummaryDto[]>('/stores'),
  });
  const storeId = stores.data?.[0]?.id;
  const categories = useQuery({
    queryKey: ['categories', storeId],
    queryFn: () => api<CategoryDto[]>(`/stores/${storeId}/categories`),
    enabled: Boolean(storeId),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin-banners'] });
    setEditing(null);
    setError(null);
  };

  const save = useMutation({
    mutationFn: (d: Draft) => {
      const body = { ...d, startsAt: toIso(d.startsAt), endsAt: toIso(d.endsAt) };
      return editing === 'new'
        ? api('/admin/banners', { method: 'POST', body })
        : api(`/admin/banners/${editing}`, { method: 'PATCH', body });
    },
    onSuccess: invalidate,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not save'),
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api(`/admin/banners/${id}/active`, { method: 'PATCH', body: { isActive } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-banners'] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/admin/banners/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  const startEdit = (b: AdminBannerDto) => {
    setDraft({
      title: b.title,
      subtitle: b.subtitle ?? '',
      imageUrl: b.imageUrl ?? '',
      bgColor: b.bgColor,
      ctaLabel: b.ctaLabel ?? '',
      linkType: b.linkType,
      linkValue: b.linkValue ?? '',
      sortOrder: b.sortOrder,
      isActive: b.isActive,
      startsAt: toLocal(b.startsAt),
      endsAt: toLocal(b.endsAt),
    });
    setEditing(b.id);
    setError(null);
  };

  const field = 'min-h-10 w-full rounded-m border border-line2 bg-surface px-3 text-sm outline-none focus:border-moss dark:border-line2-dark dark:bg-surface-dark';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Banners</h1>
          <p className="text-sm text-ink3 dark:text-ink3-dark">
            The promo carousel on the customer home screen
          </p>
        </div>
        <Button
          onClick={() => {
            setDraft(EMPTY);
            setEditing('new');
            setError(null);
          }}
        >
          + New banner
        </Button>
      </div>

      {/* ── editor ── */}
      {editing ? (
        <Card className="flex flex-col gap-4">
          <h2 className="font-semibold">{editing === 'new' ? 'New banner' : 'Edit banner'}</h2>

          {/* live preview — what the customer will actually see */}
          <div
            className="flex h-[150px] max-w-md flex-col justify-end overflow-hidden rounded-[18px] p-4"
            style={{
              background: draft.imageUrl
                ? `linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,.55)), url(${draft.imageUrl}) center/cover`
                : draft.bgColor,
            }}
          >
            <p className="text-lg font-bold text-white">{draft.title || 'Banner title'}</p>
            {draft.subtitle ? (
              <p className="text-sm text-white/85">{draft.subtitle}</p>
            ) : null}
            {draft.ctaLabel && draft.linkType !== 'NONE' ? (
              <span className="mt-2 self-start rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#0A1611]">
                {draft.ctaLabel}
              </span>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink2 dark:text-ink2-dark">Title</span>
              <input
                className={field}
                value={draft.title}
                maxLength={60}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink2 dark:text-ink2-dark">Subtitle</span>
              <input
                className={field}
                value={draft.subtitle}
                maxLength={90}
                onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1.5 md:col-span-2">
              <span className="text-sm font-medium text-ink2 dark:text-ink2-dark">
                Image URL <span className="text-ink3 dark:text-ink3-dark">— optional</span>
              </span>
              <input
                className={field}
                placeholder="https://…"
                value={draft.imageUrl}
                onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })}
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink2 dark:text-ink2-dark">
                Background (used when there's no image)
              </span>
              <div className="flex flex-wrap gap-2">
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Background ${c}`}
                    onClick={() => setDraft({ ...draft, bgColor: c })}
                    className={`size-8 rounded-full border-2 ${
                      draft.bgColor === c ? 'border-moss' : 'border-transparent'
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink2 dark:text-ink2-dark">
                Button label
              </span>
              <input
                className={field}
                placeholder="Shop now"
                maxLength={24}
                value={draft.ctaLabel}
                onChange={(e) => setDraft({ ...draft, ctaLabel: e.target.value })}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink2 dark:text-ink2-dark">Tapping opens</span>
              <select
                className={field}
                value={draft.linkType}
                onChange={(e) =>
                  setDraft({ ...draft, linkType: e.target.value as Draft['linkType'], linkValue: '' })
                }
              >
                <option value="NONE">Nothing (display only)</option>
                <option value="CATEGORY">A category</option>
                <option value="SEARCH">A search</option>
                <option value="PRODUCT">A product</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink2 dark:text-ink2-dark">Target</span>
              {draft.linkType === 'CATEGORY' ? (
                <select
                  className={field}
                  value={draft.linkValue}
                  onChange={(e) => setDraft({ ...draft, linkValue: e.target.value })}
                >
                  <option value="">Pick a category…</option>
                  {(categories.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className={field}
                  disabled={draft.linkType === 'NONE'}
                  placeholder={draft.linkType === 'SEARCH' ? 'e.g. atta' : 'product id'}
                  value={draft.linkValue}
                  onChange={(e) => setDraft({ ...draft, linkValue: e.target.value })}
                />
              )}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink2 dark:text-ink2-dark">
                Starts <span className="text-ink3 dark:text-ink3-dark">— optional</span>
              </span>
              <input
                type="datetime-local"
                className={field}
                value={draft.startsAt}
                onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink2 dark:text-ink2-dark">
                Ends <span className="text-ink3 dark:text-ink3-dark">— auto-hides after this</span>
              </span>
              <input
                type="datetime-local"
                className={field}
                value={draft.endsAt}
                onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink2 dark:text-ink2-dark">Order</span>
              <input
                type="number"
                min={0}
                className={field}
                value={draft.sortOrder}
                onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })}
              />
            </label>

            <label className="flex items-center gap-2 self-end pb-2">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
                className="size-4 accent-[color:var(--series-1)]"
              />
              <span className="text-sm">Active</span>
            </label>
          </div>

          {error ? (
            <p className="text-sm text-critical dark:text-critical-dark">{error}</p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => save.mutate(draft)} disabled={save.isPending || !draft.title}>
              {save.isPending ? 'Saving…' : 'Save banner'}
            </Button>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            {editing !== 'new' ? (
              <Button
                variant="critical"
                onClick={() => remove.mutate(editing)}
                disabled={remove.isPending}
                className="ml-auto"
              >
                Delete
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      {/* ── list ── */}
      {banners.isPending ? (
        <Skeleton className="h-48" />
      ) : (banners.data ?? []).length === 0 ? (
        <Card>
          <EmptyState
            icon="🎏"
            title="No banners yet"
            hint="Create one and it appears at the top of the customer home screen."
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {banners.data!.map((b) => (
            <Card key={b.id} className="flex flex-col gap-3">
              <div
                className="flex h-24 flex-col justify-end overflow-hidden rounded-m p-3"
                style={{
                  background: b.imageUrl
                    ? `linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,.55)), url(${b.imageUrl}) center/cover`
                    : b.bgColor,
                }}
              >
                <p className="truncate font-bold text-white">{b.title}</p>
                {b.subtitle ? (
                  <p className="truncate text-xs text-white/80">{b.subtitle}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* state carries a word, never colour alone */}
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                    b.liveNow
                      ? 'bg-moss-soft text-ok dark:bg-moss-soft-dark dark:text-ok-dark'
                      : 'bg-surface2 text-ink2 dark:bg-surface2-dark dark:text-ink2-dark'
                  }`}
                >
                  {b.liveNow ? '● Live now' : b.isActive ? 'Scheduled' : 'Off'}
                </span>
                <span className="text-xs text-ink3 dark:text-ink3-dark">#{b.sortOrder}</span>
                {b.endsAt ? (
                  <span className="text-xs text-ink3 dark:text-ink3-dark">
                    ends {new Date(b.endsAt).toLocaleDateString('en-IN')}
                  </span>
                ) : null}
              </div>

              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => startEdit(b)} className="flex-1">
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => toggle.mutate({ id: b.id, isActive: !b.isActive })}
                  disabled={toggle.isPending}
                >
                  {b.isActive ? 'Turn off' : 'Turn on'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
