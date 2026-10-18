import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const testFiles = readdirSync(testDir)
  .filter((file) => file.endsWith('.test.ts'))
  .sort();

for (const file of testFiles) {
  // A file URL, not a path: Node's ESM loader rejects bare `C:\...` paths on Windows.
  await import(pathToFileURL(join(testDir, file)).href);
}
