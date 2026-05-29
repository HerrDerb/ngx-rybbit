import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { RYBBIT_CONFIG } from './tokens';
import { RybbitRuntimeState } from './rybbit-runtime-state.service';
import { RybbitService } from './rybbit.service';
import { RybbitSessionReplayService } from './rybbit-session-replay.service';
import type { RybbitConfig } from './rybbit.config';

type RybbitServicePrivate = {
  sendTrack: (payload: object) => Promise<void>;
};

const TEST_CONFIG: RybbitConfig = { siteId: 42, apiBase: 'https://api.test.io/api' };

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

function setupTestBed(config: Partial<RybbitConfig> = {}) {
  const cfg = { ...TEST_CONFIG, ...config };
  TestBed.configureTestingModule({
    providers: [
      { provide: RYBBIT_CONFIG, useValue: cfg },
      { provide: PLATFORM_ID, useValue: 'browser' },
      {
        provide: RybbitSessionReplayService,
        useValue: { start: vi.fn(), stop: vi.fn(), isActive: vi.fn(() => false) },
      },
    ],
  });
  const service = TestBed.inject(RybbitService);
  const runtimeState = TestBed.inject(RybbitRuntimeState);
  const sendTrackSpy = vi
    .spyOn(service as unknown as RybbitServicePrivate, 'sendTrack')
    .mockResolvedValue(undefined);
  return { service, runtimeState, sendTrackSpy };
}

