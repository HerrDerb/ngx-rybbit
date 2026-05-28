import {
  EnvironmentProviders,
  makeEnvironmentProviders,
  provideAppInitializer,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RYBBIT_CONFIG } from './tokens';
import type { RybbitConfig } from './rybbit.config';
import { RybbitRuntimeState } from './rybbit-runtime-state.service';
import { RybbitService } from './rybbit.service';
import { RybbitConfigFetcherService } from './rybbit-config-fetcher.service';
import { RybbitRouterTrackerService } from './rybbit-router-tracker.service';
import { RybbitButtonTrackerService } from './rybbit-button-tracker.service';
import { RybbitCopyTrackerService } from './rybbit-copy-tracker.service';
import { RybbitFormTrackerService } from './rybbit-form-tracker.service';
import { RybbitErrorTrackerService } from './rybbit-error-tracker.service';
import { RybbitWebVitalsService } from './rybbit-web-vitals.service';
import { RybbitSessionReplayService } from './rybbit-session-replay.service';

/**
 * Bootstraps the Rybbit analytics library for Angular 19+ standalone apps.
 *
 * @example
 * // app.config.ts
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideRouter(routes),
 *     provideRybbit({ siteId: 42, apiBase: 'https://app.rybbit.io/api' }),
 *   ],
 * };
 */
export function provideRybbit(config: RybbitConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: RYBBIT_CONFIG, useValue: config },

    provideAppInitializer(async () => {
      const platformId = inject(PLATFORM_ID);
      if (!isPlatformBrowser(platformId)) return;

      // Hoist all inject() calls before the first await — injection context is
      // only active during the synchronous portion of the callback.
      const configFetcher = inject(RybbitConfigFetcherService);
      const runtimeState = inject(RybbitRuntimeState);
      const rybbitService = inject(RybbitService);
      const routerTracker = inject(RybbitRouterTrackerService);
      const buttonTracker = inject(RybbitButtonTrackerService);
      const copyTracker = inject(RybbitCopyTrackerService);
      const formTracker = inject(RybbitFormTrackerService);
      const errorTracker = inject(RybbitErrorTrackerService);
      const webVitals = inject(RybbitWebVitalsService);
      const sessionReplay = inject(RybbitSessionReplayService);

      // 1. Fetch remote feature-flag config and merge with local config
      const mergedConfig = await configFetcher.fetchAndMergeRemoteConfig();

      // 2. Publish merged config — all services now see the correct effective config
      runtimeState.setEffectiveConfig(mergedConfig);

      // 3. Initialize core service (loads persisted userId from localStorage)
      rybbitService.initialize();

      // 4. Wire up auto-trackers based on merged config
      if (mergedConfig.autoTrackSpa !== false || mergedConfig.trackOutbound !== false) {
        routerTracker.initialize();
      }
      if (mergedConfig.trackButtonClicks) buttonTracker.initialize();
      if (mergedConfig.trackCopy) copyTracker.initialize();
      if (mergedConfig.trackFormInteractions) formTracker.initialize();
      if (mergedConfig.trackErrors) errorTracker.initialize();
      if (mergedConfig.enableWebVitals) webVitals.initialize();
      if (mergedConfig.enableSessionReplay) sessionReplay.initialize();

      // 5. Fire initial pageview
      if (mergedConfig.autoTrackPageview !== false) {
        rybbitService.trackPageview();
      }
    }),
  ]);
}
