import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RybbitService } from './rybbit.service';
import { RybbitRuntimeState } from './rybbit-runtime-state.service';

@Injectable({ providedIn: 'root' })
export class RybbitErrorTrackerService {
  private readonly rybbitService = inject(RybbitService);
  private readonly runtimeState = inject(RybbitRuntimeState);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly dedupeCache = new Map<string, number>();

  initialize(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    globalThis.window?.addEventListener('error', (e: ErrorEvent) => {
      this.handleError(e.error ?? new Error(e.message), {
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
      });
    });

    globalThis.window?.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
      const err = e.reason instanceof Error ? e.reason : new Error(String(e.reason));
      this.handleError(err, { type: 'unhandledrejection' });
    });
  }

  private handleError(err: Error, meta: Record<string, unknown>): void {
    const msg = err.message ?? '';

    // Skip known noisy browser/framework errors
    if (msg.includes('ResizeObserver loop completed') || msg.includes('ResizeObserver loop limit'))
      return;

    // Skip cross-origin errors (no useful stack info available)
    const origin = globalThis.location?.origin ?? '';
    const filename = typeof meta['filename'] === 'string' ? meta['filename'] : '';
    if (filename) {
      try {
        if (new URL(filename).origin !== origin) return;
      } catch {
        /* invalid URL */
      }
    } else if (err.stack && !err.stack.includes(origin)) return;

    // Deduplicate — same error key suppressed for 1 minute
    const key = [
      err.name ?? 'Error',
      msg,
      filename,
      String(typeof meta['lineno'] === 'number' ? meta['lineno'] : 0),
      String(typeof meta['colno'] === 'number' ? meta['colno'] : 0),
    ].join('|');
    const now = Date.now();
    const lastSeen = this.dedupeCache.get(key);
    if (lastSeen && now - lastSeen < 60_000) return;
    this.dedupeCache.set(key, now);

    this.rybbitService.trackError(err, meta);
  }
}
