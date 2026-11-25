/**
 * Security step 2 (25 Nov 2026): the Dashboard's photo tagger saves a photo's tags through walden-backend's
 * /api/dashboard-photo-phases with this Dashboard's sign-in ticket, so the public key can later lose UPDATE on
 * site_photos. Drives the REAL updatePhotoAnalysis in src/lib/queries.js, bundled with its database client and
 * sign-in swapped for recorders.
 *
 *   · with a ticket: the back end saves it; the browser never writes the table
 *   · PHASE A: no ticket, or the back end's two "nothing touched" answers → the old save, as before
 *   · anything else (a refusal, a 404, "may have saved", a crash, a lost reply) THROWS and never saves the old way
 *   · the browser writes site_photos in ONE place only: the Phase A fallback
 *
 * Run: node --test scripts/test-photo-phases-door.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { build } from 'esbuild'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(mkdtempSync(path.join(tmpdir(), 'dash-phases-')), 'queries.mjs')
await build({
  entryPoints: [path.join(repoRoot, 'src/lib/queries.js')],
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent',
  plugins: [{
    name: 'stubs',
    setup(b) {
      b.onResolve({ filter: /^\.\/(supabase|auth)$/ }, (a) => ({ path: a.path, namespace: 'stub' }))
      b.onLoad({ filter: /supabase/, namespace: 'stub' }, () => ({
        contents: 'export const supabase = { from: (t) => globalThis.__from(t) }', loader: 'js',
      }))
      b.onLoad({ filter: /auth/, namespace: 'stub' }, () => ({
        contents: 'export const getActorTicket = () => globalThis.__ticket; export const getSession = () => ({ id: "u-1" })', loader: 'js',
      }))
    },
  }],
})

let direct = []
globalThis.__from = (table) => ({ update: (vals) => ({ eq: async (col, id) => { direct.push({ table, vals, col, id }); return { error: null } } }) })
let sent = []
const answer = (status, body) => { globalThis.fetch = async (url, opts) => { sent.push({ url: String(url), opts, body: JSON.parse(opts.body) }); return { ok: status >= 200 && status < 300, status, json: async () => body } } }
const fresh = (ticket = 'a'.repeat(43)) => { direct = []; sent = []; globalThis.__ticket = ticket }
const setNavigator = (value) => Object.defineProperty(globalThis, 'navigator', { value, configurable: true, writable: true })
const PHOTO = '22222222-2222-4222-8222-222222222222'
const q = await import(pathToFileURL(out).href)

test('Phase A ships with the PIN box OFF', () => assert.equal(q.PHOTO_PHASES_PIN_BOX_ON, false))

test('with a ticket: the back end saves the tags, with the ticket header, and the browser writes nothing', async () => {
  fresh(); answer(200, { ok: true, row: { id: PHOTO, construction_phases: ['Framing'] } })
  await q.updatePhotoAnalysis(PHOTO, { phases: ['Framing'] })
  assert.equal(sent.length, 1)
  assert.equal(sent[0].url, 'https://walden-backend.vercel.app/api/dashboard-photo-phases')
  assert.equal(sent[0].opts.headers['x-walden-actor'], 'a'.repeat(43))
  assert.deepEqual(sent[0].body, { id: PHOTO, construction_phases: ['Framing'], page_user_id: 'u-1' })
  assert.equal(direct.length, 0)
})

test('PHASE A: no ticket → the old save, and ONE no-ticket beacon so the back end can count it (never a write)', async () => {
  const beacons = []
  setNavigator({ sendBeacon: (url, data) => { beacons.push({ url, data: JSON.parse(data) }); return true } })
  fresh(null); answer(200, { ok: true })
  await q.updatePhotoAnalysis(PHOTO, { phases: ['Framing'] })
  assert.equal(sent.length, 0, 'no ticketed call')
  assert.deepEqual(beacons, [{ url: 'https://walden-backend.vercel.app/api/dashboard-photo-phases', data: { page_user_id: 'u-1' } }], 'no tags, no ticket in the count')
  assert.deepEqual(direct, [{ table: 'site_photos', vals: { construction_phases: ['Framing'] }, col: 'id', id: PHOTO }])
  // A beacon that throws, or no beacon at all, never stops the save.
  setNavigator({ sendBeacon: () => { throw new Error('blocked') } })
  fresh(null); await q.updatePhotoAnalysis(PHOTO, { phases: ['Framing'] }); assert.equal(direct.length, 1)
  setNavigator(undefined)
  fresh(null); await q.updatePhotoAnalysis(PHOTO, { phases: ['Framing'] }); assert.equal(direct.length, 1)
})

test('PHASE A: the back end\'s two "nothing touched" answers → the old save', async () => {
  for (const [s, code] of [[403, 'sign_in_needed'], [503, 'sign_in_unchecked']]) {
    fresh(); answer(s, { code, error: 'x' })
    await q.updatePhotoAnalysis(PHOTO, { phases: ['Framing'] })
    assert.equal(direct.length, 1, code)
  }
})

test('anything else THROWS and never saves the old way', async () => {
  for (const [s, body] of [[400, { error: 'bad' }], [404, { error: 'gone' }], [422, { error: 'no' }], [503, { code: 'maybe_saved', error: 'm' }],
    [500, {}], [401, {}], [403, { code: 'other' }], [500, { code: 'sign_in_unchecked' }], [403, { code: 'sign_in_unchecked' }], [200, { ok: false }]]) {
    fresh(); answer(s, body)
    await assert.rejects(q.updatePhotoAnalysis(PHOTO, { phases: ['Framing'] }), `${s} ${JSON.stringify(body)}`)
    assert.equal(direct.length, 0, `${s} ${JSON.stringify(body)}: never the old save`)
  }
  fresh(); globalThis.fetch = async () => { throw new TypeError('Failed to fetch') }
  await assert.rejects(q.updatePhotoAnalysis(PHOTO, { phases: ['Framing'] }), (e) => e.maybeSaved === true && /may or may not/.test(e.message))
  assert.equal(direct.length, 0, 'a lost reply: never the old save on top')
})

test('the browser writes site_photos in ONE place only: the Phase A fallback', () => {
  const walk = (dir) => readdirSync(path.join(repoRoot, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]))
  const src = readFileSync(path.join(repoRoot, 'src/lib/queries.js'), 'utf8')
  const fb = src.indexOf('async function directPhotoPhases(')
  let found = 0
  for (const f of walk('src').filter((f) => /\.(js|jsx)$/.test(f))) {
    const raw = readFileSync(path.join(repoRoot, f), 'utf8')
    let i = -1
    while ((i = raw.indexOf("from('site_photos')", i + 1)) !== -1) {
      if (!/^from\('site_photos'\)\s*\.(insert|update|upsert|delete)\s*\(/.test(raw.slice(i, i + 200).replace(/\r?\n\s*/g, ''))) continue
      assert.ok(f.split(path.sep).join('/') === 'src/lib/queries.js' && i > fb && i - fb < 200, `${f}: a browser write to site_photos outside the fallback`)
      found++
    }
  }
  assert.equal(found, 1)
})

test('both tagger screens count a photo as done only when the save did not throw', () => {
  const auto = readFileSync(path.join(repoRoot, 'src/hooks/useAutoCategorizer.jsx'), 'utf8')
  assert.match(auto, /await updatePhotoAnalysis\(photo\.id, analysis\)[\s\S]{0,200}const succeeded = results\.filter\(\(r\) => r\.status === 'fulfilled'\)\.length/)
  const page = readFileSync(path.join(repoRoot, 'src/pages/admin/PhotoTaggingPage.jsx'), 'utf8')
  assert.match(page, /await updatePhotoAnalysis\(photo\.id, analysis\)\s*return \{ id: photo\.id[\s\S]{0,300}if \(r\.status === 'fulfilled'\) \{\s*successes\.push\(r\.value\)/)
})
