// A completed request schedules the next one; hidden views never start a request.
export function startStoredPolling(read, {
  intervalMs = 10000, immediate = false, document: doc = globalThis.document,
  setTimeout: schedule = globalThis.setTimeout, clearTimeout: cancel = globalThis.clearTimeout,
  onError = () => {},
} = {}) {
  let stopped = false, running = false, timer = null, controller = null;
  const next = () => { if (!stopped) timer = schedule(run, intervalMs); };
  const run = async () => {
    if (stopped || running) return;
    if (timer !== null) { cancel(timer); timer = null; }
    if (doc?.hidden) { next(); return; }
    running = true;
    controller = new AbortController();
    try { await read(controller.signal); }
    catch (error) { if (!stopped && !controller.signal.aborted) onError(error); }
    finally { running = false; controller = null; next(); }
  };
  const visible = () => { if (!doc?.hidden) void run(); };
  doc?.addEventListener('visibilitychange', visible);
  if (immediate) void run(); else next();
  return () => {
    stopped = true;
    if (timer !== null) cancel(timer);
    controller?.abort();
    doc?.removeEventListener('visibilitychange', visible);
  };
}
