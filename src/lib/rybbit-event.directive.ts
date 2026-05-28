import { Directive, Input, HostListener, inject } from '@angular/core';
import { RybbitService } from './rybbit.service';
import type { PropertyValue } from './rybbit.config';

/**
 * Declarative analytics event tracking directive.
 * Angular equivalent of the `data-rybbit-event` HTML attribute in script.js.
 *
 * @example
 * <button rybbitEvent="signup_click" [rybbitProps]="{ plan: 'pro' }">Sign Up</button>
 */
@Directive({
  selector: '[rybbitEvent]',
  standalone: true,
})
export class RybbitEventDirective {
  private readonly rybbitService = inject(RybbitService);

  /** Name of the custom event to fire on click */
  @Input({ required: true }) rybbitEvent!: string;

  /** Optional key-value properties attached to the event */
  @Input() rybbitProps?: Record<string, PropertyValue>;

  @HostListener('click')
  onClick(): void {
    if (this.rybbitEvent) {
      this.rybbitService.trackEvent(this.rybbitEvent, this.rybbitProps);
    }
  }
}
