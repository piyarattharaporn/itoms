import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const sourceDir = path.join(projectRoot, 'rules-src');
const outputPath = path.join(projectRoot, 'firestore.rules');

const fragments = fs
  .readdirSync(sourceDir)
  .filter((name) => name.endsWith('.rules'))
  .sort();

if (fragments.length === 0) {
  throw new Error('No Firestore Rules fragments found in rules-src.');
}

const body = fragments
  .map((fragment) => {
    const fragmentPath = path.join(sourceDir, fragment);
    const content = fs.readFileSync(fragmentPath, 'utf8').replace(/\s+$/, '');
    if (!content) {
      throw new Error('Empty Firestore Rules fragment: ' + fragment);
    }
    return content;
  })
  .join('\n\n');

const output = [
  "rules_version = '2';",
  'service cloud.firestore {',
  '  match /databases/{database}/documents {',
  body,
  '  }',
  '}',
  ''
].join('\n');

fs.writeFileSync(outputPath, output);
console.log('Assembled firestore.rules from ' + fragments.length + ' fragments.');
