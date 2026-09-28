import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import type { ServerConfig } from './config.js'
import { authenticate, loadActor } from './auth.js'
import { createAdminServices, type AdminServices } from './firebase.js'
import { HttpError, isHttpError } from './errors.js'
import { assignTicket, changeTicketStatus, createTicket, listAuditEvents } from './repository.js'
import { SlidingWindowRateLimiter } from './rate-limit.js'

const maxBodyBytes = 32 * 1024

function send(response: ServerResponse, config: ServerConfig, status: number, payload: Record<string, unknown>) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Access-Control-Allow-Origin', config.allowedOrigin)
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.end(JSON.stringify(payload))
}

async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > maxBodyBytes) throw new HttpError(413, 'body_too_large', 'Request body is too large')
    chunks.push(buffer)
  }
  if (chunks.length === 0) return {}
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('object required')
    return parsed as Record<string, unknown>
  } catch { throw new HttpError(400, 'invalid_json', 'Request body must be a JSON object') }
}

async function route(request: IncomingMessage, config: ServerConfig, services: AdminServices, correlationId: string) {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
  if (request.method === 'OPTIONS') return { status: 204, payload: {} }
  if (request.method === 'GET' && url.pathname === '/health') return { status: 200, payload: { status: 'ok', backend: 'trusted-boundary', environment: config.environment, productionEnabled: false } }

  const actor = await loadActor(services.db, await authenticate(services.auth, request.headers.authorization))
  if (request.method === 'POST') {
    const input = await body(request)
    if (url.pathname === '/v1/tickets') return { status: 201, payload: await createTicket(services.db, actor, input, correlationId) }
    const assignMatch = url.pathname.match(/^\/v1\/tickets\/([^/]+)\/assign$/)
    if (assignMatch) return { status: 200, payload: await assignTicket(services.db, actor, assignMatch[1], input, correlationId) }
    const statusMatch = url.pathname.match(/^\/v1\/tickets\/([^/]+)\/status$/)
    if (statusMatch) return { status: 200, payload: await changeTicketStatus(services.db, actor, statusMatch[1], input, correlationId) }
  }
  if (request.method === 'GET' && url.pathname === '/v1/audit-events') return { status: 200, payload: await listAuditEvents(services.db, actor, url.searchParams) }
  throw new HttpError(404, 'not_found', 'Route was not found')
}

export function createHttpServer(config: ServerConfig, services = createAdminServices(config)): Server {
  const mutationLimiter = new SlidingWindowRateLimiter(120, 60_000)
  return createServer((request, response) => {
    const correlationId = randomUUID()
    void (async () => {
      if (request.method === 'POST') {
        const path = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`).pathname
        const clientKey = `${request.socket.remoteAddress ?? 'unknown'}:${path}`
        if (!mutationLimiter.allow(clientKey)) throw new HttpError(429, 'rate_limited', 'Too many mutation requests')
      }
      return route(request, config, services, correlationId)
    })().then((result) => {
      response.setHeader('X-Correlation-Id', correlationId)
      send(response, config, result.status, result.payload)
    }).catch((cause: unknown) => {
      const error = isHttpError(cause) ? cause : new HttpError(500, 'internal_error', 'Internal server error')
      response.setHeader('X-Correlation-Id', correlationId)
      if (error.status === 429) response.setHeader('Retry-After', '60')
      if (!isHttpError(cause)) console.error({ correlationId, error: cause })
      send(response, config, error.status, { error: error.code, message: error.message, correlationId })
    })
  })
}

export async function startServer(config: ServerConfig, services?: AdminServices) {
  const server = createHttpServer(config, services)
  server.requestTimeout = 15_000
  server.headersTimeout = 10_000
  server.keepAliveTimeout = 5_000
  await new Promise<void>((resolve) => server.listen(config.port, '127.0.0.1', resolve))
  return server
}
