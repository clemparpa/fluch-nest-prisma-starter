export function initSentry(): void {
  if (!process.env.SENTRY_DSN) return
  // Placeholder : quand on active, importer @sentry/node + @sentry/profiling-node
  // et appeler Sentry.init({ dsn, tracesSampleRate, profilesSampleRate, ... }).
  // biome-ignore lint/suspicious/noConsole: placeholder warning before Sentry is wired up
  console.warn('SENTRY_DSN defined but Sentry not wired up — see src/observability/sentry.ts')
}
