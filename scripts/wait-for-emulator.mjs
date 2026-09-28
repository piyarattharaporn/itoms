import net from 'node:net'

const host = process.argv[2] ?? '127.0.0.1'
const port = Number(process.argv[3] ?? 9099)
const timeoutMs = Number(process.env.EMULATOR_WAIT_TIMEOUT_MS ?? 120_000)
const deadline = Date.now() + timeoutMs

function isOpen() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port })
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => {
      socket.destroy()
      resolve(false)
    })
  })
}

while (Date.now() < deadline) {
  if (await isOpen()) {
    console.log(`Emulator is ready at ${host}:${port}`)
    process.exit(0)
  }
  await new Promise((resolve) => setTimeout(resolve, 250))
}

console.error(`Timed out waiting for emulator at ${host}:${port}`)
process.exit(1)
