import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'

const targetUrl = process.env.LOAD_TEST_URL ?? 'http://127.0.0.1:4173/'
const totalRequests = Number(process.env.LOAD_TEST_REQUESTS ?? 100)
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY ?? 10)
const p95LimitMs = Number(process.env.LOAD_TEST_P95_MS ?? 1000)
const ownsServer = !process.env.LOAD_TEST_URL
let preview

async function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok || response.status < 500) return
    } catch {
      // The preview server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for ${url}`)
}

async function main() {
  if (ownsServer) {
    preview = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173'], { stdio: 'ignore' })
    await waitForServer(targetUrl)
  }

  const durations = []
  const failures = []
  let nextRequest = 0
  async function worker() {
    while (true) {
      const requestNumber = nextRequest++
      if (requestNumber >= totalRequests) return
      const startedAt = performance.now()
      try {
        const response = await fetch(`${targetUrl}?load-test=${requestNumber}`, { signal: AbortSignal.timeout(10_000) })
        durations.push(performance.now() - startedAt)
        if (!response.ok) failures.push(`${requestNumber}:${response.status}`)
      } catch (error) {
        failures.push(`${requestNumber}:${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker))
  durations.sort((left, right) => left - right)
  const p95 = durations[Math.min(durations.length - 1, Math.ceil(durations.length * 0.95) - 1)] ?? Infinity
  const average =
    durations.length === 0 ? Infinity : durations.reduce((sum, duration) => sum + duration, 0) / durations.length

  assert.equal(failures.length, 0, `Load test had failed requests: ${failures.slice(0, 5).join(', ')}`)
  assert.ok(p95 <= p95LimitMs, `p95 ${p95.toFixed(1)}ms exceeded ${p95LimitMs}ms`)
  console.log(
    `Load test passed: ${totalRequests} requests, concurrency ${concurrency}, average ${average.toFixed(1)}ms, p95 ${p95.toFixed(1)}ms.`,
  )
}

try {
  await main()
} finally {
  if (preview) preview.kill('SIGTERM')
}
