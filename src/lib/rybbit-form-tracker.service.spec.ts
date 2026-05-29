import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { RYBBIT_CONFIG } from './tokens';
import { RybbitFormTrackerService } from './rybbit-form-tracker.service';
import { RybbitService } from './rybbit.service';
import { RybbitSessionReplayService } from './rybbit-session-replay.service';
import type { RybbitConfig } from './rybbit.config';

const TEST_CONFIG: RybbitConfig = { siteId: 1, apiBase: 'https://api.test.io/api' };

type FormTrackerPrivate = {
  handleSubmit: (e: { target: EventTarget | null }) => void;
  handleChange: (e: { target: EventTarget | null }) => void;
};

describe('RybbitFormTrackerService', () => {
  let service: RybbitFormTrackerService;
  let trackFormSubmitFn: ReturnType<typeof vi.fn>;
  let trackInputChangeFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    trackFormSubmitFn = vi.fn();
    trackInputChangeFn = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: RYBBIT_CONFIG, useValue: TEST_CONFIG },
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: RybbitService,
          useValue: { trackFormSubmit: trackFormSubmitFn, trackInputChange: trackInputChangeFn },
        },
        { provide: RybbitSessionReplayService, useValue: {} },
      ],
    });
    service = TestBed.inject(RybbitFormTrackerService);
  });

  afterEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  function dispatchSubmit(form: HTMLFormElement | HTMLElement) {
    (service as unknown as FormTrackerPrivate).handleSubmit({ target: form });
  }

  function dispatchChange(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
    (service as unknown as FormTrackerPrivate).handleChange({ target: el });
  }

  describe('form submit', () => {
    it('tracks form submit with metadata', () => {
      const form = document.createElement('form');
      form.id = 'login-form';
      form.name = 'login';
      form.action = '/submit';
      form.method = 'post';
      dispatchSubmit(form);
      expect(trackFormSubmitFn).toHaveBeenCalledWith(
        expect.objectContaining({
          formId: 'login-form',
          formName: 'login',
          formAction: expect.stringContaining('/submit'),
          method: 'POST',
        }),
      );
    });

    it('does not track non-form elements', () => {
      const div = document.createElement('div');
      (service as unknown as FormTrackerPrivate).handleSubmit({ target: div });
      expect(trackFormSubmitFn).not.toHaveBeenCalled();
    });
  });

  describe('input change', () => {
    it('tracks text input change', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.name = 'username';
      dispatchChange(input);
      expect(trackInputChangeFn).toHaveBeenCalledWith(
        expect.objectContaining({ element: 'input', inputName: 'username', inputType: 'text' }),
      );
    });

    it('tracks select change', () => {
      const select = document.createElement('select');
      select.name = 'country';
      dispatchChange(select);
      expect(trackInputChangeFn).toHaveBeenCalledWith(
        expect.objectContaining({ element: 'select', inputName: 'country' }),
      );
    });

    it('tracks textarea change', () => {
      const textarea = document.createElement('textarea');
      textarea.name = 'bio';
      dispatchChange(textarea);
      expect(trackInputChangeFn).toHaveBeenCalledWith(
        expect.objectContaining({ element: 'textarea', inputName: 'bio' }),
      );
    });

    it('skips password input', () => {
      const input = document.createElement('input');
      input.type = 'password';
      dispatchChange(input);
      expect(trackInputChangeFn).not.toHaveBeenCalled();
    });

    it('skips hidden input', () => {
      const input = document.createElement('input');
      input.type = 'hidden';
      dispatchChange(input);
      expect(trackInputChangeFn).not.toHaveBeenCalled();
    });

    it('includes formId when input has a parent form', () => {
      const form = document.createElement('form');
      form.id = 'my-form';
      const input = document.createElement('input');
      input.type = 'text';
      input.name = 'email';
      form.appendChild(input);
      document.body.appendChild(form);
      dispatchChange(input);
      expect(trackInputChangeFn).toHaveBeenCalledWith(
        expect.objectContaining({ formId: 'my-form' }),
      );
    });
  });
});