describe('RybbitService', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    vi.stubGlobal('navigator', { sendBeacon: vi.fn().mockReturnValue(true) });
    history.pushState({}, '', '/');
    delete (globalThis.window as unknown as Record<string, unknown>)['__RYBBIT_OPTOUT__'];
  });

  afterEach(() => {
    delete (globalThis.window as unknown as Record<string, unknown>)['__RYBBIT_OPTOUT__'];
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('initialize / userId persistence', () => {
    it('loads userId from localStorage on initialize()', () => {
      localStorage.setItem('rybbit-user-id', 'stored-user');
      const { service } = setupTestBed();
      service.initialize();
      expect(service.getUserId()).toBe('stored-user');
    });

    it('uses namespace for storage key', () => {
      localStorage.setItem('myapp-user-id', 'ns-user');
      const { service } = setupTestBed({ namespace: 'myapp' });
      service.initialize();
      expect(service.getUserId()).toBe('ns-user');
    });
  });

  describe('trackPageview', () => {
    it('calls sendTrack with type pageview', () => {
      const { service, sendTrackSpy } = setupTestBed();
      service.trackPageview();
      expect(sendTrackSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'pageview', site_id: '42' }),
      );
    });

    it('is a no-op when opted out', () => {
      const { service, sendTrackSpy } = setupTestBed();
      localStorage.setItem('disable-rybbit', '1');
      service.trackPageview();
      expect(sendTrackSpy).not.toHaveBeenCalled();
    });
  });

  describe('trackEvent', () => {
    it('calls sendTrack with type custom_event and event_name', () => {
      const { service, sendTrackSpy } = setupTestBed();
      service.trackEvent('button_click');
      expect(sendTrackSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'custom_event', event_name: 'button_click' }),
      );
    });

    it('JSON.stringifies properties', () => {
      const { service, sendTrackSpy } = setupTestBed();
      service.trackEvent('test', { plan: 'pro', count: 3 });
      const call = sendTrackSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(JSON.parse(call['properties'] as string)).toEqual({ plan: 'pro', count: 3 });
    });

    it('is a no-op for empty event name', () => {
      const { service, sendTrackSpy } = setupTestBed();
      service.trackEvent('');
      expect(sendTrackSpy).not.toHaveBeenCalled();
    });

    it('is a no-op for whitespace event name', () => {
      const { service, sendTrackSpy } = setupTestBed();
      service.trackEvent('   ');
      expect(sendTrackSpy).not.toHaveBeenCalled();
    });
  });

  describe('trackOutbound', () => {
    it('calls sendTrack with type outbound and JSON properties', () => {
      const { service, sendTrackSpy } = setupTestBed();
      service.trackOutbound('https://external.com/page', 'Link', '_blank');
      const call = sendTrackSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(call['type']).toBe('outbound');
      const props = JSON.parse(call['properties'] as string);
      expect(props.url).toBe('https://external.com/page');
      expect(props.text).toBe('Link');
      expect(props.target).toBe('_blank');
    });
  });

  describe('trackError', () => {
    it('sends type error with truncated message and stack', () => {
      const { service, sendTrackSpy } = setupTestBed();
      const err = new Error('Something broke');
      service.trackError(err, { filename: 'app.js', lineno: 10 });
      const call = sendTrackSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(call['type']).toBe('error');
      expect(call['event_name']).toBe('Error');
      const props = JSON.parse(call['properties'] as string);
      expect(props.message).toBe('Something broke');
      expect(props.filename).toBe('app.js');
    });

    it('truncates long messages to 500 chars', () => {
      const { service, sendTrackSpy } = setupTestBed();
      service.trackError(new Error('x'.repeat(600)));
      const call = sendTrackSpy.mock.calls[0][0] as Record<string, unknown>;
      const props = JSON.parse(call['properties'] as string);
      expect(props.message.length).toBe(500);
    });
  });

  describe('identify / setTraits / clearUserId', () => {
    it('identify sets userId and persists to localStorage', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
      const { service } = setupTestBed();
      await service.identify('user-123');
      expect(service.getUserId()).toBe('user-123');
      expect(localStorage.getItem('rybbit-user-id')).toBe('user-123');
      vi.unstubAllGlobals();
    });

    it('identify sends POST to /identify', async () => {
      vi.stubGlobal('navigator', { sendBeacon: undefined });
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);
      const { service } = setupTestBed();
      await service.identify('user-abc', { plan: 'pro' });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/identify'),
        expect.objectContaining({ method: 'POST' }),
      );
      vi.unstubAllGlobals();
    });

    it('identify skips when opted out', async () => {
      const mockBeacon = vi.fn().mockReturnValue(true);
      vi.stubGlobal('navigator', { sendBeacon: mockBeacon });
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);
      const { service } = setupTestBed();
      localStorage.setItem('disable-rybbit', '1');
      await service.identify('user-x');
      expect(mockBeacon).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it('setTraits is a no-op without prior identify', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
      const { service } = setupTestBed();
      await service.setTraits({ plan: 'free' });
      expect(vi.mocked(fetch)).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it('clearUserId removes from state and localStorage', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
      const { service } = setupTestBed();
      await service.identify('user-del');
      service.clearUserId();
      expect(service.getUserId()).toBeNull();
      expect(localStorage.getItem('rybbit-user-id')).toBeNull();
      vi.unstubAllGlobals();
    });
  });

  describe('isExternalUrl', () => {
    it('returns true for different hostname', () => {
      const { service } = setupTestBed();
      expect(service.isExternalUrl('https://external.com/page')).toBe(true);
    });

    it('returns false for same origin', () => {
      const { service } = setupTestBed();
      // test env default is localhost
      expect(service.isExternalUrl(`http://localhost/page`)).toBe(false);
    });

    it('returns false for invalid URL', () => {
      const { service } = setupTestBed();
      expect(service.isExternalUrl('not-a-url')).toBe(false);
    });
  });

  describe('createBasePayload: patterns', () => {
    it('returns null when pathname matches skipPattern (exact)', () => {
      const { service, sendTrackSpy } = setupTestBed({ skipPatterns: ['/secret'] });
      history.pushState({}, '', '/secret');
      service.trackPageview();
      expect(sendTrackSpy).not.toHaveBeenCalled();
    });

    it('returns null when pathname matches skipPattern (glob)', () => {
      const { service, sendTrackSpy } = setupTestBed({ skipPatterns: ['/admin/*'] });
      history.pushState({}, '', '/admin/users');
      service.trackPageview();
      expect(sendTrackSpy).not.toHaveBeenCalled();
    });

    it('replaces pathname when maskPattern matches', () => {
      const { service, sendTrackSpy } = setupTestBed({ maskPatterns: ['/user/*'] });
      history.pushState({}, '', '/user/12345');
      service.trackPageview();
      const call = sendTrackSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(call['pathname']).toBe('/user/*');
    });

    it('handles hash-router paths', () => {
      const { service, sendTrackSpy } = setupTestBed();
      history.pushState({}, '', '/#/dashboard');
      service.trackPageview();
      const call = sendTrackSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(call['pathname']).toBe('/dashboard');
    });

    it('omits querystring when trackQuerystring is false', () => {
      const { service, sendTrackSpy } = setupTestBed({ trackQuerystring: false });
      history.pushState({}, '', '/page?foo=bar');
      service.trackPageview();
      const call = sendTrackSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(call['querystring']).toBe('');
    });

    it('includes querystring by default', () => {
      const { service, sendTrackSpy } = setupTestBed();
      history.pushState({}, '', '/page?foo=bar');
      service.trackPageview();
      const call = sendTrackSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(call['querystring']).toBe('?foo=bar');
    });
  });

  describe('sendTrack', () => {
    it('uses sendBeacon when available', async () => {
      const mockBeacon = vi.fn().mockReturnValue(true);
      vi.stubGlobal('navigator', { sendBeacon: mockBeacon });
      const { service, sendTrackSpy } = setupTestBed();
      sendTrackSpy.mockRestore();
      await (service as unknown as RybbitServicePrivate).sendTrack({
        type: 'pageview',
        site_id: '42',
      });
      expect(mockBeacon).toHaveBeenCalledWith('https://api.test.io/api/track', expect.any(Blob));
      vi.unstubAllGlobals();
    });

    it('falls back to fetch when sendBeacon is unavailable', async () => {
      vi.stubGlobal('navigator', { sendBeacon: undefined });
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);
      const { service, sendTrackSpy } = setupTestBed();
      sendTrackSpy.mockRestore();
      await (service as unknown as RybbitServicePrivate).sendTrack({
        type: 'pageview',
        site_id: '42',
      });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.io/api/track',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"type":"pageview"'),
        }),
      );
      vi.unstubAllGlobals();
    });

    it('falls back to fetch when sendBeacon returns false', async () => {
      vi.stubGlobal('navigator', { sendBeacon: vi.fn().mockReturnValue(false) });
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);
      const { service, sendTrackSpy } = setupTestBed();
      sendTrackSpy.mockRestore();
      await (service as unknown as RybbitServicePrivate).sendTrack({
        type: 'pageview',
        site_id: '42',
      });
      expect(mockFetch).toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it('does not throw when fetch fails', async () => {
      vi.stubGlobal('navigator', { sendBeacon: undefined });
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
      const { service, sendTrackSpy } = setupTestBed();
      sendTrackSpy.mockRestore();
      await expect(
        (service as unknown as RybbitServicePrivate).sendTrack({}),
      ).resolves.toBeUndefined();
      vi.unstubAllGlobals();
    });
  });
});
