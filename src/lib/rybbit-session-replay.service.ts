import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RybbitRuntimeState } from './rybbit-runtime-state.service';
import { postBeacon } from './rybbit.config';

type RecordFn = (opts: { emit: (event: unknown) => void }) => () => void;

/**
 * Records user sessions using rrweb and streams events to the Rybbit session-replay endpoint.
 *
 * Requires: npm install rrweb
 *
 * Sampling: sessionReplaySampleRate (0–100, default 100).
 * Events are buffered and flushed every 5 s or when the buffer reaches 50 events.
 * Opt-out is respected — buffered events are silently dropped when opted out.
 */
@Injectable({ providedIn: 'root' })
export class RybbitSessionReplayService {
  private readonly runtimeState = inject(RybbitRuntimeState);
  private readonly platformId = inject(PLATFORM_ID);

  private stopFn: (() => void) | null = null;
  private eventBuffer: unknown[] = [];
  private sessionId: string | null = null;
  private flushInterval: ReturnType<typeof setInterval> | null = null;

  initialize(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const sampleRate = this.runtimeState.config.sessionReplaySampleRate ?? 100;
    if (Math.random() * 100 > sampleRate) return;
    this.start();
  }

  start(): void {
    if (this.stopFn) return; // already recording
    // Use Function() to prevent Vite/bundlers from statically resolving this
    // optional peer dependency at pre-bundle time.
    (Function('return import("rrweb")')() as Promise<unknown>)
      .then((mod) => {
        // rrweb v1 exports `record` as a named export; v2 may differ
        const record: RecordFn =
          (mod as unknown as { record: RecordFn }).record ??
          (mod as unknown as { default: RecordFn }).default;
        if (typeof record !== 'function') {
          console.warn('[Rybbit] rrweb module structure not recognized');
          return;
        }
        this.sessionId = this.generateSessionId();
        this.stopFn = record({
          emit: (event) => {
            this.eventBuffer.push(event);
            if (this.eventBuffer.length >= 50) this.flush();
          },
        });
        this.flushInterval = setInterval(() => this.flush(), 5_000);
      })
      .catch(() => {
        console.warn('[Rybbit] Session replay requires rrweb. Run: npm install rrweb');
      });
  }

  stop(): void {
    if (this.stopFn) {
      this.stopFn();
      this.stopFn = null;
    }
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flush();
  }

  isActive(): boolean {
    return this.stopFn !== null;
  }

  private flush(): void {
    if (!this.eventBuffer.length) return;
    if (this.runtimeState.isOptedOut()) {
      this.eventBuffer = [];
      return;
    }
    const events = [...this.eventBuffer];
    this.eventBuffer = [];
    this.sendEvents(events).catch(() => {
      /* fire-and-forget */
    });
  }

  private async sendEvents(events: unknown[]): Promise<void> {
    const config = this.runtimeState.config;
    await postBeacon(
      `${config.apiBase}/session-replay/record/${config.siteId}`,
      { session_id: this.sessionId, site_id: String(config.siteId), events },
      config.apiBase,
      config.debug,
    );
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
