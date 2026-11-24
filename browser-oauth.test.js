import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { BrowserOAuth } from './browser-oauth.js'
const O = 'https://api.moonix.cn'
function setup({ badMetadata = false, badToken = false, stored } = {}) {
  const calls = [], saved = [], opened = []
  let record = stored, connectedAt = 0
  const ctx = { credentials: {
    readRecord: async () => record,
    modifyRecord: async (_k, fn) => { record = await fn(record); saved.push(record) },
    set: async (key, value) => { saved.push({ key, value }) },
  }, mcpManager: { restart: async () => { connectedAt = Date.now() + 1 }, list: () => [{ name: 'moonix', status: { state: 'connected', toolCount: 6, connectedAt } }] } }
  const request = async (url, options) => {
    calls.push({ url, options })
    let value
    if (url.includes('oauth-protected-resource')) value = { resource: O + '/mcp', authorization_servers: [O] }
    else if (url.includes('oauth-authorization-server')) value = { issuer: badMetadata ? 'https://wrong.invalid' : O,
      authorization_endpoint: O + '/oauth/authorize', token_endpoint: O + '/oauth/token', registration_endpoint: O + '/oauth/register', code_challenge_methods_supported: ['S256'], scopes_supported: ['mcp'] }
    else if (url.endsWith('/register')) value = { client_id: 'registered-test-client', token_endpoint_auth_method: 'none' }
    else value = { access_token: 'secret-access', refresh_token: 'secret-refresh', token_type: badToken ? 'unknown' : 'Bearer', expires_in: 3600, scope: 'mcp' }
    return { ok: true, json: async () => value }
  }
  const auth = new BrowserOAuth(ctx, { request, open: async url => { opened.push(url); return false } })
  return { auth, ctx, calls, saved, opened }
}
function response() { return { status: 0, text: '', writeHead(n) { this.status = n }, end(s) { this.text = s } } }
async function callback(auth, state) {
  const a = auth.attempt, res = response()
  await auth.callback(a, { method: 'GET', headers: { host: new URL(a.redirect).host }, url: `/moonix/oauth/callback?state=${encodeURIComponent(state)}&code=test-code` }, res)
  return res
}
test('PKCE, real authorization URL fallback, callback storage and tool discovery', async () => {
  const h = setup()
  try {
    const status = await h.auth.start(), url = new URL(status.authorizationUrl)
    assert.equal(status.browserOpened, false)
    assert.equal(url.origin, O)
    assert.equal(url.searchParams.get('scope'), 'mcp')
    assert.equal(url.searchParams.get('resource'), O + '/mcp')
    assert.equal(url.searchParams.get('code_challenge'), createHash('sha256').update(h.auth.attempt.verifier).digest('base64url'))
    assert.equal((await h.auth.start()).authorizationUrl, status.authorizationUrl)
    assert.equal(h.opened.length, 1)
    assert.equal(status.verified, false)
    const res = await callback(h.auth, h.auth.attempt.state)
    assert.equal(res.status, 200)
    assert.equal(h.auth.status().verified, true)
    assert.match(h.auth.status().capabilities, /只读/)
    assert.doesNotMatch(JSON.stringify(h.auth.status()) + res.text, /secret-access|secret-refresh|test-code/)
    assert.ok(h.saved.some(x => x.key === 'MOONIX_TOKEN' && x.value === 'secret-access'))
    assert.ok(h.calls.every(c => c.options.redirect === 'error'))
    const exchange = h.calls.find(c => c.url.endsWith('/token'))
    assert.equal(new URLSearchParams(exchange.options.body).get('grant_type'), 'authorization_code')
  } finally { h.auth.dispose() }
})
test('state mismatch cannot store a grant', async () => {
  const h = setup()
  try { await h.auth.start(); const res = await callback(h.auth, 'wrong'); assert.equal(res.status, 400); assert.equal(h.saved.length, 0); assert.equal(h.auth.status().verified, false) } finally { h.auth.dispose() }
})
test('unexpected discovery refuses registration and browser launch', async () => {
  const h = setup({ badMetadata: true })
  try { const s = await h.auth.start(); assert.equal(s.state, 'authorization-failed'); assert.equal(h.opened.length, 0); assert.ok(!h.calls.some(c => c.url.endsWith('/register'))) } finally { h.auth.dispose() }
})
test('invalid tokens never report successful OAuth', async () => {
  const h = setup({ badToken: true })
  try { await h.auth.start(); const res = await callback(h.auth, h.auth.attempt.state); assert.equal(res.status, 400); assert.equal(h.saved.length, 0); assert.equal(h.auth.status().verified, false) } finally { h.auth.dispose() }
})
test('saved OAuth grant resumes without launching a browser', async () => {
  const h = setup({ stored: { kind: 'grant', payload: { issuer: O, resource: O + '/mcp', accessToken: 'stored-secret', clientId: 'client', expiresAt: Date.now() + 3600000 } } })
  try { const status = await h.auth.initialize(); assert.equal(status.verified, true); assert.equal(h.opened.length, 0) } finally { h.auth.dispose() }
})
test('expired saved grant refreshes without another browser sign-in', async () => {
  const h = setup({ stored: { kind: 'grant', payload: { issuer: O, resource: O + '/mcp', accessToken: 'expired-secret', refreshToken: 'saved-refresh', clientId: 'client', expiresAt: Date.now() - 1 } } })
  try { await h.auth.initialize(); assert.equal(h.auth.status().verified, true); assert.equal(h.opened.length, 0); assert.equal(new URLSearchParams(h.calls.find(c => c.url.endsWith('/token')).options.body).get('grant_type'), 'refresh_token') } finally { h.auth.dispose() }
})
test('a stored grant alone cannot claim connection or tool discovery success', async () => {
  const h = setup({ stored: { kind: 'grant', payload: { issuer: O, resource: O + '/mcp', accessToken: 'stored-secret', expiresAt: Date.now() + 3600000 } } })
  h.ctx.mcpManager.list = () => [{ name: 'moonix', status: { state: 'connecting' } }]
  try { const status = await h.auth.initialize(); assert.equal(status.verified, false); assert.equal(status.capabilities, undefined) } finally { h.auth.dispose() }
})
test('old connected tools cannot verify a newly stored grant', async () => {
  const h = setup({ stored: { kind: 'grant', payload: { issuer: O, resource: O + '/mcp', accessToken: 'stored-secret', expiresAt: Date.now() + 3600000 } } })
  h.ctx.mcpManager.list = () => [{ name: 'moonix', status: { state: 'connected', toolCount: 6, connectedAt: 1 } }]
  try { assert.equal((await h.auth.initialize()).verified, false) } finally { h.auth.dispose() }
})
