import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { env } from '../config/env';

/**
 * Public prefix for everything we store. main.ts mounts the same root at this
 * path, so a URL issued here is directly fetchable — no rewriting in between.
 */
const URL_PREFIX = '/uploads/';

/**
 * Nothing younger than this is ever swept. Artwork is uploaded BEFORE the
 * banner row that references it exists, so a file with no referrer is the
 * normal state of a form somebody is still filling in — not garbage.
 */
const SWEEP_MIN_AGE_MS = 24 * 3_600_000;

@Injectable()
export class UploadsService {
  private readonly log = new Logger(UploadsService.name);

  /**
   * Absolute upload root, resolved exactly as main.ts resolves it for the
   * static mount — one answer, so a stored URL and the file on disk can never
   * disagree about where the root is.
   */
  readonly root = resolve(process.cwd(), env.UPLOAD_DIR);

  private dirFor(subdir: string): string {
    const dir = resolve(this.root, subdir);
    // The subdirs are ours, not user input, but a traversal here would let a
    // future caller write anywhere on the disk. Cheap to rule out for good.
    if (dir !== this.root && !dir.startsWith(this.root + sep)) {
      throw new Error(`Upload subdir escapes the upload root: ${subdir}`);
    }
    return dir;
  }

  /**
   * Store bytes and return the URL they are served at.
   *
   * The filename is a content hash, which buys two things: identical bytes
   * collapse onto one file, and a name never changes once issued — which is
   * what makes it safe for main.ts to serve this tree `immutable`.
   */
  async saveBuffer(subdir: string, buf: Buffer, ext: string): Promise<{ url: string }> {
    const dir = this.dirFor(subdir);
    await mkdir(dir, { recursive: true });
    const digest = createHash('sha256').update(buf).digest('hex').slice(0, 32);
    const name = `${digest}.${ext}`;
    await writeFile(join(dir, name), buf);
    return { url: `${URL_PREFIX}${subdir}/${name}` };
  }

  /**
   * Delete the file behind one of our URLs.
   *
   * Silent on anything that is not ours: a banner's image may be an external
   * http(s) URL somebody typed by hand, and "delete the banner" must never
   * mean "try to delete somebody else's server". Missing files are fine too —
   * this runs after a row is already gone, so it must not be able to fail the
   * operation that called it.
   */
  async removeByUrl(url: string | null | undefined): Promise<void> {
    if (!url?.startsWith(URL_PREFIX)) return;

    const abs = resolve(this.root, url.slice(URL_PREFIX.length));
    if (!abs.startsWith(this.root + sep)) return;

    try {
      await rm(abs, { force: true });
    } catch (e) {
      this.log.warn(`could not remove ${url}: ${e instanceof Error ? e.message : e}`);
    }
  }

  /**
   * Bin files in one subdir that no row points at any more.
   *
   * `referenced` is whatever the owning table holds, external URLs included —
   * those simply never match a local filename, so they are ignored for free.
   * Scoped to a single subdir on purpose: the banner sweeper must never be
   * able to reach the invoice PDFs next door.
   */
  async sweepOrphans(referenced: ReadonlySet<string>, subdir = 'banners'): Promise<void> {
    const dir = this.dirFor(subdir);

    let names: string[];
    try {
      names = await readdir(dir);
    } catch {
      return; // nothing uploaded yet
    }

    const cutoff = Date.now() - SWEEP_MIN_AGE_MS;
    let removed = 0;

    for (const name of names) {
      const url = `${URL_PREFIX}${subdir}/${name}`;
      if (referenced.has(url)) continue;

      const abs = join(dir, name);
      try {
        const info = await stat(abs);
        if (!info.isFile() || info.mtimeMs > cutoff) continue;
        await rm(abs, { force: true });
        removed++;
      } catch (e) {
        this.log.warn(`could not sweep ${name}: ${e instanceof Error ? e.message : e}`);
      }
    }

    if (removed > 0) this.log.log(`swept ${removed} orphaned file(s) from ${subdir}/`);
  }
}
