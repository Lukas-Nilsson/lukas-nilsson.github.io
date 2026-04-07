"use client";

// ---------------------------------------------------------------------------
// Client-side structured logger for CLEANED v2
//
// Captures UI state changes, network requests, polling events, and errors.
// Logs are buffered in memory and periodically shipped to the backend
// activity log via POST /debug/client-logs.
//
// Every log entry carries a trace_id that also flows through HTTP headers
// so frontend events can be correlated with backend events.
// ---------------------------------------------------------------------------

export interface ClientLogEntry {
  ts: string;
  level: "info" | "warn" | "error";
  category: "ui" | "network" | "poll" | "upload" | "report" | "auth" | "state";
  action: string;
  detail?: Record<string, unknown>;
  trace_id?: string;
  error?: string;
}

// Active trace context (set per-operation, flows through headers)
let _activeTraceId: string | null = null;

const _buffer: ClientLogEntry[] = [];
const _MAX_BUFFER = 200;
const _FLUSH_INTERVAL_MS = 5_000;
let _flushTimer: ReturnType<typeof setInterval> | null = null;
let _subscribers: Array<(entries: ClientLogEntry[]) => void> = [];

// In-memory ring of recent entries for the debug panel
const _recentEntries: ClientLogEntry[] = [];
const _MAX_RECENT = 500;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function log(
  level: ClientLogEntry["level"],
  category: ClientLogEntry["category"],
  action: string,
  detail?: Record<string, unknown>,
  error?: string,
): void {
  const entry: ClientLogEntry = {
    ts: new Date().toISOString(),
    level,
    category,
    action,
    detail,
    trace_id: _activeTraceId ?? undefined,
    error,
  };

  // Ring buffer for debug panel
  _recentEntries.push(entry);
  if (_recentEntries.length > _MAX_RECENT) _recentEntries.shift();

  // Ship buffer
  _buffer.push(entry);
  if (_buffer.length > _MAX_BUFFER) _buffer.shift();

  // Notify subscribers (debug panel live view)
  for (const sub of _subscribers) {
    try { sub([..._recentEntries]); } catch { /* ignore */ }
  }

  // Also log to console in dev
  if (process.env.NODE_ENV === "development") {
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    fn(`[${category}] ${action}`, detail ?? "", error ?? "");
  }
}

export const logInfo = (cat: ClientLogEntry["category"], action: string, detail?: Record<string, unknown>) =>
  log("info", cat, action, detail);

export const logWarn = (cat: ClientLogEntry["category"], action: string, detail?: Record<string, unknown>, error?: string) =>
  log("warn", cat, action, detail, error);

export const logError = (cat: ClientLogEntry["category"], action: string, detail?: Record<string, unknown>, error?: string) =>
  log("error", cat, action, detail, error);

// ---------------------------------------------------------------------------
// Trace ID management
// ---------------------------------------------------------------------------

export function startTrace(label?: string): string {
  _activeTraceId = crypto.randomUUID();
  logInfo("state", "trace_started", { trace_id: _activeTraceId, label });
  return _activeTraceId;
}

export function endTrace(): void {
  if (_activeTraceId) {
    logInfo("state", "trace_ended", { trace_id: _activeTraceId });
  }
  _activeTraceId = null;
}

export function getTraceId(): string | null {
  return _activeTraceId;
}

export function setTraceId(id: string | null): void {
  _activeTraceId = id;
}

// ---------------------------------------------------------------------------
// Recent entries (for debug panel)
// ---------------------------------------------------------------------------

export function getRecentEntries(): ClientLogEntry[] {
  return [..._recentEntries];
}

export function subscribe(cb: (entries: ClientLogEntry[]) => void): () => void {
  _subscribers.push(cb);
  return () => {
    _subscribers = _subscribers.filter((s) => s !== cb);
  };
}

export function clearEntries(): void {
  _recentEntries.length = 0;
  _buffer.length = 0;
  for (const sub of _subscribers) {
    try { sub([]); } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Flush to backend
// ---------------------------------------------------------------------------

const API_PREFIX = "/demo-v2/cleaned/api";

async function flush(): Promise<void> {
  if (_buffer.length === 0) return;
  const batch = _buffer.splice(0, _buffer.length);
  try {
    await fetch(`${API_PREFIX}/v2/debug/client-logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: batch }),
    });
  } catch {
    // Put back on failure (but don't exceed max)
    _buffer.unshift(...batch.slice(0, _MAX_BUFFER - _buffer.length));
  }
}

export function startFlushing(): void {
  if (_flushTimer) return;
  _flushTimer = setInterval(() => void flush(), _FLUSH_INTERVAL_MS);
}

export function stopFlushing(): void {
  if (_flushTimer) {
    clearInterval(_flushTimer);
    _flushTimer = null;
  }
}

// Auto-flush on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => void flush());
  startFlushing();
}
