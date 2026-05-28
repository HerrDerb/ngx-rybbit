import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RYBBIT_CONFIG } from './tokens';
import type { RybbitConfig } from './rybbit.config';

/**
 * Holds the effective (post-remote-merge) config and provides the central opt-out check.
 * All tracker services inject this instead of RYBBIT_CONFIG directly so they always
 * see the merged config after the remote fetch completes.
 */
@Injectable({ providedIn: 'root' })
export class RybbitRuntimeState {
  private readonly initialConfig = inject(RYBBIT_CONFIG);
  private readonly platformId = inject(PLATFORM_ID);
  private _effectiveConfig: RybbitConfig | null = null;

  get config(): RybbitConfig {
    return this._effectiveConfig ?? this.initialConfig;
  }

  setEffectiveConfig(config: RybbitConfig): void {
    this._effectiveConfig = config;
  }

  isOptedOut(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    // Support both window.__RYBBIT_OPTOUT__ global and localStorage flag
    if (
      (globalThis.window as Window & { __RYBBIT_OPTOUT__?: unknown })?.['__RYBBIT_OPTOUT__'] !==
      undefined
    )
      return true;
    try {
      const ns = this.config.namespace ?? 'rybbit';
      return (
        localStorage.getItem(`${ns}-disable`) === '1' ||
        localStorage.getItem('disable-rybbit') === '1'
      );
    } catch {
      return false;
    }
  }
}
