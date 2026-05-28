import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RybbitService } from './rybbit.service';

@Injectable({ providedIn: 'root' })
export class RybbitButtonTrackerService {
  private readonly rybbitService = inject(RybbitService);
  private readonly platformId = inject(PLATFORM_ID);
  private handler?: (e: MouseEvent) => void;

  initialize(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.handler = (e: MouseEvent) => this.handleClick(e);
    document.addEventListener('click', this.handler, true);
  }

  private handleClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    const button = this.findButton(target);
    if (!button) return;
    // Skip elements handled by [rybbitEvent] directive
    if (button.dataset['rybbitEvent']) return;
    this.rybbitService.trackButtonClick({
      text: button.textContent?.trim().substring(0, 100) ?? '',
      ...this.extractDataProps(button),
    });
  }

  /** Walk up to 3 levels to find the nearest button ancestor */
  private findButton(el: HTMLElement | null): HTMLElement | null {
    if (!el) return null;
    if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') return el;
    if (el.tagName === 'INPUT') {
      const t = (el as HTMLInputElement).type?.toLowerCase();
      if (t === 'submit' || t === 'button') return el;
    }
    let parent = el.parentElement;
    let depth = 0;
    while (parent && depth < 3) {
      if (parent.tagName === 'BUTTON' || parent.getAttribute('role') === 'button') return parent;
      parent = parent.parentElement;
      depth++;
    }
    return null;
  }

  private extractDataProps(el: HTMLElement): Record<string, string> {
    const props: Record<string, string> = {};
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith('data-rybbit-prop-')) {
        props[attr.name.replace('data-rybbit-prop-', '')] = attr.value;
      }
    }
    return props;
  }

  destroy(): void {
    if (this.handler) {
      document.removeEventListener('click', this.handler, true);
    }
  }
}
