import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { RYBBIT_CONFIG } from './tokens';
import { RybbitRuntimeState } from './rybbit-runtime-state.service';
import type { RybbitConfig } from './rybbit.config';

const TEST_CONFIG: RybbitConfig = {
  siteId: 1,
  apiBase: 'https://test.example.com/api',
  namespace: 'test',
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

describe('RybbitRuntimeState', () => {
  let service: RybbitRuntimeState;

  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
    TestBed.configureTestingModule({
      providers: [
        { provide: RYBBIT_CONFIG, useValue: TEST_CONFIG },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    service = TestBed.inject(RybbitRuntimeState);
    delete (globalThis.window as unknown as Record<string, unknown>)['__RYBBIT_OPTOUT__'];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (globalThis.window as unknown as Record<string, unknown>)['__RYBBIT_OPTOUT__'];
  });

  describe('config getter', () => {
    it('returns initial config before setEffectiveConfig', () => {
      expect(service.config).toEqual(TEST_CONFIG);
    });

    it('returns effective config after setEffectiveConfig', () => {
      const merged = { ...TEST_CONFIG, siteId: 99 };
      service.setEffectiveConfig(merged);
      expect(service.config.siteId).toBe(99);
    });

    it('replacing effective config updates the returned value', () => {
      service.setEffectiveConfig({ ...TEST_CONFIG, siteId: 10 });
      service.setEffectiveConfig({ ...TEST_CONFIG, siteId: 20 });
      expect(service.config.siteId).toBe(20);
    });
  });

  describe('isOptedOut', () => {
    it('returns false by default', () => {
      expect(service.isOptedOut()).toBe(false);
    });

    it('returns true when window.__RYBBIT_OPTOUT__ is set (even to false)', () => {
      // Any definition of the property counts as opt-out
      (globalThis.window as unknown as Record<string, unknown>)['__RYBBIT_OPTOUT__'] = true;
      expect(service.isOptedOut()).toBe(true);
    });

    it('returns true when localStorage disable-rybbit is "1"', () => {
      localStorage.setItem('disable-rybbit', '1');
      expect(service.isOptedOut()).toBe(true);
    });

    it('returns false when disable-rybbit is not "1"', () => {
      localStorage.setItem('disable-rybbit', 'false');
      expect(service.isOptedOut()).toBe(false);
    });

    it('returns true when namespace-disable localStorage flag is "1"', () => {
      localStorage.setItem('test-disable', '1');
      expect(service.isOptedOut()).toBe(true);
    });

    it('returns false on server platform', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: RYBBIT_CONFIG, useValue: TEST_CONFIG },
          { provide: PLATFORM_ID, useValue: 'server' },
        ],
      });
      const ssrService = TestBed.inject(RybbitRuntimeState);
      (globalThis.window as unknown as Record<string, unknown>)['__RYBBIT_OPTOUT__'] = true;
      expect(ssrService.isOptedOut()).toBe(false);
    });
  });
});
