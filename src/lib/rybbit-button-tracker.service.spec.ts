import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { RYBBIT_CONFIG } from './tokens';
import { RybbitButtonTrackerService } from './rybbit-button-tracker.service';
import { RybbitService } from './rybbit.service';
import { RybbitSessionReplayService } from './rybbit-session-replay.service';
import type { RybbitConfig } from './rybbit.config';

const TEST_CONFIG: RybbitConfig = { siteId: 1, apiBase: 'https://api.test.io/api' };

describe('RybbitButtonTrackerService', () => {
  let service: RybbitButtonTrackerService;
  let trackButtonClickFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    trackButtonClickFn = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: RYBBIT_CONFIG, useValue: TEST_CONFIG },
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: RybbitService, useValue: { trackButtonClick: trackButtonClickFn } },
        { provide: RybbitSessionReplayService, useValue: {} },
      ],
    });
    service = TestBed.inject(RybbitButtonTrackerService);
  });

  afterEach(() => {
    service.destroy();
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  // Helper: call private handleClick
  function dispatchHandle(el: HTMLElement) {
    (service as any).handleClick({ target: el });
  }

  describe('findButton', () => {
    it('tracks click directly on a BUTTON element', () => {
      const btn = document.createElement('button');
      btn.textContent = 'Submit';
      dispatchHandle(btn);
      expect(trackButtonClickFn).toHaveBeenCalledWith(expect.objectContaining({ text: 'Submit' }));
    });

    it('tracks click on a span inside a button (walks up DOM)', () => {
      const btn = document.createElement('button');
      btn.textContent = 'Buy';
      const icon = document.createElement('span');
      icon.textContent = '';
      btn.appendChild(icon);
      document.body.appendChild(btn);
      dispatchHandle(icon);
      expect(trackButtonClickFn).toHaveBeenCalled();
    });

    it('tracks INPUT[type=submit]', () => {
      const input = document.createElement('input');
      input.type = 'submit';
      dispatchHandle(input);
      expect(trackButtonClickFn).toHaveBeenCalled();
    });

    it('tracks INPUT[type=button]', () => {
      const input = document.createElement('input');
      input.type = 'button';
      dispatchHandle(input);
      expect(trackButtonClickFn).toHaveBeenCalled();
    });

    it('tracks element with role=button', () => {
      const div = document.createElement('div');
      div.setAttribute('role', 'button');
      div.textContent = 'Custom';
      dispatchHandle(div);
      expect(trackButtonClickFn).toHaveBeenCalled();
    });

    it('does NOT track a plain div', () => {
      const div = document.createElement('div');
      div.textContent = 'Not a button';
      dispatchHandle(div);
      expect(trackButtonClickFn).not.toHaveBeenCalled();
    });

    it('does NOT track a plain text node', () => {
      dispatchHandle(null as any);
      expect(trackButtonClickFn).not.toHaveBeenCalled();
    });
  });

  describe('data-rybbit-event skip', () => {
    it('skips buttons with data-rybbit-event (handled by directive)', () => {
      const btn = document.createElement('button');
      btn.setAttribute('data-rybbit-event', 'some_event');
      dispatchHandle(btn);
      expect(trackButtonClickFn).not.toHaveBeenCalled();
    });
  });

  describe('data-rybbit-prop-* extraction', () => {
    it('extracts data-rybbit-prop-* attributes as properties', () => {
      const btn = document.createElement('button');
      btn.textContent = 'Checkout';
      btn.setAttribute('data-rybbit-prop-plan', 'pro');
      btn.setAttribute('data-rybbit-prop-currency', 'USD');
      dispatchHandle(btn);
      expect(trackButtonClickFn).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Checkout', plan: 'pro', currency: 'USD' }),
      );
    });
  });
});
