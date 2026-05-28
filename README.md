# ngx-rybbit

> ⚠️ **Unofficial** — This is an unofficial Angular client implementation for [rybbit.com](https://rybbit.io). It is not affiliated with or endorsed by Rybbit.

Angular 21 analytics library for [Rybbit](https://rybbit.io) — the privacy-friendly, open-source alternative to Google Analytics.

## Features

- 📄 **Auto pageview tracking** — initial load + SPA navigation via Angular Router
- 🔗 **Outbound link tracking** — clicks on external `<a>` tags
- 🖱️ **Button click tracking** — `<button>` and `role="button"` elements
- 📋 **Copy tracking** — text selection copy events
- 📝 **Form tracking** — submit and input change events
- 💥 **Error tracking** — `window.onerror` and `unhandledrejection`
- 📊 **Web Vitals** — CLS, LCP, INP, FCP, TTFB (requires `web-vitals`)
- 🎥 **Session replay** — rrweb-based recording (requires `rrweb`)
- 🎯 **Custom events** — imperative API and declarative `[rybbitEvent]` directive
- 👤 **User identification** — `identify()` with traits, persisted in `localStorage`
- 🔒 **Opt-out** — via `window.__RYBBIT_OPTOUT__` global or `localStorage` flag

## Using `sendBeacon`

All tracking requests are sent via [`navigator.sendBeacon`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon) by design. This has several advantages over regular `fetch` or `XMLHttpRequest`:

- **Survives page unload** — the browser guarantees delivery even when the user navigates away or closes the tab
- **Non-blocking** — requests are queued and sent asynchronously without delaying navigation
- **No response handling needed** — fire-and-forget, keeping analytics lightweight
- **Lower data loss** — traditional requests are often cancelled mid-flight on page unload; `sendBeacon` is not

If `sendBeacon` is unavailable or rejects the payload (e.g. oversized), the library automatically falls back to `fetch`.

## Installation

```bash
npm install ngx-rybbit
```

Optional peer dependencies:

```bash
npm install web-vitals   # for enableWebVitals
npm install rrweb        # for enableSessionReplay
```

## Setup

Add `provideRybbit()` to your `app.config.ts`:

```ts
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideRybbit } from 'ngx-rybbit';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideRybbit({
      siteId: 42,
      apiBase: 'https://app.rybbit.io/api',
    }),
  ],
};
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `siteId` | `string \| number` | **required** | Site ID from the Rybbit dashboard |
| `apiBase` | `string` | **required** | Base URL or relative path of your Rybbit API (e.g. `'https://app.rybbit.io/api'` or `'/api'`) |
| `namespace` | `string` | `'rybbit'` | `localStorage` key prefix |
| `debug` | `boolean` | `false` | Log errors/warnings to console |
| `autoTrackPageview` | `boolean` | `true` | Track initial page load |
| `autoTrackSpa` | `boolean` | `true` | Track SPA navigations via Angular Router |
| `trackQuerystring` | `boolean` | `true` | Include query params in tracked URL |
| `trackOutbound` | `boolean` | `true` | Track clicks on external links |
| `trackButtonClicks` | `boolean` | `false` | Track `<button>` / `role="button"` clicks |
| `trackCopy` | `boolean` | `false` | Track text copy events |
| `trackFormInteractions` | `boolean` | `false` | Track form submits and input changes |
| `trackErrors` | `boolean` | `false` | Track JS errors and unhandled rejections |
| `enableWebVitals` | `boolean` | `false` | Collect CLS/LCP/INP/FCP/TTFB |
| `enableSessionReplay` | `boolean` | `false` | Record rrweb session replays |
| `skipPatterns` | `string[]` | `[]` | Paths matching these patterns are not tracked |
| `maskPatterns` | `string[]` | `[]` | Paths matching these patterns have pathname replaced |
| `sessionReplaySampleRate` | `number` | `100` | Percentage of sessions to record (0–100) |

### Skip & mask patterns

Patterns support globs (`*`, `**`) or regexes (prefix with `re:`):

```ts
provideRybbit({
  siteId: 42,
  apiBase: 'https://app.rybbit.io/api',
  skipPatterns: ['/kitchen/drafts/**', '/admin/*'],
  maskPatterns: ['/recipes/*/edit', 're:/users/\\d+'],
})
```

## Custom events

### Imperative — `RybbitService`

```ts
import { RybbitService } from 'ngx-rybbit';

@Component({ ... })
export class RecipeDetailComponent {
  private rybbit = inject(RybbitService);

  onSaveRecipe(recipe: Recipe) {
    this.rybbit.trackEvent('recipe_saved', { cuisine: recipe.cuisine, duration: recipe.cookingTime });
  }
}
```

### Declarative — `[rybbitEvent]` directive

```html
<button rybbitEvent="recipe_shared" [rybbitProps]="{ medium: 'link', cuisine: 'italian' }">
  Share Recipe
</button>
```

Import the directive in your component:

```ts
import { RybbitEventDirective } from 'ngx-rybbit';

@Component({
  imports: [RybbitEventDirective],
  ...
})
```

## User identification

```ts
// Identify the current user
await this.rybbit.identify('usr-7fx92', { username: 'chefmaria', dietaryPreference: 'vegetarian' });

// Update traits only
await this.rybbit.setTraits({ dietaryPreference: 'vegan' });

// Clear on logout
this.rybbit.clearUserId();
```

## Opt-out

```ts
// Via global flag (set before Angular bootstraps)
window.__RYBBIT_OPTOUT__ = true;

// Via localStorage
localStorage.setItem('disable-rybbit', '1');
// or with custom namespace:
localStorage.setItem('myapp-disable', '1');
```

## Development

```bash
npm run build:lib   # build the library
npm run test        # run tests (Vitest)
npm run format      # format code (Prettier)
npm run link:lib    # build + link for local development
# then in your consumer project:
npm link ngx-rybbit
```

## License

[MIT](./LICENSE)
