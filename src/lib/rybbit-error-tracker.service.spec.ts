import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { RYBBIT_CONFIG } from './tokens';
import { RybbitErrorTrackerService } from './rybbit-error-tracker.service';
import { RybbitService } from './rybbit.service';
import { RybbitSessionReplayService } from './rybbit-session-replay.service';
import type { RybbitConfig } from './rybbit.config';

const TEST_CONFIG: RybbitConfig = { siteId: 1, apiBase: 'https://api.test.io/api' };
// Use the test environment origin so same-origin check passes
const SAME_ORIGIN_FILE = `${globalThis.location?.origin}/app.js`;

type ErrorTrackerPrivate = {
  dedupeCache: Map<string, number>;
  handleError: (err: Error, meta: Record<string, unknown>) => void;
};

describe('RybbitErrorTrackerService', () => {
  let service: RybbitErrorTrackerService;
  let trackErrorFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    trackErrorFn = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: RYBBIT_CONFIG, useValue: TEST_CONFIG },
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: RybbitService, useValue: { trackError: trackErrorFn } },
        { provide: RybbitSessionReplayService, useValue: {} },
      ],
    });
    service = TestBed.inject(RybbitErrorTrackerService);
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Reset dedupe cache
    (service as unknown as ErrorTrackerPrivate).dedupeCache.clear();
  });

  // Call the private handler directly with full control
  function handle(err: Error, meta: Record<string, unknown> = {}) {
    (service as unknown as ErrorTrackerPrivate).handleError(err, meta);
  }

  describe('basic error tracking', () => {
    it('tracks a same-origin error', () => {
      handle(new Error('Something failed'), { filename: SAME_ORIGIN_FILE, lineno: 5, colno: 1 });
      expect(trackErrorFn).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Something failed' }),
        expect.anything(),
      );
    });

    it('tracks an unhandledrejection-style error (no filename, stack contains origin)', () => {
      // Manually craft a fake Error with a same-origin stack
      const err = new Error('Promise rejected');
      Object.defineProperty(err, 'stack', {
        value: `Error: Promise rejected\n    at ${globalThis.location?.origin}/app.js:10:5`,
        configurable: true,
      });
      handle(err, { type: 'unhandledrejection' });
      expect(trackErrorFn).toHaveBeenCalled();
    });
  });

  describe('filtering', () => {
    it('skips ResizeObserver loop completed errors', () => {
      handle(new Error('ResizeObserver loop completed with undelivered notifications.'), {
        filename: SAME_ORIGIN_FILE,
      });
      expect(trackErrorFn).not.toHaveBeenCalled();
    });

    it('skips ResizeObserver loop limit errors', () => {
      handle(new Error('ResizeObserver loop limit exceeded'), { filename: SAME_ORIGIN_FILE });
      expect(trackErrorFn).not.toHaveBeenCalled();
    });

    it('skips cross-origin errors (different hostname filename)', () => {
      handle(new Error('Script error.'), { filename: 'https://cdn.other.com/lib.js' });
      expect(trackErrorFn).not.toHaveBeenCalled();
    });

    it('skips errors with cross-origin stack and no filename', () => {
      const err = new Error('remote error');
      Object.defineProperty(err, 'stack', {
        value: `Error: remote\n    at https://cdn.other.com/widget.js:1:1`,
      });
      handle(err, {});
      expect(trackErrorFn).not.toHaveBeenCalled();
    });
  });

  describe('deduplication', () => {
    it('tracks an error only once within 1 minute', () => {
      handle(new Error('Dupe error'), { filename: SAME_ORIGIN_FILE, lineno: 1, colno: 1 });
      handle(new Error('Dupe error'), { filename: SAME_ORIGIN_FILE, lineno: 1, colno: 1 });
      expect(trackErrorFn).toHaveBeenCalledOnce();
    });

    it('tracks the same error again after 1 minute', () => {
      const key = ['Error', 'Stale error', SAME_ORIGIN_FILE, 1, 1].join('|');
      // Pre-populate dedupe cache as if error was seen 2 minutes ago
      (service as unknown as ErrorTrackerPrivate).dedupeCache.set(key, Date.now() - 120_000);
      handle(new Error('Stale error'), { filename: SAME_ORIGIN_FILE, lineno: 1, colno: 1 });
      expect(trackErrorFn).toHaveBeenCalledOnce();
    });

    it('tracks different errors independently', () => {
      handle(new Error('Error A'), { filename: SAME_ORIGIN_FILE, lineno: 1 });
      handle(new Error('Error B'), { filename: SAME_ORIGIN_FILE, lineno: 2 });
      expect(trackErrorFn).toHaveBeenCalledTimes(2);
    });
  });
});
