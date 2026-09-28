import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import SwaggerParser from '@apidevtools/swagger-parser'

const root = resolve(new URL('..', import.meta.url).pathname)
const specPath = resolve(root, 'docs/api/openapi.yaml')
const serverPath = resolve(root, 'server/http.ts')
const document = await SwaggerParser.validate(specPath)
const serverSource = await readFile(serverPath, 'utf8')

assert.equal(document.openapi, '3.1.0')
assert.equal(document.info?.title, 'ITOMS Trusted Backend API')
assert.ok(document.paths?.['/health']?.get)
assert.ok(document.paths?.['/v1/tickets']?.post)
assert.ok(document.paths?.['/v1/tickets/{ticketId}/assign']?.post)
assert.ok(document.paths?.['/v1/tickets/{ticketId}/status']?.post)
assert.ok(document.paths?.['/v1/audit-events']?.get)

for (const [path, methods] of Object.entries(document.paths ?? {})) {
  for (const method of Object.keys(methods ?? {})) {
    if (!['get', 'post'].includes(method)) continue
    assert.ok(
      Object.keys(methods[method].responses ?? {}).length > 0,
      `${method.toUpperCase()} ${path} must document a response`,
    )
  }
}

const routeMarkers = [
  ['/health', "url.pathname === '/health'"],
  ['/v1/tickets', "url.pathname === '/v1/tickets'"],
  ['/v1/tickets/{ticketId}/assign', 'url.pathname.match(/^\\/v1\\/tickets\\/([^/]+)\\/assign$/)'],
  ['/v1/tickets/{ticketId}/status', 'url.pathname.match(/^\\/v1\\/tickets\\/([^/]+)\\/status$/)'],
  ['/v1/audit-events', "url.pathname === '/v1/audit-events'"],
]
for (const [path, marker] of routeMarkers)
  assert.ok(serverSource.includes(marker), `OpenAPI route ${path} is missing from server/http.ts`)

assert.ok(serverSource.includes("response.setHeader('X-Correlation-Id', correlationId)"))
console.log(
  `OpenAPI contract valid: ${Object.keys(document.paths ?? {}).length} documented paths match the trusted server route markers.`,
)
