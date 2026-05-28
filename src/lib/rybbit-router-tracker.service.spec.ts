import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subject } from 'rxjs';
import { RYBBIT_CONFIG } from './tokens';
import { RybbitRouterTrackerService } from './rybbit-router-tracker.service';
import { RybbitService } from './rybbit.service';
import { RybbitSessionReplayService } from './rybbit-session-replay.service';
import type { RybbitConfig } from './rybbit.config';

const TEST_CONFIG: RybbitConfig = { siteId: 1, apiBase: 'https://api.test.io/api' };

function setup(configOverrides: Partial<RybbitConfig> = {}) {
  const cfg = { ...TEST_CONFIG, ...configOverrides };
  const routerEvents$ = new Subject<NavigationEnd>();
  const mockRouter = { events: routerEvents$.asObservable() };
  const trackPageviewFn = vi.fn();
  const trackOutboundFn = vi.fn();
  const isExternalUrlFn = vi.fn((url: string) => url.startsWith('https://external'));

  TestBed.configureTestingModule({
    providers: [
      { provide: RYBBIT_CONFIG, useValue: cfg },
      { provide: PLATFORM_ID, useValue: 'browser' },
      { provide: Router, useValue: mockRouter },
      {
        provide: RybbitService,
        useValue: {
          trackPageview: trackPageviewFn,
          trackOutbound: trackOutboundFn,
          isExternalUrl: isExternalUrlFn,
        },
      },
      { provide: RybbitSessionReplayService, useValue: {} },
    ],
  });

  const service = TestBed.inject(RybbitRouterTrackerService);
  return { service, routerEvents$, trackPageviewFn, trackOutboundFn, isExternalUrlFn };
}

describe('RybbitRouterTrackerService', () => {
  afterEach(() => vi.restoreAllMocks());

  describe('SPA navigation tracking', () => {
    it('skips the first NavigationEnd (initial pageview handled by provideRybbit)', () => {
      vi.useFakeTimers();
      const { service, routerEvents$, trackPageviewFn } = setup();
      service.initialize();

      routerEvents$.next(new NavigationEnd(1, '/home', '/home'));
      vi.runAllTimers();
      vi.useRealTimers();

      expect(trackPageviewFn).not.toHaveBeenCalled();
    });

    it('tracks subsequent NavigationEnd as pageview', () => {
      vi.useFakeTimers();
      const { service, routerEvents$, trackPageviewFn } = setup();
      service.initialize();

      routerEvents$.next(new NavigationEnd(1, '/home', '/home'));
      vi.runAllTimers(); // skipped (first nav)
      routerEvents$.next(new NavigationEnd(2, '/about', '/about'));
      vi.runAllTimers();
      vi.useRealTimers();

      expect(trackPageviewFn).toHaveBeenCalledOnce();
    });

    it('tracks each subsequent navigation individually', () => {
      vi.useFakeTimers();
      const { service, routerEvents$, trackPageviewFn } = setup();
      service.initialize();

      routerEvents$.next(new NavigationEnd(1, '/a', '/a'));
      vi.runAllTimers(); // skip
      routerEvents$.next(new NavigationEnd(2, '/b', '/b'));
      vi.runAllTimers();
      routerEvents$.next(new NavigationEnd(3, '/c', '/c'));
      vi.runAllTimers();
      vi.useRealTimers();

      expect(trackPageviewFn).toHaveBeenCalledTimes(2);
    });

    it('does NOT subscribe to NavigationEnd when autoTrackSpa is false', () => {
      vi.useFakeTimers();
      const { service, routerEvents$, trackPageviewFn } = setup({ autoTrackSpa: false });
      service.initialize();

      routerEvents$.next(new NavigationEnd(1, '/home', '/home'));
      vi.runAllTimers();
      routerEvents$.next(new NavigationEnd(2, '/about', '/about'));
      vi.runAllTimers();
      vi.useRealTimers();

      expect(trackPageviewFn).not.toHaveBeenCalled();
    });
  });

  describe('outbound link tracking', () => {
    it('tracks clicks on external anchor links', () => {
      const { service, trackOutboundFn } = setup();
      service.initialize();

      const link = document.createElement('a');
      link.href = 'https://external.example.com/page';
      link.textContent = 'Click me';
      document.body.appendChild(link);
      link.click();

      expect(trackOutboundFn).toHaveBeenCalledWith(
        'https://external.example.com/page',
        'Click me',
        '_self',
      );
      document.body.removeChild(link);
    });

    it('does not track internal link clicks', () => {
      const { service, trackOutboundFn } = setup();
      service.initialize();

      const link = document.createElement('a');
      link.href = 'http://internal.example.com/page';
      document.body.appendChild(link);
      link.click();

      expect(trackOutboundFn).not.toHaveBeenCalled();
      document.body.removeChild(link);
    });

    it('does not track outbound when trackOutbound is false', () => {
      const { service, trackOutboundFn } = setup({ trackOutbound: false });
      service.initialize();

      const link = document.createElement('a');
      link.href = 'https://external.example.com/page';
      document.body.appendChild(link);
      link.click();

      expect(trackOutboundFn).not.toHaveBeenCalled();
      document.body.removeChild(link);
    });
  });
});
