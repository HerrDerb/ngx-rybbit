export type PropertyValue = string | number | boolean;

/** Returns 'cors' for absolute URLs, 'same-origin' for relative paths. */
export function resolveFetchMode(apiBase: string): RequestMode {
  return /^https?:\/\//i.test(apiBase) ? 'cors' : 'same-origin';
}

/**
 * Sends a fire-and-forget POST. Prefers `navigator.sendBeacon` (survives page unload),
 * falls back to `fetch` with `keepalive: true`.
 */
export async function postBeacon(url: string, payload: object, apiBase: string, debug?: boolean): Promise<void> {
  const body = JSON.stringify(payload);
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const queued = navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    if (queued) return;
    if (debug) console.warn('[Rybbit] sendBeacon rejected (payload too large?), falling back to fetch');
  }
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      mode: resolveFetchMode(apiBase),
      keepalive: true,
    });
  } catch (err) {
    if (debug) console.error('[Rybbit] POST failed:', url, err);
  }
}

export interface RybbitConfig {
  /** Required — site identifier from the Rybbit dashboard */
  siteId: string | number;
  /** Required — base URL or relative path of your Rybbit API, e.g. 'https://app.rybbit.io/api' or '/api' */
  apiBase: string;
  /** localStorage key prefix. Default: 'rybbit' */
  namespace?: string;
  /** Log errors and warnings to console. Default: false */
  debug?: boolean;
  /** Track the initial page load. Default: true (overridden by remote config) */
  autoTrackPageview?: boolean;
  /** Track SPA navigations via Angular Router. Default: true */
  autoTrackSpa?: boolean;
  /** Include query params in pathname. Default: true */
  trackQuerystring?: boolean;
  /** Auto-track clicks on external links. Default: true */
  trackOutbound?: boolean;
  /** Auto-track BUTTON / role=button clicks. Default: false */
  trackButtonClicks?: boolean;
  /** Track copy events. Default: false */
  trackCopy?: boolean;
  /** Track form submit + input change events. Default: false */
  trackFormInteractions?: boolean;
  /** Track window.onerror + unhandledrejection. Default: false */
  trackErrors?: boolean;
  /** Collect CLS/LCP/INP/FCP/TTFB web vitals. Requires: npm install web-vitals. Default: false */
  enableWebVitals?: boolean;
  /** Record rrweb session replay. Requires: npm install rrweb. Default: false */
  enableSessionReplay?: boolean;
  /** Glob/regex patterns — matching paths are NOT tracked */
  skipPatterns?: string[];
  /** Glob/regex patterns — matching paths have their pathname replaced in payloads */
  maskPatterns?: string[];
  /** Debounce SPA navigation events in ms. Default: 0 (Router already debounces) */
  debounceDuration?: number;
  /** Percentage of sessions to record (0–100). Default: 100 */
  sessionReplaySampleRate?: number;
}

export interface RybbitTrackPayload {
  site_id: string;
  type: RybbitEventType;
  hostname: string;
  pathname: string;
  querystring: string;
  screenWidth: number;
  screenHeight: number;
  language: string;
  page_title: string;
  referrer: string;
  user_id?: string;
  event_name?: string;
  /** JSON.stringify()'d properties object */
  properties?: string;
}

export type RybbitEventType =
  | 'pageview'
  | 'custom_event'
  | 'outbound'
  | 'button_click'
  | 'copy'
  | 'form_submit'
  | 'input_change'
  | 'error'
  | 'performance';

export interface RybbitIdentifyPayload {
  site_id: string;
  user_id: string;
  traits?: Record<string, unknown>;
  is_new_identify: boolean;
}
