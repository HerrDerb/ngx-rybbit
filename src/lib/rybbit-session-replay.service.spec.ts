import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { RYBBIT_CONFIG } from './tokens';
import { RybbitSessionReplayService } from './rybbit-session-replay.service';
import type { RybbitConfig } from './rybbit.config';

const TEST_CONFIG: RybbitConfig = {
  siteId: 7,
  apiBase: 'https://api.test.io/api',
  sessionReplaySampleRate: 100,
};

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

function setup(configOverrides: Partial<RybbitConfig> = {}) {
  const cfg = { ...TEST_CONFIG, ...configOverrides };
  TestBed.configureTestingModule({
    providers: [
      { provide: RYBBIT_CONFIG, useValue: cfg },
      { provide: PLATFORM_ID, useValue: 'browser' },
    ],
  });
  const service = TestBed.inject(RybbitSessionReplayService);
  return { service };
}

describe('RybbitSessionReplayService', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe('initial state', () => {
    it('isActive() is false before start()', () => {
      const { service } = setup();
      expect(service.isActive()).toBe(false);
    });
  });

  describe('stop() before start()', () => {
    it('does not throw and remains inactive', () => {
      const { service } = setup();
      expect(() => service.stop()).not.toThrow();
      expect(service.isActive()).toBe(false);
    });
  });

  describe('sampling', () => {
    it('does NOT call start when sample rate is 0', () => {
      const { service } = setup({ sessionReplaySampleRate: 0 });
      const startSpy = vi.spyOn(service, 'start');
      vi.spyOn(Math, 'random').mockReturnValue(0.5); // 50 > 0
      service.initialize();
      expect(startSpy).not.toHaveBeenCalled();
    });

    it('calls start when sample rate is 100', () => {
      const { service } = setup({ sessionReplaySampleRate: 100 });
      const startSpy = vi.spyOn(service, 'start').mockImplementation(() => {});
      vi.spyOn(Math, 'random').mockReturnValue(0.5); // 50 <= 100
      service.initialize();
      expect(startSpy).toHaveBeenCalledOnce();
    });
  });

  describe('event buffer flush', () => {
    it('drops buffer when opted out instead of sending', () => {
      const { service } = setup();
      const mockBeacon = vi.fn().mockReturnValue(true);
      vi.stubGlobal('navigator', { sendBeacon: mockBeacon });
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);
      localStorage.setItem('disable-rybbit', '1');

      (service as any).eventBuffer = ['event1', 'event2'];
      (service as any).flush();

      expect(mockBeacon).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
      expect((service as any).eventBuffer).toHaveLength(0);
      vi.unstubAllGlobals();
    });

    it('sends events via sendBeacon when available', async () => {
      const { service } = setup();
      const mockBeacon = vi.fn().mockReturnValue(true);
      vi.stubGlobal('navigator', { sendBeacon: mockBeacon });

      (service as any).sessionId = 'test-session-id';
      (service as any).eventBuffer = [{ type: 2 }, { type: 3 }];
      (service as any).flush();

      await new Promise((r) => setTimeout(r, 0));

      expect(mockBeacon).toHaveBeenCalledWith(
        expect.stringContaining('/session-replay/record/7'),
        expect.any(Blob),
      );
      vi.unstubAllGlobals();
    });

    it('sends events to correct endpoint via fetch fallback', async () => {
      const { service } = setup();
      vi.stubGlobal('navigator', { sendBeacon: undefined });
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      (service as any).sessionId = 'test-session-id';
      (service as any).eventBuffer = [{ type: 2 }, { type: 3 }];
      (service as any).flush();

      await new Promise((r) => setTimeout(r, 0));

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/session-replay/record/7'),
        expect.objectContaining({ method: 'POST' }),
      );
      vi.unstubAllGlobals();
    });

    it('flushes remaining buffer on stop()', () => {
      const { service } = setup();
      const flushSpy = vi.spyOn(service as any, 'flush');
      service.stop();
      expect(flushSpy).toHaveBeenCalled();
    });
  });
});
