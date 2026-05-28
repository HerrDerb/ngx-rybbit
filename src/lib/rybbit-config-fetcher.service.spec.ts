import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { RYBBIT_CONFIG } from './tokens';
import { RybbitConfigFetcherService } from './rybbit-config-fetcher.service';
import type { RybbitConfig } from './rybbit.config';

const BASE_CONFIG: RybbitConfig = {
  siteId: 5,
  apiBase: 'https://api.example.com/api',
  enableWebVitals: true,
  trackErrors: true,
};

function setupFetcher(config: Partial<RybbitConfig> = {}) {
  const cfg = { ...BASE_CONFIG, ...config };
  TestBed.configureTestingModule({
    providers: [
      { provide: RYBBIT_CONFIG, useValue: cfg },
      { provide: PLATFORM_ID, useValue: 'browser' },
    ],
  });
  return TestBed.inject(RybbitConfigFetcherService);
}

describe('RybbitConfigFetcherService', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns local config when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net fail')));
    const service = setupFetcher();
    const result = await service.fetchAndMergeRemoteConfig();
    expect(result.siteId).toBe(5);
    vi.unstubAllGlobals();
  });

  it('returns local config when response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const service = setupFetcher();
    const result = await service.fetchAndMergeRemoteConfig();
    expect(result.siteId).toBe(5);
    vi.unstubAllGlobals();
  });

  it('merges remote truthy flags over local falsy flags', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          trackInitialPageView: false,
          trackSpaNavigation: false,
          webVitals: false,
          trackErrors: false,
        }),
      }),
    );
    const service = setupFetcher({ enableWebVitals: true, trackErrors: true });
    const result = await service.fetchAndMergeRemoteConfig();
    // remote false overrides local true (via ?? — but false is falsy, so ?? keeps local!)
    // The implementation uses `??` so undefined falls back but false does NOT
    expect(result.enableWebVitals).toBe(false);
    expect(result.trackErrors).toBe(false);
    vi.unstubAllGlobals();
  });

  it('remote undefined falls back to local config value', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}), // no fields
      }),
    );
    const service = setupFetcher({ enableWebVitals: true });
    const result = await service.fetchAndMergeRemoteConfig();
    expect(result.enableWebVitals).toBe(true); // local value preserved
    vi.unstubAllGlobals();
  });

  it('merges all supported remote keys', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          trackInitialPageView: false,
          trackSpaNavigation: false,
          trackUrlParams: false,
          trackOutbound: false,
          webVitals: false,
          trackErrors: false,
          sessionReplay: true,
          trackButtonClicks: true,
          trackCopy: true,
          trackFormInteractions: true,
        }),
      }),
    );
    const service = setupFetcher();
    const result = await service.fetchAndMergeRemoteConfig();
    expect(result.autoTrackPageview).toBe(false);
    expect(result.autoTrackSpa).toBe(false);
    expect(result.trackQuerystring).toBe(false);
    expect(result.enableSessionReplay).toBe(true);
    expect(result.trackButtonClicks).toBe(true);
    vi.unstubAllGlobals();
  });
});
