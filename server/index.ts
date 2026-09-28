import { loadConfig } from './config.js'
import { startServer } from './http.js'

const config = loadConfig()
const server = await startServer(config)
console.log(`ITOMS Phase 3 backend listening on http://127.0.0.1:${config.port} (${config.environment})`)

function shutdown(signal: string) {
  server.close(() => {
    console.log(`ITOMS backend stopped (${signal})`)
    process.exit(0)
  })
}

process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))
