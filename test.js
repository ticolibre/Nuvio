#!/usr/bin/env node
/**
 * Nuvio Latam+ — provider smoke test (runs on your PC, NOT inside Nuvio)
 *
 * Loads every enabled provider from manifest.json and calls its exported
 * getStreams(tmdbId, mediaType, season, episode), the same way Nuvio does.
 *
 * Fixtures (edit the TMDB ids below if you meant different titles):
 *   - Obsession        (movie, TMDB 1339713)
 *   - Naruto           (tv,    TMDB 46260, S01E01)
 *   - Aftersun         (movie, TMDB 965150)
 *   - Jujutsu Kaisen   (tv,    TMDB 95479, S01E01)
 *   - Hope             (movie, TMDB 1058424 — Korean film "호프", 2026)
 *   - Squid Game       (tv,    TMDB 93405, S01E01)
 *   - Parasite         (movie, TMDB 496243)
 *
 * Default mode is a cascade:
 *   1. Run every provider against the first fixture.
 *   2. Re-run ONLY the providers that failed (EMPTY/ERROR/TIMEOUT) against the
 *      next fixture, and so on.
 *   3. A provider stops being tested as soon as it returns at least one stream.
 *
 * Usage:
 *   node test.js                                  # cascade, all four titles
 *   node test.js --fixtures=jujutsu               # all providers, one title only
 *   node test.js --fixtures=jujutsu,naruto        # failures from JJK retried on Naruto
 *   node test.js --matrix                         # old mode: every provider × every title
 *   node test.js --only=areshd,embed69
 *   node test.js --timeout=45000 --concurrency=4
 *   node test.js --json
 *
 * Requires Node 18+ (uses the built-in fetch) and `npm install` for crypto-js.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const MANIFEST_PATH = path.join(ROOT, 'manifest.json');

// ---------------------------------------------------------------------------
// Fixtures — the cascade tries them in this order
// ---------------------------------------------------------------------------
const FIXTURES = [
  {
    key: 'obsession',
    label: 'Obsession',
    tmdbId: '1339713',
    type: 'movie',
    season: null,
    episode: null,
  },
  {
    key: 'naruto',
    label: 'Naruto',
    tmdbId: '46260',
    type: 'tv',
    season: 1,
    episode: 1,
  },
  {
    key: 'aftersun',
    label: 'Aftersun',
    tmdbId: '965150',
    type: 'movie',
    season: null,
    episode: null,
  },
  {
    key: 'jujutsu',
    label: 'Jujutsu Kaisen',
    tmdbId: '95479',
    type: 'tv',
    season: 1,
    episode: 1,
  },
  {
    key: 'hope',
    label: 'Hope',
    tmdbId: '1058424',
    type: 'movie', // Korean film "호프" (2026), not a series
    season: null,
    episode: null,
  },
  {
    key: 'squidgame',
    label: 'Squid Game',
    tmdbId: '93405',
    type: 'tv',
    season: 1,
    episode: 1,
  },
  {
    key: 'parasite',
    label: 'Parasite',
    tmdbId: '496243',
    type: 'movie',
    season: null,
    episode: null,
  },
];

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const opts = {
    timeout: 30000,
    concurrency: 6,
    only: null,
    skip: null,
    fixtures: null,
    json: false,
    verbose: false,
    strict: false,
    matrix: false,
    list: false,
    help: false,
  };

  for (const arg of argv) {
    if (arg === '--json') opts.json = true;
    else if (arg === '--matrix') opts.matrix = true;
    else if (arg === '--cascade') opts.matrix = false;
    else if (arg === '--verbose' || arg === '-v') opts.verbose = true;
    else if (arg === '--strict') opts.strict = true;
    else if (arg === '--list') opts.list = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg.startsWith('--timeout=')) opts.timeout = Math.max(1000, Number(arg.split('=')[1]) || opts.timeout);
    else if (arg.startsWith('--concurrency=')) opts.concurrency = Math.max(1, Number(arg.split('=')[1]) || opts.concurrency);
    else if (arg.startsWith('--only=')) opts.only = arg.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean);
    else if (arg.startsWith('--skip=')) opts.skip = arg.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean);
    else if (arg.startsWith('--fixtures=')) opts.fixtures = arg.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean);
    else {
      process.stderr.write(`Unknown argument: ${arg}\n`);
      opts.help = true;
    }
  }
  return opts;
}

function printHelp() {
  process.stdout.write(`
Nuvio Latam+ provider smoke test

  node test.js [options]

Modes:
  (default)           Cascade: all providers on fixture 1, then only the ones
                      that failed on fixture 2, and so on.
  --matrix            Every provider × every fixture (old behaviour).
  --cascade           Force cascade (default).

Options:
  --only=a,b          Only run these providers (id or name, case-insensitive)
  --skip=a,b          Skip these providers
  --fixtures=obsession,naruto,aftersun,jujutsu,hope,squidgame,parasite
                      Fixtures to use, in the order given
  --timeout=30000     Per-provider timeout in ms (default 30000)
  --concurrency=6     Providers running at once (default 6)
  --json              Machine-readable output
  --verbose, -v       Show provider console output (hidden by default)
  --strict            Exit 1 if any provider never passed
  --list              List providers and fixtures, run nothing
  --help, -h          This help

Statuses:
  OK n        provider returned n streams
  EMPTY       provider answered but returned 0 streams (counts as failed)
  TIMEOUT     no answer within --timeout (counts as failed)
  ERROR       provider threw (load error, network error, parser crash)
  --          skipped (fixture type not in the provider's supportedTypes)
`);
}

const opts = parseArgs(process.argv.slice(2));
if (opts.help) {
  printHelp();
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Output helpers (we silence provider console.* so their logs don't flood us)
// ---------------------------------------------------------------------------
const out = (line = '') => process.stdout.write(line + '\n');

// Don't crash when output is piped into `head`/`less`.
for (const stream of [process.stdout, process.stderr]) {
  stream.on('error', (error) => {
    if (error && error.code === 'EPIPE') process.exit(0);
  });
}

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const color = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const green = color('32');
const yellow = color('33');
const red = color('31');
const dim = color('2');
const bold = color('1');

function silenceConsole() {
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.debug = noop;
  console.warn = noop;
  console.error = noop;
}

// ---------------------------------------------------------------------------
// Fetch shim: give providers a browser-ish default UA, like a real device
// ---------------------------------------------------------------------------
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function installFetchShim() {
  const nativeFetch = globalThis.fetch;
  if (typeof nativeFetch !== 'function') {
    throw new Error('Node 18+ is required (global fetch not found)');
  }
  globalThis.fetch = function fetchWithDefaults(input, init) {
    const options = Object.assign({}, init);
    const headers = new Headers((init && init.headers) || undefined);
    if (!headers.has('user-agent')) headers.set('user-agent', BROWSER_UA);
    if (!headers.has('accept-language')) headers.set('accept-language', 'es-MX,es;q=0.9,en;q=0.8');
    options.headers = headers;
    return nativeFetch(input, options);
  };
}

// ---------------------------------------------------------------------------
// Manifest / providers
// ---------------------------------------------------------------------------
function loadProviders() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const scrapers = Array.isArray(manifest.scrapers) ? manifest.scrapers : [];
  return scrapers
    .filter((s) => s && s.enabled !== false && s.filename)
    .map((s) => ({
      id: s.id || path.basename(s.filename, '.js'),
      name: s.name || s.id || path.basename(s.filename, '.js'),
      filename: s.filename,
      supportedTypes: Array.isArray(s.supportedTypes) ? s.supportedTypes : ['movie', 'tv'],
    }));
}

function matches(list, provider) {
  if (!list) return false;
  const haystack = `${provider.id} ${provider.name}`.toLowerCase();
  return list.some((needle) => haystack.includes(needle.toLowerCase()));
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------
const TIMEOUT = Symbol('timeout');

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(TIMEOUT), ms);
  });
  return Promise.race([
    promise.then(
      (value) => ({ kind: 'value', value }),
      (error) => ({ kind: 'error', error }),
    ),
    timeout.then(() => ({ kind: 'timeout' })),
  ]).finally(() => clearTimeout(timer));
}

function seconds(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function clip(text, max = 140) {
  const s = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

const moduleCache = new Map();

function loadModule(provider) {
  if (moduleCache.has(provider.filename)) return moduleCache.get(provider.filename);
  const fullPath = path.resolve(ROOT, provider.filename);
  let mod;
  try {
    mod = require(fullPath);
  } catch (error) {
    mod = { __loadError: error };
  }
  moduleCache.set(provider.filename, mod);
  return mod;
}

async function checkOne(provider, fixture) {
  const started = Date.now();

  if (!provider.supportedTypes.includes(fixture.type)) {
    return { provider, fixture, status: 'SKIP', count: 0, ms: 0 };
  }

  const mod = loadModule(provider);
  if (!mod || typeof mod.getStreams !== 'function') {
    const reason = mod && mod.__loadError ? mod.__loadError.message : 'no getStreams export';
    return { provider, fixture, status: 'ERROR', count: 0, ms: Date.now() - started, error: `load: ${clip(reason)}` };
  }

  let call;
  try {
    call = Promise.resolve(
      mod.getStreams(fixture.tmdbId, fixture.type, fixture.season, fixture.episode),
    );
  } catch (error) {
    return { provider, fixture, status: 'ERROR', count: 0, ms: Date.now() - started, error: clip(error && error.message) };
  }

  const raced = await withTimeout(call, opts.timeout);
  const elapsed = Date.now() - started;

  if (raced.kind === 'timeout') {
    return { provider, fixture, status: 'TIMEOUT', count: 0, ms: elapsed, error: `no answer in ${seconds(opts.timeout)}` };
  }
  if (raced.kind === 'error') {
    const err = raced.error;
    const name = err && err.name && err.name !== 'Error' ? `${err.name}: ` : '';
    return { provider, fixture, status: 'ERROR', count: 0, ms: elapsed, error: clip(name + (err && err.message ? err.message : String(err))) };
  }

  const streams = raced.value;
  if (!Array.isArray(streams)) {
    return { provider, fixture, status: 'ERROR', count: 0, ms: elapsed, error: `returned ${typeof streams}, expected an array` };
  }

  const valid = streams.filter((s) => s && (s.url || s.infoHash));
  return {
    provider,
    fixture,
    status: valid.length > 0 ? 'OK' : 'EMPTY',
    count: valid.length,
    ms: elapsed,
    streams: valid.slice(0, 5).map((s) => ({
      name: s.name || null,
      title: s.title || null,
      quality: s.quality || null,
    })),
    rawCount: streams.length,
  };
}

async function runPool(tasks, limit, worker) {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= tasks.length) return;
      await worker(tasks[index], index);
    }
  });
  await Promise.all(runners);
}

// ---------------------------------------------------------------------------
// Batch runner
// ---------------------------------------------------------------------------
async function runBatch(pairs, phaseLabel) {
  const results = new Array(pairs.length);
  const progress = { OK: 0, EMPTY: 0, TIMEOUT: 0, ERROR: 0, SKIP: 0 };
  const showProgress = !opts.json && !opts.verbose && process.stderr.isTTY;
  let done = 0;

  await runPool(pairs, opts.concurrency, async ({ provider, fixture }, index) => {
    let result;
    try {
      result = await checkOne(provider, fixture);
    } catch (error) {
      result = {
        provider,
        fixture,
        status: 'ERROR',
        count: 0,
        ms: 0,
        error: clip(error && error.message ? error.message : String(error)),
      };
    }
    results[index] = result;
    done++;
    progress[result.status]++;
    if (!opts.json && opts.verbose) {
      out(`[${phaseLabel} ${done}/${pairs.length}] ${provider.name} · ${fixture.label} → ${result.status} ${result.count || ''}`);
    } else if (showProgress) {
      const line =
        `  checking… ${done}/${pairs.length} ` +
        `(OK ${progress.OK}, EMPTY ${progress.EMPTY}, TIMEOUT ${progress.TIMEOUT}, ERROR ${progress.ERROR})`;
      process.stderr.write('\r' + line + '\x1b[K');
    }
  });
  if (showProgress) process.stderr.write('\r\x1b[K');

  return results;
}

function fixtureMeta(fixture) {
  return {
    key: fixture.key,
    label: fixture.label,
    tmdbId: fixture.tmdbId,
    type: fixture.type,
    season: fixture.season,
    episode: fixture.episode,
  };
}

function resultMeta(result) {
  return {
    provider: result.provider.id,
    providerName: result.provider.name,
    fixture: result.fixture.key,
    status: result.status,
    count: result.count,
    ms: result.ms,
    error: result.error || null,
    streams: result.streams || null,
  };
}

function tally(results) {
  const counts = { OK: 0, EMPTY: 0, TIMEOUT: 0, ERROR: 0, SKIP: 0 };
  for (const r of results) counts[r.status]++;
  return counts;
}

function countsLine(counts) {
  return (
    `${green(`OK ${counts.OK}`)} · ${yellow(`EMPTY ${counts.EMPTY}`)} · ` +
    `${red(`TIMEOUT ${counts.TIMEOUT}`)} · ${red(`ERROR ${counts.ERROR}`)} · ${dim(`SKIP ${counts.SKIP}`)}`
  );
}

// ---------------------------------------------------------------------------
// Cascade: fixture 1 for everyone, then only the failures move on
// ---------------------------------------------------------------------------
async function runCascade(providers, fixtures) {
  const attempts = [];
  const outcomes = new Map();
  const phases = [];
  let pending = providers.slice();
  let phaseNumber = 0;

  for (const fixture of fixtures) {
    if (pending.length === 0) break;

    const testable = pending.filter((p) => p.supportedTypes.includes(fixture.type));
    const unsupported = pending.filter((p) => !p.supportedTypes.includes(fixture.type));
    if (testable.length === 0) {
      pending = unsupported;
      continue;
    }

    phaseNumber++;
    const pairs = testable.map((provider) => ({ provider, fixture }));
    if (!opts.json) {
      const ep = fixture.type === 'tv' ? ` S${fixture.season}E${fixture.episode}` : '';
      out(
        bold(`Phase ${phaseNumber} — ${fixture.label} (${fixture.type} ${fixture.tmdbId}${ep})`) +
          dim(`  ${pairs.length} provider${pairs.length === 1 ? '' : 's'}`),
      );
    }

    const results = await runBatch(pairs, `P${phaseNumber}`);
    attempts.push(...results);
    const counts = tally(results);
    phases.push({ fixture: fixture.key, providers: pairs.length, counts });
    if (!opts.json) out(`  ${countsLine(counts)}`);

    const failed = [];
    for (const result of results) {
      if (result.status === 'OK') {
        outcomes.set(result.provider.id, { status: 'PASS', fixture, result });
      } else {
        failed.push(result.provider);
      }
    }
    // Providers that don't support this type stay in the pool for later phases.
    pending = failed.concat(unsupported);
  }

  for (const provider of pending) {
    const last = [...attempts].reverse().find((a) => a.provider.id === provider.id);
    outcomes.set(
      provider.id,
      last ? { status: 'FAIL', fixture: last.fixture, result: last } : { status: 'SKIP', fixture: null, result: null },
    );
  }

  return { attempts, outcomes, phases };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const providers = loadProviders().filter((p) => {
    if (opts.only && !matches(opts.only, p)) return false;
    if (opts.skip && matches(opts.skip, p)) return false;
    return true;
  });

  let fixtures = FIXTURES;
  if (opts.fixtures) {
    const byKey = new Map(FIXTURES.map((f) => [f.key, f]));
    fixtures = opts.fixtures
      .map((key) => byKey.get(key.toLowerCase()))
      .filter(Boolean);
  }

  if (opts.list) {
    out(bold('Providers:'));
    for (const p of providers) out(`  ${p.name}  ${dim(`(${p.id})`)}`);
    out(bold('Fixtures (cascade order):'));
    for (const f of FIXTURES) {
      const ep = f.type === 'tv' ? ` S${f.season}E${f.episode}` : '';
      out(`  ${f.key}  ${f.label} — ${f.type} ${f.tmdbId}${ep}`);
    }
    return 0;
  }

  if (providers.length === 0) {
    process.stderr.write('No providers matched.\n');
    return 1;
  }
  if (fixtures.length === 0) {
    process.stderr.write('No fixtures matched. Valid keys: ' + FIXTURES.map((f) => f.key).join(', ') + '\n');
    return 1;
  }

  installFetchShim();
  if (!opts.verbose || opts.json) silenceConsole();

  if (!opts.json) {
    out(bold(`Nuvio Latam+ provider test — ${opts.matrix ? 'matrix' : 'cascade'}`));
    out(`Fixtures: ${fixtures
      .map((f) => `${f.label} (${f.type} ${f.tmdbId}${f.type === 'tv' ? ` S${f.season}E${f.episode}` : ''})`)
      .join(' · ')}`);
    out(
      `${providers.length} providers · timeout ${opts.timeout / 1000}s · concurrency ${opts.concurrency}` +
        (opts.matrix ? ` · ${providers.length * fixtures.length} checks` : ''),
    );
    try {
      require.resolve('crypto-js');
    } catch {
      out(yellow('Warning: crypto-js is not installed; AresHD, MonosChinos and SoloLatino will fail to load.'));
      out(yellow('         Run: npm install crypto-js'));
    }
    out('');
  }

  if (opts.matrix) {
    return runMatrix(providers, fixtures);
  }
  return runCascadeMode(providers, fixtures);
}

async function runMatrix(providers, fixtures) {
  const pairs = [];
  for (const provider of providers) {
    for (const fixture of fixtures) pairs.push({ provider, fixture });
  }

  const results = await runBatch(pairs, 'M');
  const counts = tally(results);

  if (opts.json) {
    process.stdout.write(
      JSON.stringify(
        {
          mode: 'matrix',
          fixtures: fixtures.map(fixtureMeta),
          timeoutMs: opts.timeout,
          concurrency: opts.concurrency,
          results: results.map(resultMeta),
        },
        null,
        2,
      ) + '\n',
    );
  } else {
    printMatrixTable(results, providers, fixtures);
    out('');
    out(countsLine(counts));
  }

  if (opts.strict) return counts.ERROR + counts.TIMEOUT > 0 ? 1 : 0;
  return counts.OK + counts.EMPTY > 0 ? 0 : 1;
}

async function runCascadeMode(providers, fixtures) {
  const { attempts, outcomes, phases } = await runCascade(providers, fixtures);

  if (opts.json) {
    process.stdout.write(
      JSON.stringify(
        {
          mode: 'cascade',
          fixtures: fixtures.map(fixtureMeta),
          timeoutMs: opts.timeout,
          concurrency: opts.concurrency,
          phases,
          results: attempts.map(resultMeta),
          outcomes: providers.map((p) => {
            const outcome = outcomes.get(p.id);
            return {
              provider: p.id,
              providerName: p.name,
              result: outcome ? outcome.status : 'SKIP',
              passedWith: outcome && outcome.fixture ? outcome.fixture.key : null,
              lastStatus: outcome && outcome.result ? outcome.result.status : null,
            };
          }),
        },
        null,
        2,
      ) + '\n',
    );
  } else {
    const counts = { PASS: 0, FAIL: 0, SKIP: 0 };
    for (const provider of providers) counts[outcomes.get(provider.id).status]++;

    printCascadeTable(attempts, outcomes, providers, fixtures);

    out('');
    out(`${green(`PASS ${counts.PASS}`)} · ${red(`FAIL ${counts.FAIL}`)} · ${dim(`SKIP ${counts.SKIP}`)}`);

    const failed = providers.filter((p) => outcomes.get(p.id).status === 'FAIL');
    if (failed.length > 0) {
      out('');
      out(bold('Never passed:'));
      for (const provider of failed) {
        const tries = attempts.filter((a) => a.provider.id === provider.id).length;
        out(`  ${provider.name}: 0 streams in ${tries} title${tries === 1 ? '' : 's'}`);
      }
    }
  }

  if (opts.strict) return providers.some((p) => outcomes.get(p.id).status === 'FAIL') ? 1 : 0;
  return providers.some((p) => outcomes.get(p.id).status === 'PASS') ? 0 : 1;
}

function statusCell(result) {
  if (!result) return '…';
  const time = result.status === 'SKIP' ? '' : ` · ${seconds(result.ms)}`;
  switch (result.status) {
    case 'OK':
      return `OK ${result.count}${time}`;
    case 'EMPTY':
      return `EMPTY${time}`;
    case 'TIMEOUT':
      return `TIMEOUT${time}`;
    case 'ERROR':
      return `ERROR${time}`;
    default:
      return '—';
  }
}

function pad(text, width) {
  const s = String(text);
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

function printMatrixTable(results, providers, fixtures) {
  const byKey = new Map();
  for (const r of results) byKey.set(`${r.provider.id}::${r.fixture.key}`, r);

  const nameWidth = Math.min(24, Math.max(10, ...providers.map((p) => p.name.length))) + 2;
  const colWidth = 18;

  out(bold(pad('Provider', nameWidth) + fixtures.map((f) => pad(f.label, colWidth)).join('')));
  out(dim(pad('', nameWidth) + fixtures.map((f) => pad(f.type, colWidth)).join('')));

  for (const provider of providers) {
    let line = pad(provider.name, nameWidth);
    for (const fixture of fixtures) {
      const result = byKey.get(`${provider.id}::${fixture.key}`);
      const cell = pad(statusCell(result), colWidth);
      if (!result) line += cell;
      else if (result.status === 'OK') line += green(cell);
      else if (result.status === 'EMPTY') line += yellow(cell);
      else if (result.status === 'SKIP') line += dim(cell);
      else line += red(cell);
    }
    out(line);
  }

  const notes = results.filter((r) => r.status === 'ERROR' || r.status === 'TIMEOUT');
  if (notes.length > 0) {
    out('');
    out(bold('Details'));
    for (const r of notes) {
      out(`  ${r.provider.name} · ${r.fixture.label}: ${dim(r.error || r.status)}`);
    }
  }
}

function printCascadeTable(attempts, outcomes, providers, fixtures) {
  const byKey = new Map();
  for (const r of attempts) byKey.set(`${r.provider.id}::${r.fixture.key}`, r);

  const nameWidth = Math.min(24, Math.max(10, ...providers.map((p) => p.name.length))) + 2;
  const colWidth = 18;
  const resultWidth = 24;

  out(
    bold(
      pad('Provider', nameWidth) +
        fixtures.map((f) => pad(f.label, colWidth)).join('') +
        pad('Result', resultWidth),
    ),
  );
  out(
    dim(
      pad('', nameWidth) +
        fixtures.map((f) => pad(f.type, colWidth)).join('') +
        pad('', resultWidth),
    ),
  );

  for (const provider of providers) {
    let line = pad(provider.name, nameWidth);
    for (const fixture of fixtures) {
      const result = byKey.get(`${provider.id}::${fixture.key}`);
      if (!result) {
        line += dim(pad('·', colWidth));
      } else {
        const cell = pad(statusCell(result), colWidth);
        if (result.status === 'OK') line += green(cell);
        else if (result.status === 'EMPTY') line += yellow(cell);
        else line += red(cell);
      }
    }

    const outcome = outcomes.get(provider.id);
    const tries = attempts.filter((a) => a.provider.id === provider.id).length;
    const label =
      outcome.status === 'PASS'
        ? `PASS · ${outcome.fixture.label}`
        : outcome.status === 'FAIL'
          ? `FAIL · ${tries} tried`
          : 'SKIP';
    const cell = pad(label, resultWidth);
    line += outcome.status === 'PASS' ? green(cell) : outcome.status === 'FAIL' ? red(cell) : dim(cell);
    out(line);
  }

  const notes = attempts.filter((r) => r.status === 'ERROR' || r.status === 'TIMEOUT');
  if (notes.length > 0) {
    out('');
    out(bold('Details'));
    for (const r of notes) {
      out(`  ${r.provider.name} · ${r.fixture.label}: ${dim(r.error || r.status)}`);
    }
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    process.stderr.write(`Fatal: ${error && error.stack ? error.stack : error}\n`);
    process.exit(1);
  });
