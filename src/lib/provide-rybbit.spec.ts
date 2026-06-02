import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, ApplicationInitStatus } from '@angular/core';
import { provideRybbit } from './provide-rybbit';
import { RybbitConfigFetcherService } from './rybbit-config-fetcher.service';
import { RybbitRuntimeState } from './rybbit-runtime-state.service';
import { RybbitService } from './rybbit.service';
import { RybbitRouterTrackerService } from './rybbit-router-tracker.service';
import { RybbitButtonTrackerService } from './rybbit-button-tracker.service';
import { RybbitCopyTrackerService } from './rybbit-copy-tracker.service';
import { RybbitFormTrackerService } from './rybbit-form-tracker.service';
import { RybbitErrorTrackerService } from './rybbit-error-tracker.service';
import { RybbitWebVitalsService } from './rybbit-web-vitals.service';
import { RybbitSessionReplayService } from './rybbit-session-replay.service';
import type { RybbitConfig } from './rybbit.config';

const BASE_CONFIG: RybbitConfig = { siteId: 1, apiBase: 'https://api.test.io/api' };

interface Mocks {
  fetchAndMergeRemoteConfig: ReturnType<typeof vi.fn>;
  setEffectiveConfig: ReturnType<typeof vi.fn>;
  rybbitInitialize: ReturnType<typeof vi.fn>;
  trackPageview: ReturnType<typeof vi.fn>;
  routerInitialize: ReturnType<typeof vi.fn>;
  buttonInitialize: ReturnType<typeof vi.fn>;
  copyInitialize: ReturnType<typeof vi.fn>;
  formInitialize: ReturnType<typeof vi.fn>;
  errorInitialize: ReturnType<typeof vi.fn>;
  webVitalsInitialize: ReturnType<typeof vi.fn>;
  sessionReplayInitialize: ReturnType<typeof vi.fn>;
}

function setup(
  mergedConfigOverrides: Partial<RybbitConfig>,
  localConfigOverrides: Partial<RybbitConfig> = {},
): Mocks {
  const mocks: Mocks = {
    fetchAndMergeRemoteConfig: vi
      .fn()
      .mockResolvedValue({ ...BASE_CONFIG, ...mergedConfigOverrides }),
    setEffectiveConfig: vi.fn(),
    rybbitInitialize: vi.fn(),
    trackPageview: vi.fn(),
    routerInitialize: vi.fn(),
    buttonInitialize: vi.fn(),
    copyInitialize: vi.fn(),
    formInitialize: vi.fn(),
    errorInitialize: vi.fn(),
    webVitalsInitialize: vi.fn(),
    sessionReplayInitialize: vi.fn(),
  };

  TestBed.configureTestingModule({
    providers: [
      provideRybbit({ ...BASE_CONFIG, ...localConfigOverrides }),
      { provide: PLATFORM_ID, useValue: 'browser' },
      {
        provide: RybbitConfigFetcherService,
        useValue: { fetchAndMergeRemoteConfig: mocks.fetchAndMergeRemoteConfig },
      },
      { provide: RybbitRuntimeState, useValue: { setEffectiveConfig: mocks.setEffectiveConfig } },
      {
        provide: RybbitService,
        useValue: { initialize: mocks.rybbitInitialize, trackPageview: mocks.trackPageview },
      },
      { provide: RybbitRouterTrackerService, useValue: { initialize: mocks.routerInitialize } },
      { provide: RybbitButtonTrackerService, useValue: { initialize: mocks.buttonInitialize } },
      { provide: RybbitCopyTrackerService, useValue: { initialize: mocks.copyInitialize } },
      { provide: RybbitFormTrackerService, useValue: { initialize: mocks.formInitialize } },
      { provide: RybbitErrorTrackerService, useValue: { initialize: mocks.errorInitialize } },
      { provide: RybbitWebVitalsService, useValue: { initialize: mocks.webVitalsInitialize } },
      {
        provide: RybbitSessionReplayService,
        useValue: { initialize: mocks.sessionReplayInitialize },
      },
    ],
  });

  return mocks;
}

