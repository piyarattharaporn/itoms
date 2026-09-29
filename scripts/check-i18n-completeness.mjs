import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const sourceRoot = path.join(root, 'src')
const i18nPath = path.join(sourceRoot, 'lib', 'i18n.ts')
const i18nSource = fs.readFileSync(i18nPath, 'utf8')

function walk(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const current = path.join(directory, entry.name)
      return entry.isDirectory() ? walk(current) : [current]
    })
    .filter((file) => /\.(ts|tsx)$/.test(file))
}

function section(name, nextName) {
  const start = i18nSource.indexOf(`const ${name}`)
  const end = nextName
    ? i18nSource.indexOf(`const ${nextName}`, start)
    : i18nSource.indexOf('export function getLanguage', start)
  return i18nSource.slice(start, end)
}

function keysIn(source) {
  return new Set(
    [...source.matchAll(/'((?:\\'|[^'])*)'\s*:/g)]
      .map((match) => match[1])
      .concat(
        [...source.matchAll(/(?:^|,)\s*([$_\p{ID_Start}][$_\u200C\u200D\p{ID_Continue}]*)\s*:/gu)].map(
          (match) => match[1],
        ),
      ),
  )
}

const knownKeys = new Set([
  ...keysIn(section('catalog', 'english')),
  ...keysIn(section('english', 'englishFeature')),
  ...keysIn(section('englishFeature', 'thaiFeature')),
  ...keysIn(section('thaiFeature')),
])
const references = new Map()
const errorReferences = new Map()

for (const file of walk(sourceRoot)) {
  const source = fs.readFileSync(file, 'utf8')
  for (const [lineIndex, line] of source.split('\n').entries()) {
    for (const match of line.matchAll(/\bt\(\s*(['"])(.*?)\1\s*\)/g)) {
      const key = match[2]
      if (!knownKeys.has(key) && !references.has(key))
        references.set(key, `${path.relative(root, file)}:${lineIndex + 1}`)
    }
    for (const match of line.matchAll(
      /(?:throw new Error|setError|setOperationError|setCompletionError)\([^\n]*?(['"])([^'"`]*[ก-๙][^'"`]*)\1/g,
    )) {
      const key = match[2]
      if (!key.includes('${') && !knownKeys.has(key) && !errorReferences.has(key))
        errorReferences.set(key, `${path.relative(root, file)}:${lineIndex + 1}`)
    }
  }
}

if (references.size > 0 || errorReferences.size > 0) {
  console.error('Missing i18n mappings:')
  for (const [key, location] of [...references.entries()].sort()) console.error(`- ${key} (${location})`)
  for (const [key, location] of [...errorReferences.entries()].sort()) console.error(`- ${key} (${location}) [error]`)
  process.exitCode = 1
} else {
  console.log(`i18n literal and static error coverage passed (${knownKeys.size} catalog/legacy keys indexed).`)
}
