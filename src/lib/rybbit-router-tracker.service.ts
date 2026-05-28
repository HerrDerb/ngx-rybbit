import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { filter, delay } from 'rxjs/operators';
import { RybbitService } from './rybbit.service';
import { RybbitRuntimeState } from './rybbit-runtime-state.service';

@Injectable({ providedIn: 'root' })
export class RybbitRouterTrackerService {
  private readonly router = inject(Router);
  private readonly rybbitService = inject(RybbitService);
  private readonly runtimeState = inject(RybbitRuntimeState);
  private readonly platformId = inject(PLATFORM_ID);
  /**
   * True for the very first NavigationEnd — skipped because the initial pageview
   * is already fired directly by provideRybbit() / RybbitModule.forRoot().
   */
  private isFirstNavigation = true;

  initialize(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const config = this.runtimeState.config;

    // SPA navigation pageview tracking — separate from outbound-link tracking
    if (config.autoTrackSpa !== false) {
      this.router.events
        .pipe(
          filter((event) => event instanceof NavigationEnd),
          // Yield to microtask queue so document.title reflects the new route before tracking fires
          delay(0),
        )
        .subscribe(() => {
          if (this.isFirstNavigation) {
            this.isFirstNavigation = false;
            return;
          }
          this.rybbitService.trackPageview();
        });
    }

    // Global outbound-link tracker (independent of SPA tracking)
    if (config.trackOutbound !== false) {
      document.addEventListener('click', (e: MouseEvent) => {
        const link = (e.target as Element)?.closest('a');
        if (link?.href && this.rybbitService.isExternalUrl(link.href)) {
          this.rybbitService.trackOutbound(
            link.href,
            link.innerText?.trim() || link.textContent?.trim() || '',
            link.target || '_self',
          );
        }
      });
    }
  }
}
