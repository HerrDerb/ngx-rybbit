import { Injectable, inject } from '@angular/core';
import { RybbitRuntimeState } from './rybbit-runtime-state.service';
import type { RybbitConfig } from './rybbit.config';
import { resolveFetchMode } from './rybbit.config';

interface RemoteTrackingConfig {
  trackInitialPageView?: boolean;
  trackSpaNavigation?: boolean;
  trackUrlParams?: boolean;
  trackOutbound?: boolean;
  webVitals?: boolean;
  trackErrors?: boolean;
  sessionReplay?: boolean;
  trackButtonClicks?: boolean;
  trackCopy?: boolean;
  trackFormInteractions?: boolean;
}

@Injectable({ providedIn: 'root' })
export class RybbitConfigFetcherService {
  private readonly runtimeState = inject(RybbitRuntimeState);

  async fetchAndMergeRemoteConfig(): Promise<RybbitConfig> {
    const config = this.runtimeState.config;
    try {
      const url = `${config.apiBase}/site/tracking-config/${config.siteId}`;
      const resp = await fetch(url, { method: 'GET', credentials: 'omit', mode: resolveFetchMode(config.apiBase) });
      if (!resp.ok) return config;
      const remote: RemoteTrackingConfig = await resp.json();
      return {
        ...config,
        autoTrackPageview: remote.trackInitialPageView ?? config.autoTrackPageview,
        autoTrackSpa: remote.trackSpaNavigation ?? config.autoTrackSpa,
        trackQuerystring: remote.trackUrlParams ?? config.trackQuerystring,
        trackOutbound: remote.trackOutbound ?? config.trackOutbound,
        enableWebVitals: remote.webVitals ?? config.enableWebVitals,
        trackErrors: remote.trackErrors ?? config.trackErrors,
        enableSessionReplay: remote.sessionReplay ?? config.enableSessionReplay,
        trackButtonClicks: remote.trackButtonClicks ?? config.trackButtonClicks,
        trackCopy: remote.trackCopy ?? config.trackCopy,
        trackFormInteractions: remote.trackFormInteractions ?? config.trackFormInteractions,
      };
    } catch (err) {
      if (config.debug) console.warn('[Rybbit] Could not fetch remote config:', err);
      return config;
    }
  }
}
