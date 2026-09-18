/**
 * The Dashboard signs in through the shared back end, behind its limit on wrong PINs — and
 * only falls back to the database when the back end cannot be reached at all.
 *
 *   · a right PIN signs in with the back end's answer and never touches the database route
 *   · a wrong PIN, and "too many tries", NEVER fall back — that would be a second door with no limit
 *   · the back end down still lets people in until the database closes the published key; after
 *     that it says "could not check", never "invalid PIN"
 *
 * Drives the REAL src/lib/auth.js, bundled with its database client swapped for a recorder.
 * Run: node --test scripts/test-sign-in-through-backend.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { build } from 'esbuild'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(mkdtempSync(path.join(tmpdir(), 'dash-auth-')), 'auth.mjs')
await build({
  entryPoints: [path.join(repoRoot, 'src/lib/auth.js')],
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent',
  plugins: [{
    name: 'stub-supabase',
    setup(b) {
      b.onResolve({ filter: /^\.\/supabase$/ }, () => ({ path: 'stub', namespace: 'stub' }))
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
        contents: 'export const supabase = { rpc: (...a) => globalThis.__rpc(...a) }',
        loader: 'js',
      }))
    },
  }],
})

const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}
let rpcCalls = []
const directRpc = async (name, args) => {
  rpcCalls.push({ name, args })
  if (name === 'check_app_access') return { data: true, error: null }
  return args.pin_input === '1234' ? { data: { id: 'u-1', name: 'Gary', role: 'admin' }, error: null } : { data: null, error: null }
}
globalThis.__rpc = directRpc
let sent = []
const answer = (status, body) => async (url, opts) => {
  sent.push({ url: String(url), body: opts?.body ? JSON.parse(opts.body) : null })
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}
const TOKEN = 'a'.repeat(43)
const USER = { id: 'u-1', name: 'Gary', email: 'g@x', role: 'admin', assigned_projects: [], default_project_id: null, allowed_apps: [] }
const fresh = () => { store.clear(); rpcCalls = []; sent = []; globalThis.__rpc = directRpc }

const auth = await import(pathToFileURL(out).href)

test('a right PIN signs in with the back end\'s answer, and never asks the database', async () => {
  fresh()
  globalThis.fetch = answer(200, { token: TOKEN, user: USER })
  assert.deepEqual(await auth.login('1234'), USER)
  assert.equal(sent[0].url, 'https://walden-backend.vercel.app/api/staff-session')
  assert.deepEqual(sent[0].body, { action: 'sign-in', pin: '1234', app_id: 'dashboard' })
  assert.equal(rpcCalls.length, 0)
  assert.equal(auth.getSession().id, 'u-1')
})


test('⛔ a wrong PIN is a wrong PIN — it never falls back to the database route', async () => {
  fresh()
  globalThis.fetch = answer(401, { error: 'Not recognised' })
  assert.equal(await auth.login('1234'), null)
  assert.equal(rpcCalls.length, 0)
})

test('⛔ too many tries says so, and never falls back to the database route', async () => {
  fresh()
  globalThis.fetch = answer(429, { code: 'too_many_tries', error: 'Too many wrong PINs have been tried recently.' })
  await assert.rejects(auth.login('1234'), /Too many/)
  assert.equal(rpcCalls.length, 0)
})

test('the back end down: the old way still signs people in; once the database is closed, "could not check"', async () => {
  for (const f of [async () => { throw new TypeError('Failed to fetch') }, answer(503, {}), answer(500, {})]) {
    fresh()
    globalThis.fetch = f
    assert.equal((await auth.login('1234'))?.id, 'u-1')
    assert.deepEqual(rpcCalls.map((c) => c.name), ['authenticate_cm'])
  }
  fresh()
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch') }
  globalThis.__rpc = async () => ({ data: null, error: { message: 'permission denied for function authenticate_cm' } })
  await assert.rejects(auth.login('1234'), /could not be checked/)
})

test('⛔ a right PIN for somebody who is not an admin or coordinator is told so, and never falls back', async () => {
  fresh()
  globalThis.fetch = answer(403, { code: 'no_access', error: 'no access' })
  assert.deepEqual(await auth.login('1234'), { access_denied: true })
  assert.equal(rpcCalls.length, 0)
})

test('⛔ a 403 that is not the back end answering "no access" (a firewall, say) is "could not check" — never "no access", never a fall-back', async () => {
  fresh()
  globalThis.fetch = answer(403, { error: 'Forbidden' })
  await assert.rejects(auth.login('1234'), (e) => e.message !== 'ACCESS_DENIED' && e.code !== 'no_access')
  assert.equal(rpcCalls.length, 0)
})
