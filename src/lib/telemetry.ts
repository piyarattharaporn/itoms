type UsageProperties = Record<string, string | number | boolean | undefined>

const enabled = import.meta.env.PROD && import.meta.env.VITE_ENABLE_USAGE_TELEMETRY === 'true'
const counters = new Map<string, number>()
const safePropertyNames = new Set(['count', 'pageSize', 'priority', 'status', 'assigned', 'durationMs', 'errorCode', 'feature'])

function safeProperties(properties: UsageProperties) {
  return Object.fromEntries(Object.entries(properties).filter(([key, value]) => safePropertyNames.has(key) && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')))
}

/**
 * Low-volume client instrumentation. It is disabled by default and never
 * stores ticket descriptions, email addresses, or other business content.
 * Firebase/Google Cloud console remains the source of truth for quota usage.
 */
export function recordUsageEvent(name: string, properties: UsageProperties = {}) {
  counters.set(name, (counters.get(name) ?? 0) + 1)
  const sanitized = safeProperties(properties)
  if (enabled) window.dispatchEvent(new CustomEvent('lotus-usage-event', { detail: { name, properties: sanitized, at: new Date().toISOString() } }))
  if (import.meta.env.DEV) console.debug(`[usage] ${name}`, sanitized)
}

export function recordUsageError(feature: string, errorCode: string) {
  recordUsageEvent('operation_failed', { feature, errorCode })
}

export async function measureUsage<T>(feature: string, operation: () => Promise<T>) {
  const startedAt = performance.now()
  try {
    const result = await operation()
    recordUsageEvent('operation_completed', { feature, durationMs: Math.round(performance.now() - startedAt) })
    return result
  } catch (cause) {
    recordUsageError(feature, cause instanceof Error ? cause.name : 'unknown_error')
    throw cause
  }
}

export function getUsageSnapshot() {
  return Object.fromEntries(counters.entries())
}
