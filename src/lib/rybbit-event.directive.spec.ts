import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Component } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { RYBBIT_CONFIG } from './tokens';
import { RybbitEventDirective } from './rybbit-event.directive';
import { RybbitService } from './rybbit.service';
import { RybbitSessionReplayService } from './rybbit-session-replay.service';
import type { RybbitConfig, PropertyValue } from './rybbit.config';

const TEST_CONFIG: RybbitConfig = { siteId: 1, apiBase: 'https://api.test.io/api' };

@Component({
  standalone: true,
  imports: [RybbitEventDirective],
  template: ` <button [rybbitEvent]="eventName" [rybbitProps]="eventProps">Click</button> `,
})
class TestHostComponent {
  eventName = 'test_click';
  eventProps: Record<string, PropertyValue> = { category: 'navigation' };
}

function setup() {
  const trackEventFn = vi.fn();
  TestBed.configureTestingModule({
    imports: [TestHostComponent],
    providers: [
      { provide: RYBBIT_CONFIG, useValue: TEST_CONFIG },
      { provide: PLATFORM_ID, useValue: 'browser' },
      { provide: RybbitService, useValue: { trackEvent: trackEventFn } },
      { provide: RybbitSessionReplayService, useValue: {} },
    ],
  });
  // Do NOT call detectChanges here — each test sets properties first, then detects
  const fixture: ComponentFixture<TestHostComponent> = TestBed.createComponent(TestHostComponent);
  return { fixture, trackEventFn };
}

describe('RybbitEventDirective', () => {
  afterEach(() => vi.clearAllMocks());

  it('calls trackEvent with the event name on click', () => {
    const { fixture, trackEventFn } = setup();
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    btn.click();
    expect(trackEventFn).toHaveBeenCalledWith('test_click', { category: 'navigation' });
  });

  it('passes rybbitProps to trackEvent', () => {
    const { fixture, trackEventFn } = setup();
    fixture.componentInstance.eventProps = { plan: 'pro', source: 'header' };
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    btn.click();
    expect(trackEventFn).toHaveBeenCalledWith('test_click', { plan: 'pro', source: 'header' });
  });

  it('fires again on each click', () => {
    const { fixture, trackEventFn } = setup();
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    btn.click();
    btn.click();
    btn.click();
    expect(trackEventFn).toHaveBeenCalledTimes(3);
  });

  it('uses updated event name when binding changes', () => {
    const { fixture, trackEventFn } = setup();
    fixture.componentInstance.eventName = 'updated_event';
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    btn.click();
    expect(trackEventFn).toHaveBeenCalledWith('updated_event', expect.anything());
  });
});