describe('provideRybbit initializer', () => {
  afterEach(() => vi.restoreAllMocks());

  it('short-circuits all initialization when disabled:true from remote', async () => {
    const mocks = setup({ disabled: true });
    await TestBed.inject(ApplicationInitStatus).donePromise;

    expect(mocks.setEffectiveConfig).not.toHaveBeenCalled();
    expect(mocks.rybbitInitialize).not.toHaveBeenCalled();
    expect(mocks.trackPageview).not.toHaveBeenCalled();
    expect(mocks.routerInitialize).not.toHaveBeenCalled();
    expect(mocks.buttonInitialize).not.toHaveBeenCalled();
    expect(mocks.copyInitialize).not.toHaveBeenCalled();
    expect(mocks.formInitialize).not.toHaveBeenCalled();
    expect(mocks.errorInitialize).not.toHaveBeenCalled();
    expect(mocks.webVitalsInitialize).not.toHaveBeenCalled();
    expect(mocks.sessionReplayInitialize).not.toHaveBeenCalled();
  });

  it('short-circuits when local config has disabled:true and remote has no disabled field', async () => {
    const mocks = setup({ disabled: true }); // remote returns no disabled → ?? falls back to local true
    await TestBed.inject(ApplicationInitStatus).donePromise;

    expect(mocks.setEffectiveConfig).not.toHaveBeenCalled();
    expect(mocks.rybbitInitialize).not.toHaveBeenCalled();
    expect(mocks.trackPageview).not.toHaveBeenCalled();
  });

  it('proceeds with initialization when disabled is false', async () => {
    const mocks = setup({ disabled: false });
    await TestBed.inject(ApplicationInitStatus).donePromise;

    expect(mocks.setEffectiveConfig).toHaveBeenCalledOnce();
    expect(mocks.rybbitInitialize).toHaveBeenCalledOnce();
  });
});

describe('provideRybbit — enableCheckUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function makeResponse(enabled: boolean, ok = true) {
    return Promise.resolve({ ok, json: () => Promise.resolve({ enabled }) } as Response);
  }

  it('skips fetch and initializes when enableCheckUrl is not set', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const mocks = setup({ disabled: false });
    await TestBed.inject(ApplicationInitStatus).donePromise;

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.setEffectiveConfig).toHaveBeenCalledOnce();
  });

  it('initializes when endpoint returns enabled:true', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(makeResponse(true)));
    const mocks = setup({ disabled: false }, { enableCheckUrl: '/api/enabled' });
    await TestBed.inject(ApplicationInitStatus).donePromise;

    expect(mocks.setEffectiveConfig).toHaveBeenCalledOnce();
    expect(mocks.rybbitInitialize).toHaveBeenCalledOnce();
  });

  it('aborts when endpoint returns enabled:false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(makeResponse(false)));
    const mocks = setup({ disabled: false }, { enableCheckUrl: '/api/enabled' });
    await TestBed.inject(ApplicationInitStatus).donePromise;

    expect(mocks.setEffectiveConfig).not.toHaveBeenCalled();
    expect(mocks.rybbitInitialize).not.toHaveBeenCalled();
    expect(mocks.trackPageview).not.toHaveBeenCalled();
  });

  it('aborts when endpoint returns non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(makeResponse(true, false)));
    const mocks = setup({ disabled: false }, { enableCheckUrl: '/api/enabled' });
    await TestBed.inject(ApplicationInitStatus).donePromise;

    expect(mocks.setEffectiveConfig).not.toHaveBeenCalled();
    expect(mocks.rybbitInitialize).not.toHaveBeenCalled();
  });

  it('aborts when fetch throws (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net fail')));
    const mocks = setup({ disabled: false }, { enableCheckUrl: '/api/enabled' });
    await TestBed.inject(ApplicationInitStatus).donePromise;

    expect(mocks.setEffectiveConfig).not.toHaveBeenCalled();
    expect(mocks.rybbitInitialize).not.toHaveBeenCalled();
  });
});
