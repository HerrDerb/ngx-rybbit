import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RybbitService } from './rybbit.service';
import { RybbitRuntimeState } from './rybbit-runtime-state.service';

/**
 * Collects Core Web Vitals (LCP, CLS, INP, FCP, TTFB) and sends a single combined event.
 *
 * Requires: npm install web-vitals
 *
 * Flush strategy:
 *   - Immediately when all 5 vitals have fired
 *   - On visibilitychange:hidden / pagehide (partial results accepted — INP
 *     never fires if the user never interacts)
 */
@Injectable({ providedIn: 'root' })
export class RybbitWebVitalsService {
  private readonly rybbitService = inject(RybbitService);
  private readonly runtimeState = inject(RybbitRuntimeState);
  private readonly platformId = inject(PLATFORM_ID);

  private vitals: Record<string, number | null> = {
    lcp: null,
    cls: null,
    inp: null,
    fcp: null,
    ttfb: null,
  };
  private sent = false;

  initialize(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Use Function() to prevent Vite/bundlers from statically resolving this
    // optional peer dependency at pre-bundle time.
    (Function('return import("web-vitals")')() as Promise<{
      onLCP: (cb: (m: { value: number }) => void) => void;
      onCLS: (cb: (m: { value: number }) => void) => void;
      onINP: (cb: (m: { value: number }) => void) => void;
      onFCP: (cb: (m: { value: number }) => void) => void;
      onTTFB: (cb: (m: { value: number }) => void) => void;
    }>)
      .then(({ onLCP, onCLS, onINP, onFCP, onTTFB }) => {
        onLCP((m) => {
          this.vitals['lcp'] = m.value;
          this.maybeSendAll();
        });
        onCLS((m) => {
          this.vitals['cls'] = m.value;
          this.maybeSendAll();
        });
        onINP((m) => {
          this.vitals['inp'] = m.value;
          this.maybeSendAll();
        });
        onFCP((m) => {
          this.vitals['fcp'] = m.value;
          this.maybeSendAll();
        });
        onTTFB((m) => {
          this.vitals['ttfb'] = m.value;
          this.maybeSendAll();
        });
      })
      .catch(() => {
        console.warn(
          '[Rybbit] Web Vitals requires web-vitals package. Run: npm install web-vitals',
        );
      });

    // Flush partial results on page hide in case INP never fires
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush();
    });
    globalThis.window?.addEventListener('pagehide', () => this.flush());
  }

  private maybeSendAll(): void {
    if (this.sent) return;
    if (Object.values(this.vitals).every((v) => v !== null)) {
      this.flush();
    }
  }

  private flush(): void {
    if (this.sent) return;
    if (this.runtimeState.isOptedOut()) return;
    const hasAny = Object.values(this.vitals).some((v) => v !== null);
    if (!hasAny) return;
    this.sent = true;
    this.rybbitService.trackWebVitals({ ...this.vitals });
  }
}
