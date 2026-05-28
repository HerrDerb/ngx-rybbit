import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RybbitService } from './rybbit.service';

@Injectable({ providedIn: 'root' })
export class RybbitCopyTrackerService {
  private readonly rybbitService = inject(RybbitService);
  private readonly platformId = inject(PLATFORM_ID);

  initialize(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    document.addEventListener('copy', () => this.handleCopy());
  }

  private handleCopy(): void {
    const selection = globalThis.window?.getSelection();
    if (!selection || selection.isCollapsed) return;
    const text = selection.toString();
    if (!text.length) return;
    const anchorNode = selection.anchorNode;
    const sourceEl = anchorNode instanceof HTMLElement ? anchorNode : anchorNode?.parentElement;
    this.rybbitService.trackCopy({
      text: text.substring(0, 500),
      ...(text.length > 500 ? { textLength: text.length } : {}),
      sourceElement: sourceEl?.tagName?.toLowerCase(),
    });
  }
}
