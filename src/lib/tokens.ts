import { InjectionToken } from '@angular/core';
import type { RybbitConfig } from './rybbit.config';

export const RYBBIT_CONFIG = new InjectionToken<RybbitConfig>(
  typeof ngDevMode !== 'undefined' && ngDevMode ? 'RYBBIT_CONFIG' : '',
);
