import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { RYBBIT_CONFIG } from './tokens';
import { RybbitWebVitalsService } from './rybbit-web-vitals.service';
import { RybbitService } from './rybbit.service';
import { RybbitRuntimeState } from './rybbit-runtime-state.service';
import { RybbitSessionReplayService } from './rybbit-session-replay.service';
import type { RybbitConfig } from './rybbit.config';

const TEST_CONFIG: RybbitConfig = { siteId: 1, apiBase: 'https://api.test.io/api' };

function createLocalStorageMock() {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string): string | null => store[key] ?? null,
    setItem: (key: string, value: string): void => {
      store[key] = String(value);
    },
    removeItem: (key: string): void => {
      delete store[key];
    },
    clear: (): void => {
      for (const k in store) delete store[k];
    },
    key: (index: number): string | null => Object.keys(store)[index] ?? null,
    get length(): number {
      return Object.keys(store).length;
    },
  };
}

function setup() {
  const trackWebVitalsFn = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: RYBBIT_CONFIG, useValue: TEST_CONFIG },
      { provide: PLATFORM_ID, useValue: 'browser' },
      { provide: RybbitService, useValue: { trackWebVitals: trackWebVitalsFn } },
      { provide: RybbitSessionReplayService, useValue: {} },
    ],
  });
  const service = TestBed.inject(RybbitWebVitalsService);
  const runtimeState = TestBed.inject(RybbitRuntimeState);
  return { service, runtimeState, trackWebVitalsFn };
}

describe('RybbitWebVitalsService', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  // Access internals to simulate vital callbacks firing
  function setVitals(svc: RybbitWebVitalsService, partial: Record<string, number | null>) {
    Object.assign((svc as any).vitals, partial);
  }

  function flush(svc: RybbitWebVitalsService) {
    (svc as any).flush();
  }

  function maybeSendAll(svc: RybbitWebVitalsService) {
    (svc as any).maybeSendAll();
  }

  describe('maybeSendAll', () => {
    it('flushes and calls trackWebVitals when all 5 vitals are set', () => {
      const { service, trackWebVitalsFn } = setup();
      setVitals(service, { lcp: 1200, cls: 0.05, inp: 80, fcp: 600, ttfb: 200 });
      maybeSendAll(service);
      expect(trackWebVitalsFn).toHaveBeenCalledOnce();
      expect(trackWebVitalsFn).toHaveBeenCalledWith({
        lcp: 1200,
        cls: 0.05,
        inp: 80,
        fcp: 600,
        ttfb: 200,
      });
    });

    it('does NOT flush when only some vitals are set', () => {
      const { service, trackWebVitalsFn } = setup();
      setVitals(service, { lcp: 1200, cls: 0.05 });
      maybeSendAll(service);
      expect(trackWebVitalsFn).not.toHaveBeenCalled();
    });
  });

  describe('flush', () => {
    it('sends partial vitals when called directly (e.g. on page hide)', () => {
      const { service, trackWebVitalsFn } = setup();
      setVitals(service, { lcp: 1000 }); // only LCP so far
      flush(service);
      expect(trackWebVitalsFn).toHaveBeenCalledOnce();
    });

    it('does not send if no vitals have been recorded', () => {
      const { service, trackWebVitalsFn } = setup();
      flush(service);
      expect(trackWebVitalsFn).not.toHaveBeenCalled();
    });

    it('does not double-send after flush was already called', () => {
      const { service, trackWebVitalsFn } = setup();
      setVitals(service, { lcp: 1000, cls: 0 });
      flush(service);
      flush(service); // second call should be a no-op
      expect(trackWebVitalsFn).toHaveBeenCalledOnce();
    });

    it('does not double-send after maybeSendAll already sent', () => {
      const { service, trackWebVitalsFn } = setup();
      setVitals(service, { lcp: 1, cls: 0, inp: 10, fcp: 100, ttfb: 50 });
      maybeSendAll(service); // sends
      flush(service); // should be no-op
      expect(trackWebVitalsFn).toHaveBeenCalledOnce();
    });

    it('is a no-op when opted out', () => {
      const { service, trackWebVitalsFn } = setup();
      localStorage.setItem('disable-rybbit', '1');
      setVitals(service, { lcp: 1000 });
      flush(service);
      expect(trackWebVitalsFn).not.toHaveBeenCalled();
    });
  });
});
