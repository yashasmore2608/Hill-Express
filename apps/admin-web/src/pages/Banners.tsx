import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminBannerDto, CategoryDto, StoreSummaryDto } from '@hillexpress/shared';
import { ApiError, api } from '../lib/api';
import { ImageUpload } from '../components/image-upload';
import { Button, Card, EmptyState, PageHeader, Skeleton } from '../components/ui';

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
const toLocal = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');

const SWATCHES = ['#0B3D2E', '#16704F', '#D4661F', '#2A78D6', '#6B4FA8', '#C0392F'];

/** The banner surface, rendered the same way in the editor preview and the list. */
function BannerArt({
  b,
  className = '',
  children,
}: {
  b: Pick<Draft, 'imageUrl' | 'bgColor'>;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`relative flex flex-col justify-end overflow-hidden ${className}`}
      style={{ background: b.bgColor }}
    >
      {b.imageUrl ? (
        <img src={b.imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
      ) : null}
      {/* Scrim only where the text sits, so artwork stays visible above it. */}
      <div
        className="relative w-full p-4"
        style={{
          background: b.imageUrl
            ? 'linear-gradient(to top, rgba(0,0,0,.72), rgba(0,0,0,.28) 60%, transparent)'
            : 'transparent',
        }}
      >
        {children}
      </div>
    </div>
  );
}

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

  const field =
    'min-h-10 w-full rounded-[12px] border border-[color:var(--hairline)] bg-surface px-3 text-sm outline-none transition focus:border-moss dark:bg-surface-dark';
  const labelText = 'text-sm font-bold text-ink2 dark:text-ink2-dark';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Merchandising"
        title="Offer banners"
        hint="The promo carousel at the top of the customer home screen"
        actions={
          <Button
            onClick={() => {
              setDraft(EMPTY);
              setEditing('new');
              setError(null);
            }}
          >
            + New banner
          </Button>
        }
      />

      {/* ── editor ── */}
      {editing ? (
        <Card className="rise flex flex-col gap-5">
          <h2 className="text-lg font-extrabold tracking-tight">
            {editing === 'new' ? 'New banner' : 'Edit banner'}
          </h2>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
            {/* left: artwork + live preview */}
            <div className="flex flex-col gap-4">
              <ImageUpload
                value={draft.imageUrl}
                bgColor={draft.bgColor}
                onChange={(imageUrl) => setDraft({ ...draft, imageUrl })}
              />

              <div className="flex flex-col gap-2">
                <span className={labelText}>
                  On the phone{' '}
                  <span className="font-medium text-ink3 dark:text-ink3-dark">— live preview</span>
                </span>
                <BannerArt b={draft} className="h-[150px] rounded-[18px] shadow-e2">
                  <p className="truncate text-lg font-extrabold text-white">
                    {draft.title || 'Banner title'}
                  </p>
                  {draft.subtitle ? (
                    <p className="truncate text-sm text-white/85">{draft.subtitle}</p>
                  ) : null}
                  {draft.ctaLabel && draft.linkType !== 'NONE' ? (
                    <span className="mt-2 inline-block rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-[#0A1611]">
                      {draft.ctaLabel}
                    </span>
                  ) : null}
                </BannerArt>
              </div>

              <div className="flex flex-col gap-2">
                <span className={labelText}>
                  Background{' '}
                  <span className="font-medium text-ink3 dark:text-ink3-dark">
                    — used when there is no image
                  </span>
                </span>
                <div className="flex flex-wrap gap-2">
                  {SWATCHES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Background ${c}`}
                      aria-pressed={draft.bgColor === c}
                      onClick={() => setDraft({ ...draft, bgColor: c })}
                      className={`size-9 rounded-full transition duration-150 hover:scale-110 ${
                        draft.bgColor === c
                          ? 'ring-2 ring-[color:var(--series-1)] ring-offset-2 ring-offset-[color:var(--chart-surface)]'
                          : ''
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* right: copy + targeting + schedule */}
            <div className="grid content-start gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className={labelText}>Title</span>
                <input
                  className={field}
                  value={draft.title}
                  maxLength={60}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelText}>Subtitle</span>
                <input
                  className={field}
                  value={draft.subtitle}
                  maxLength={90}
                  onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className={labelText}>Button label</span>
                <input
                  className={field}
                  placeholder="Shop now"
                  maxLength={24}
                  value={draft.ctaLabel}
                  onChange={(e) => setDraft({ ...draft, ctaLabel: e.target.value })}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className={labelText}>Tapping opens</span>
                <select
                  className={field}
                  value={draft.linkType}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      linkType: e.target.value as Draft['linkType'],
                      linkValue: '',
                    })
                  }
                >
                  <option value="NONE">Nothing (display only)</option>
                  <option value="CATEGORY">A category</option>
                  <option value="SEARCH">A search</option>
                  <option value="PRODUCT">A product</option>
                </select>
              </label>

              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className={labelText}>Target</span>
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
                <span className={labelText}>
                  Starts <span className="font-medium text-ink3 dark:text-ink3-dark">— optional</span>
                </span>
                <input
                  type="datetime-local"
                  className={field}
                  value={draft.startsAt}
                  onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelText}>
                  Ends{' '}
                  <span className="font-medium text-ink3 dark:text-ink3-dark">— auto-hides</span>
                </span>
                <input
                  type="datetime-local"
                  className={field}
                  value={draft.endsAt}
                  onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className={labelText}>Order</span>
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
                <span className="text-sm font-bold">Active</span>
              </label>
            </div>
          </div>

          {error ? (
            <p className="text-sm font-semibold text-critical dark:text-critical-dark">{error}</p>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-[color:var(--hairline)] pt-4">
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : (banners.data ?? []).length === 0 ? (
        <Card>
          <EmptyState
            icon="🎏"
            title="No banners yet"
            hint="Upload artwork and it appears at the top of the customer home screen within seconds."
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {banners.data!.map((b, i) => (
            <Card
              key={b.id}
              interactive
              padded={false}
              className="rise flex flex-col overflow-hidden"
            >
              <div style={{ '--d': `${Math.min(i, 6) * 45}ms` } as React.CSSProperties}>
                <BannerArt
                  b={{ imageUrl: b.imageUrl ?? '', bgColor: b.bgColor }}
                  className="h-32"
                >
                  <p className="truncate font-extrabold text-white">{b.title}</p>
                  {b.subtitle ? (
                    <p className="truncate text-xs text-white/85">{b.subtitle}</p>
                  ) : null}
                </BannerArt>
              </div>

              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {/* state carries a word, never colour alone */}
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                      b.liveNow
                        ? 'bg-moss-soft text-ok dark:bg-moss-soft-dark dark:text-ok-dark'
                        : 'bg-surface2 text-ink2 dark:bg-surface2-dark dark:text-ink2-dark'
                    }`}
                  >
                    {b.liveNow ? '● Live now' : b.isActive ? 'Scheduled' : 'Off'}
                  </span>
                  {b.imageUrl ? (
                    <span className="text-xs text-ink3 dark:text-ink3-dark">🖼️ image</span>
                  ) : null}
                  <span className="text-xs text-ink3 dark:text-ink3-dark">#{b.sortOrder}</span>
                  {b.endsAt ? (
                    <span className="text-xs text-ink3 dark:text-ink3-dark">
                      ends {new Date(b.endsAt).toLocaleDateString('en-IN')}
                    </span>
                  ) : null}
                </div>

                <div className="mt-auto flex gap-2">
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
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
