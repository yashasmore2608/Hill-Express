import { useRef, useState } from 'react';
import { tokens } from '../lib/api';

const MAX_MB = 5;
const ACCEPT = 'image/jpeg,image/png,image/webp';

/**
 * Banner artwork picker: drag-and-drop, click-to-browse, or paste a URL.
 *
 * The upload goes straight to the API rather than through TanStack Query —
 * it is a one-shot side effect with its own progress, not cached server state.
 *
 * `value` is whatever gets stored on the banner: either a relative
 * `/uploads/...` path we issued, or an external http(s) URL typed by hand.
 */
export function ImageUpload({
  value,
  onChange,
  bgColor,
}: {
  value: string;
  onChange: (url: string) => void;
  /** Shown behind the preview when there is no image, matching the real banner. */
  bgColor: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setError(null);

    // Check client-side too — refusing a 40 MB photo instantly beats waiting
    // for the upload to finish and then being told no.
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`That image is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_MB} MB.`);
      return;
    }
    if (!ACCEPT.split(',').includes(file.type)) {
      setError('Use a JPG, PNG or WebP image.');
      return;
    }

    setBusy(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/v1/admin/uploads/banner', {
        method: 'POST',
        headers: tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {},
        body, // no Content-Type: the browser must set the multipart boundary
      });
      const json = (await res.json()) as { url?: string; message?: string };
      if (!res.ok || !json.url) throw new Error(json.message ?? 'Upload failed');
      onChange(json.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const pick = (files: FileList | null) => {
    const f = files?.[0];
    if (f) void upload(f);
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-bold text-ink2 dark:text-ink2-dark">Banner image</span>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          pick(e.dataTransfer.files);
        }}
        className={`relative overflow-hidden rounded-[16px] border-2 border-dashed transition duration-200 ${
          over
            ? 'border-[color:var(--series-1)] bg-moss-soft dark:bg-moss-soft-dark'
            : 'border-[color:var(--chart-axis)] bg-surface2 dark:bg-surface2-dark'
        }`}
      >
        {value ? (
          <>
            <img
              src={value}
              alt="Banner artwork preview"
              className="h-40 w-full object-cover"
              style={{ background: bgColor }}
            />
            <div className="absolute right-2 top-2 flex gap-1.5">
              <button
                type="button"
                onClick={() => input.current?.click()}
                className="rounded-full bg-black/65 px-3 py-1.5 text-xs font-bold text-white backdrop-blur transition hover:bg-black/80"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => onChange('')}
                className="rounded-full bg-black/65 px-3 py-1.5 text-xs font-bold text-white backdrop-blur transition hover:bg-black/80"
              >
                Remove
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex h-40 w-full flex-col items-center justify-center gap-1.5 px-4 text-center"
          >
            <span aria-hidden className="text-3xl">
              {busy ? '⏳' : '🖼️'}
            </span>
            <span className="text-sm font-bold">
              {busy ? 'Uploading…' : 'Drop an image, or click to browse'}
            </span>
            <span className="text-xs text-ink3 dark:text-ink3-dark">
              JPG, PNG or WebP · up to {MAX_MB} MB · 1200×500 looks best
            </span>
          </button>
        )}

        {busy && value ? (
          <div className="absolute inset-0 grid place-items-center bg-black/45 text-sm font-bold text-white">
            Uploading…
          </div>
        ) : null}
      </div>

      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = ''; // re-picking the same file must still fire
        }}
      />

      {error ? (
        <p className="text-sm font-semibold text-critical dark:text-critical-dark">{error}</p>
      ) : null}

      {/* Escape hatch: artwork already hosted somewhere else. */}
      <details className="text-sm">
        <summary className="cursor-pointer select-none text-ink3 hover:text-ink2 dark:text-ink3-dark dark:hover:text-ink2-dark">
          …or use an image URL
        </summary>
        <input
          className="mt-2 min-h-10 w-full rounded-[12px] border border-[color:var(--hairline)] bg-surface px-3 text-sm outline-none focus:border-moss dark:bg-surface-dark"
          placeholder="https://…"
          value={value.startsWith('/uploads/') ? '' : value}
          onChange={(e) => onChange(e.target.value)}
        />
      </details>
    </div>
  );
}
