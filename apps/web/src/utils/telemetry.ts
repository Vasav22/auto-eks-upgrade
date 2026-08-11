/** Client-side performance telemetry for EKS Upgrade UI */

interface TelemetryEvent {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp: number;
}

const queue: TelemetryEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL_MS = 10_000;
const MAX_QUEUE_SIZE = 100;

function enqueue(event: TelemetryEvent) {
  queue.push(event);
  if (queue.length >= MAX_QUEUE_SIZE) {
    void flush();
    return;
  }
  if (!flushTimer) {
    flushTimer = setTimeout(() => { void flush(); }, FLUSH_INTERVAL_MS);
  }
}

async function flush() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (queue.length === 0) return;
  const batch = queue.splice(0, queue.length);
  try {
    await fetch('/api/telemetry/client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });
  } catch {
    // best-effort: swallow errors so telemetry never breaks the UI
  }
}

/** Record a navigation timing (route change latency). */
export function recordNavigation(routeName: string, durationMs: number) {
  enqueue({
    name: 'ui_navigation_duration_ms',
    value: durationMs,
    labels: { route: routeName },
    timestamp: Date.now(),
  });
}

/** Record an API call round-trip from the browser. */
export function recordApiCall(endpoint: string, method: string, statusCode: number, durationMs: number) {
  enqueue({
    name: 'ui_api_call_duration_ms',
    value: durationMs,
    labels: { endpoint, method, status_code: String(statusCode) },
    timestamp: Date.now(),
  });
}

/** Record a Web Vitals metric. */
export function recordWebVital(name: 'LCP' | 'FID' | 'CLS' | 'TTFB' | 'FCP', value: number) {
  enqueue({
    name: `ui_web_vital_${name.toLowerCase()}`,
    value,
    labels: { metric: name },
    timestamp: Date.now(),
  });
}

/** Record a user action duration (e.g. time to complete an upgrade form). */
export function recordUserAction(action: string, durationMs: number) {
  enqueue({
    name: 'ui_user_action_duration_ms',
    value: durationMs,
    labels: { action },
    timestamp: Date.now(),
  });
}

/** Instrument fetch() to automatically record API timings. */
export function instrumentFetch() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? 'GET';
    const start = performance.now();
    try {
      const response = await originalFetch(input, init);
      const duration = performance.now() - start;
      if (url.startsWith('/api')) {
        recordApiCall(url.replace(/\/[0-9a-f-]{36}/g, '/:id'), method, response.status, duration);
      }
      return response;
    } catch (err) {
      const duration = performance.now() - start;
      if (url.startsWith('/api')) {
        recordApiCall(url.replace(/\/[0-9a-f-]{36}/g, '/:id'), method, 0, duration);
      }
      throw err;
    }
  };
}

/** Collect Web Vitals using the browser PerformanceObserver API. */
export function collectWebVitals() {
  try {
    // LCP
    new PerformanceObserver(list => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
      if (last) recordWebVital('LCP', last.startTime);
    }).observe({ type: 'largest-contentful-paint', buffered: true });

    // CLS
    let clsValue = 0;
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        const e = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
        if (!e.hadRecentInput) clsValue += e.value ?? 0;
      }
      recordWebVital('CLS', clsValue);
    }).observe({ type: 'layout-shift', buffered: true });

    // TTFB
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        const nav = entry as PerformanceNavigationTiming;
        if (nav.responseStart) {
          recordWebVital('TTFB', nav.responseStart - nav.requestStart);
        }
      }
    }).observe({ type: 'navigation', buffered: true });
  } catch {
    // PerformanceObserver not available
  }
}

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush();
  });
  window.addEventListener('beforeunload', () => void flush());
}
