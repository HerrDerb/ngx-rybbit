import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RybbitRuntimeState } from './rybbit-runtime-state.service';
import { RybbitSessionReplayService } from './rybbit-session-replay.service';
import type {
  RybbitConfig,
  RybbitTrackPayload,
  RybbitIdentifyPayload,
  PropertyValue,
} from './rybbit.config';
import { postBeacon } from './rybbit.config';

@Injectable({ providedIn: 'root' })
export class RybbitService {
  private readonly runtimeState = inject(RybbitRuntimeState);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly sessionReplay = inject(RybbitSessionReplayService);
  private customUserId: string | null = null;

  get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private get config(): RybbitConfig {
    return this.runtimeState.config;
  }

  initialize(): void {
    if (!this.isBrowser) return;
    this.loadUserId();
  }

  private loadUserId(): void {
    try {
      const stored = localStorage.getItem(`${this.config.namespace ?? 'rybbit'}-user-id`);
      if (stored) this.customUserId = stored;
    } catch {
      /* localStorage may be blocked */
    }
  }

  private buildPatternRegex(pattern: string): RegExp {
    if (pattern.startsWith('re:')) return new RegExp(pattern.slice(3));
    const escaped = pattern
      .replaceAll('**', '__DOUBLE__')
      .replaceAll('*', '__SINGLE__')
      .replaceAll(/[.+?^${}()|[\]\\]/g, String.raw`\$&`)
      .replaceAll('__DOUBLE__', '.*')
      .replaceAll('__SINGLE__', '[^/]+');
    return new RegExp(`^${escaped}$`);
  }

  private matchPattern(pathname: string, patterns: string[]): string | null {
    for (const p of patterns) {
      try {
        if (this.buildPatternRegex(p).test(pathname)) return p;
      } catch {
        /* invalid pattern, skip */
      }
    }
    return null;
  }

  private createBasePayload(): RybbitTrackPayload | null {
    if (!this.isBrowser) return null;
    if (this.runtimeState.isOptedOut()) return null;

    const url = new URL(location.href);
    let pathname = url.pathname;

    // Hash-router support: /#/dashboard → /dashboard
    if (url.hash?.startsWith('#/')) {
      pathname = url.hash.substring(1);
    }

    if (this.config.skipPatterns?.length && this.matchPattern(pathname, this.config.skipPatterns)) {
      return null;
    }

    const maskMatch = this.config.maskPatterns?.length
      ? this.matchPattern(pathname, this.config.maskPatterns)
      : null;
    if (maskMatch) pathname = maskMatch;

    const payload: RybbitTrackPayload = {
      site_id: String(this.config.siteId),
      type: 'pageview',
      hostname: url.hostname,
      pathname,
      querystring: this.config.trackQuerystring !== false ? url.search : '',
      screenWidth: screen.width,
      screenHeight: screen.height,
      language: navigator.language,
      page_title: document.title,
      referrer: document.referrer,
    };

    if (this.customUserId) payload.user_id = this.customUserId;
    return payload;
  }

  async sendTrack(payload: object): Promise<void> {
    await postBeacon(`${this.config.apiBase}/track`, payload, this.config.apiBase, this.config.debug);
  }

  trackPageview(): void {
    const base = this.createBasePayload();
    if (!base) return;
    this.sendTrack({ ...base, type: 'pageview' });
  }

  trackEvent(eventName: string, properties?: Record<string, PropertyValue>): void {
    if (!eventName?.trim()) {
      if (this.config.debug) console.error('[Rybbit] event name required');
      return;
    }
    const base = this.createBasePayload();
    if (!base) return;
    const payload: Record<string, unknown> = {
      ...base,
      type: 'custom_event',
      event_name: eventName,
    };
    if (properties && Object.keys(properties).length > 0) {
      payload['properties'] = JSON.stringify(properties);
    }
    this.sendTrack(payload);
  }

  trackOutbound(url: string, text = '', target = '_self'): void {
    const base = this.createBasePayload();
    if (!base) return;
    this.sendTrack({
      ...base,
      type: 'outbound',
      properties: JSON.stringify({ url, text, target }),
    });
  }

  trackButtonClick(props: Record<string, unknown>): void {
    const base = this.createBasePayload();
    if (!base) return;
    this.sendTrack({ ...base, type: 'button_click', properties: JSON.stringify(props) });
  }

  trackCopy(props: Record<string, unknown>): void {
    const base = this.createBasePayload();
    if (!base) return;
    this.sendTrack({ ...base, type: 'copy', properties: JSON.stringify(props) });
  }

  trackFormSubmit(props: Record<string, unknown>): void {
    const base = this.createBasePayload();
    if (!base) return;
    this.sendTrack({ ...base, type: 'form_submit', properties: JSON.stringify(props) });
  }

  trackInputChange(props: Record<string, unknown>): void {
    const base = this.createBasePayload();
    if (!base) return;
    this.sendTrack({ ...base, type: 'input_change', properties: JSON.stringify(props) });
  }

  trackError(err: Error, meta: Record<string, unknown> = {}): void {
    const base = this.createBasePayload();
    if (!base) return;
    const props = {
      message: (err.message ?? '').substring(0, 500),
      stack: (err.stack ?? '').substring(0, 2000),
      ...meta,
    };
    this.sendTrack({
      ...base,
      type: 'error',
      event_name: err.name ?? 'Error',
      properties: JSON.stringify(props),
    });
  }

  trackWebVitals(vitals: Record<string, number | null>): void {
    const base = this.createBasePayload();
    if (!base) return;
    this.sendTrack({
      ...base,
      type: 'performance',
      event_name: 'web-vitals',
      properties: JSON.stringify(vitals),
    });
  }

  async identify(userId: string, traits?: Record<string, unknown>): Promise<void> {
    if (!userId?.trim()) {
      if (this.config.debug) console.error('[Rybbit] userId must be non-empty');
      return;
    }
    this.customUserId = userId.trim();
    try {
      localStorage.setItem(`${this.config.namespace ?? 'rybbit'}-user-id`, this.customUserId);
    } catch {
      /* localStorage may be blocked */
    }
    await this.sendIdentify(this.customUserId, traits, true);
  }

  async setTraits(traits: Record<string, unknown>): Promise<void> {
    if (!this.customUserId) {
      if (this.config.debug) console.warn('[Rybbit] call identify() first');
      return;
    }
    await this.sendIdentify(this.customUserId, traits, false);
  }

  clearUserId(): void {
    this.customUserId = null;
    try {
      localStorage.removeItem(`${this.config.namespace ?? 'rybbit'}-user-id`);
    } catch {
      /* blocked */
    }
  }

  getUserId(): string | null {
    return this.customUserId;
  }

  private async sendIdentify(
    userId: string,
    traits?: Record<string, unknown>,
    isNewIdentify = true,
  ): Promise<void> {
    if (this.runtimeState.isOptedOut()) return;
    const payload: RybbitIdentifyPayload = {
      site_id: String(this.config.siteId),
      user_id: userId,
      is_new_identify: isNewIdentify,
      ...(traits ? { traits } : {}),
    };
    await postBeacon(`${this.config.apiBase}/identify`, payload, this.config.apiBase, this.config.debug);
  }

  isExternalUrl(url: string): boolean {
    try {
      return new URL(url).hostname !== globalThis.location?.hostname;
    } catch {
      return false;
    }
  }

  // --- Session replay delegates ---

  startSessionReplay(): void {
    this.sessionReplay.start();
  }
  stopSessionReplay(): void {
    this.sessionReplay.stop();
  }
  isSessionReplayActive(): boolean {
    return this.sessionReplay.isActive();
  }
}
