import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RybbitService } from './rybbit.service';

@Injectable({ providedIn: 'root' })
export class RybbitFormTrackerService {
  private readonly rybbitService = inject(RybbitService);
  private readonly platformId = inject(PLATFORM_ID);

  initialize(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    document.addEventListener('submit', (e) => this.handleSubmit(e), true);
    document.addEventListener('change', (e) => this.handleChange(e), true);
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

  private handleSubmit(e: Event): void {
    const form = e.target as HTMLFormElement;
    if (form.tagName !== 'FORM') return;
    this.rybbitService.trackFormSubmit({
      formId: form.id || '',
      formName: form.name || '',
      formAction: form.action || '',
      method: (form.method || 'get').toUpperCase(),
      fieldCount: form.elements.length,
      ...this.extractDataProps(form),
    });
  }

  private handleChange(e: Event): void {
    const el = e.target as HTMLInputElement;
    const tag = el.tagName?.toUpperCase();
    if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return;
    if (tag === 'INPUT') {
      const t = el.type?.toLowerCase();
      if (t === 'hidden' || t === 'password') return;
    }
    this.rybbitService.trackInputChange({
      element: tag.toLowerCase(),
      ...(tag === 'INPUT' ? { inputType: el.type?.toLowerCase() } : {}),
      inputName: el.name || el.id || '',
      ...(el.form?.id ? { formId: el.form.id } : {}),
      ...this.extractDataProps(el),
    });
  }
}
