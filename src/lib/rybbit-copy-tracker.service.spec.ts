import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { RYBBIT_CONFIG } from './tokens';
import { RybbitCopyTrackerService } from './rybbit-copy-tracker.service';
import { RybbitService } from './rybbit.service';
import { RybbitSessionReplayService } from './rybbit-session-replay.service';
import type { RybbitConfig } from './rybbit.config';

const TEST_CONFIG: RybbitConfig = { siteId: 1, apiBase: 'https://api.test.io/api' };

type CopyTrackerPrivate = {
  handleCopy: () => void;
};

function makeSelection(text: string): Selection {
  const range = document.createRange();
  const textNode = document.createTextNode(text);
  document.body.appendChild(textNode);
  range.selectNode(textNode);
  const sel = globalThis.window?.getSelection() ?? window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
  return sel;
}

describe('RybbitCopyTrackerService', () => {
  let service: RybbitCopyTrackerService;
  let trackCopyFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    trackCopyFn = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: RYBBIT_CONFIG, useValue: TEST_CONFIG },
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: RybbitService, useValue: { trackCopy: trackCopyFn } },
        { provide: RybbitSessionReplayService, useValue: {} },
      ],
    });
    service = TestBed.inject(RybbitCopyTrackerService);
  });

  afterEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    globalThis.window?.getSelection()?.removeAllRanges();
  });

  // Invoke private handler directly to avoid needing a real copy event
  function triggerHandle() {
    (service as unknown as CopyTrackerPrivate).handleCopy();
  }

  it('tracks copy with the selected text', () => {
    makeSelection('Hello World');
    triggerHandle();
    expect(trackCopyFn).toHaveBeenCalledWith(expect.objectContaining({ text: 'Hello World' }));
  });

  it('truncates text longer than 500 chars and includes textLength', () => {
    const longText = 'a'.repeat(600);
    makeSelection(longText);
    triggerHandle();
    expect(trackCopyFn).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'a'.repeat(500), textLength: 600 }),
    );
  });

  it('does NOT include textLength when text is ≤ 500 chars', () => {
    makeSelection('short');
    triggerHandle();
    const call = trackCopyFn.mock.calls[0][0] as Record<string, unknown>;
    expect('textLength' in call).toBe(false);
  });

  it('is a no-op when selection is collapsed (nothing selected)', () => {
    globalThis.window?.getSelection()?.removeAllRanges();
    triggerHandle();
    expect(trackCopyFn).not.toHaveBeenCalled();
  });
});
