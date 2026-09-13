// tests/runtimeDependencies.test.js
//
// Everything under api/ is deployed by Vercel as a serverless function, and Vercel ships
// only `dependencies` into the function bundle — never `devDependencies`.
//
// `pdf-parse` was a devDependency while api/ceb-bills/extract.js imported it at runtime.
// Locally it worked (devDeps are installed), so nothing caught it; in production every bill
// upload parsed to a MODULE_NOT_FOUND and returned 500. The bill pipeline was broken by a
// single line in the wrong half of package.json.
//
// This test makes that impossible to reintroduce.
//
// functions/ is deliberately NOT covered: those run in GitHub Actions via
// `pnpm install` with devDependencies present, so `dotenv` there is legitimate.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, relative } from 'path';
import { builtinModules } from 'module';

// Node builtins are available in the serverless runtime and are never package.json entries.
// They appear both prefixed (`node:crypto`) and bare (`crypto`) in this codebase.
const NODE_BUILTINS = new Set(builtinModules);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));

const prodDeps = new Set(Object.keys(pkg.dependencies || {}));
const devDeps = new Set(Object.keys(pkg.devDependencies || {}));

function jsFilesUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return jsFilesUnder(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

/** Bare module specifiers imported by a file — both `from 'x'` and side-effect `import 'x'`. */
function bareImports(source) {
  const specs = new Set();
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g, // import x from 'y'  /  export * from 'y'
    /\bimport\s+['"]([^'"]+)['"]/g, // import 'y'
    /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g, // require('y')
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g // await import('y')
  ];

  for (const re of patterns) {
    for (const match of source.matchAll(re)) {
      const spec = match[1];
      if (spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('node:')) continue;
      if (NODE_BUILTINS.has(spec)) continue;
      // Scope a package name correctly: @scope/name keeps two segments.
      specs.add(spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]);
    }
  }
  return specs;
}

describe('api/ runtime dependencies', () => {
  const files = jsFilesUnder(join(repoRoot, 'api'));

  it('finds the api/ source files', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it('never imports a devDependency — Vercel does not ship those', () => {
    const violations = [];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const spec of bareImports(source)) {
        if (devDeps.has(spec) && !prodDeps.has(spec)) {
          violations.push(`${relative(repoRoot, file).replace(/\\/g, '/')} imports devDependency "${spec}"`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('keeps pdf-parse in dependencies specifically', () => {
    // Called out by name because this is the one that actually broke production, and the
    // extractor is the most load-bearing thing in api/.
    expect(prodDeps.has('pdf-parse')).toBe(true);
    expect(devDeps.has('pdf-parse')).toBe(false);
  });

  it('declares every bare import used by api/ somewhere in package.json', () => {
    const undeclared = new Set();

    for (const file of files) {
      for (const spec of bareImports(readFileSync(file, 'utf8'))) {
        if (!prodDeps.has(spec) && !devDeps.has(spec)) undeclared.add(spec);
      }
    }

    expect([...undeclared]).toEqual([]);
  });
});
