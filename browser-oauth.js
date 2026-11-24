import { createServer } from 'node:http'
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto'
import { spawn } from 'node:child_process'

const ORIGIN = 'https://api.moonix.cn'
const RESOURCE = `${ORIGIN}/mcp`
const KEY = 'moonix/oauth'
const REF = 'MOONIX_TOKEN'
const nonce = () => randomBytes(32).toString('base64url')

export class BrowserOAuth {
  constructor(ctx, { request = fetch, open = openBrowser, lifetimeMs = 600000 } = {}) {
    this.ctx = ctx; this.request = request; this.open = open; this.lifetimeMs = lifetimeMs
    this.state = 'disconnected'; this.disposed = false
  }
  async json(url, options = {}) {
    const response = await this.request(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) })
    if (!response.ok) throw new Error(`Moonix OAuth request failed (${response.status})`)
    return response.json()
  }
  async discover() {
    const resource = await this.json(`${ORIGIN}/.well-known/oauth-protected-resource/mcp`)
    const metadata = await this.json(`${ORIGIN}/.well-known/oauth-authorization-server`)
    if (resource.resource !== RESOURCE || resource.authorization_servers?.length !== 1 || resource.authorization_servers[0] !== ORIGIN
      || metadata.issuer !== ORIGIN || metadata.authorization_endpoint !== `${ORIGIN}/oauth/authorize`
      || metadata.token_endpoint !== `${ORIGIN}/oauth/token` || metadata.registration_endpoint !== `${ORIGIN}/oauth/register`
      || !metadata.code_challenge_methods_supported?.includes('S256')
      || (metadata.scopes_supported && !metadata.scopes_supported.includes('mcp'))) {
      throw new Error('Moonix OAuth discovery differs from the expected domain, resource, scope or PKCE configuration; authorization stopped')
    }
  }
  async initialize() {
    const record = await this.ctx.credentials.readRecord(KEY)
    if (record?.kind === 'grant' && record.payload?.issuer === ORIGIN && record.payload?.resource === RESOURCE) {
      this.grant = record.payload
      try { await this.activate(); return this.status() } catch { this.state = 'authorization-required' }
    }
    return this.start()
  }
  async start() {
    if (this.disposed) throw new Error('Moonix plugin is disposed')
    if (this.starting) return this.starting
    if (this.attempt) return this.status()
    this.starting = this.begin().catch(() => {
      this.failureReason = this.state === 'discovering' ? 'OAuth metadata discovery or validation failed; authorization stopped.' : 'OAuth callback setup or client registration failed; retry the connection.'
      this.stopAttempt(); this.state = 'authorization-failed'
      return this.status()
    }).finally(() => { this.starting = undefined })
    return this.starting
  }
  async begin() {
    this.state = 'discovering'
    await this.discover()
    if (this.disposed) throw new Error('Disposed')
    const state = nonce(), verifier = nonce()
    const attempt = { state, verifier, processing: false }
    const server = createServer((req, res) => { void this.callback(attempt, req, res).catch(() => { if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); res.end('Authorization callback failed. Return to DeepSeek and retry.') }) })
    attempt.server = server; this.attempt = attempt
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
    attempt.redirect = `http://127.0.0.1:${server.address().port}/moonix/oauth/callback`
    this.state = 'registering'
    const client = await this.json(`${ORIGIN}/oauth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: 'moonix for DeepSeek Harness', redirect_uris: [attempt.redirect],
        grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none', scope: 'mcp' }),
    })
    if (client.redirect_uris && !client.redirect_uris.includes(attempt.redirect)) throw new Error('OAuth registration redirect binding mismatch')
    if (typeof client.client_id !== 'string' || !client.client_id || client.token_endpoint_auth_method && client.token_endpoint_auth_method !== 'none') throw new Error('Unsupported Moonix OAuth client registration')
    if (this.disposed || this.attempt !== attempt) throw new Error('Disposed')
    attempt.clientId = client.client_id
    const url = new URL(`${ORIGIN}/oauth/authorize`)
    url.search = new URLSearchParams({ response_type: 'code', client_id: client.client_id, redirect_uri: attempt.redirect,
      scope: 'mcp', resource: RESOURCE, state, code_challenge_method: 'S256',
      code_challenge: createHash('sha256').update(verifier).digest('base64url') }).toString()
    attempt.url = url.href
    attempt.timer = setTimeout(() => { if (this.attempt === attempt) { this.stopAttempt(); this.state = 'authorization-expired' } }, this.lifetimeMs)
    attempt.timer.unref?.()
    if (this.disposed) throw new Error('Disposed')
    this.state = 'waiting-browser'
    try { this.browserOpened = await this.open(attempt.url) } catch { this.browserOpened = false }
    return this.status()
  }
  async callback(attempt, req, res) {
    const answer = (status, text) => { res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'" }); res.end(text) }
    const url = new URL(req.url, 'http://127.0.0.1')
    if (url.pathname !== '/moonix/oauth/callback' || req.method !== 'GET') return answer(404, 'Not found')
    const expected = new URL(attempt.redirect).host
    const supplied = url.searchParams.get('state') || ''
    if (req.headers.host !== expected || this.attempt !== attempt || attempt.processing
      || Buffer.byteLength(supplied) !== Buffer.byteLength(attempt.state)
      || !timingSafeEqual(Buffer.from(supplied), Buffer.from(attempt.state))) return answer(400, 'Invalid authorization state. Return to DeepSeek and retry.')
    if (url.searchParams.has('error')) { answer(400, 'Authorization was not completed. Return to DeepSeek to retry.'); this.stopAttempt(); this.state = 'authorization-cancelled'; return }
    const code = url.searchParams.get('code')
    if (!code) return answer(400, 'Missing authorization code')
    attempt.processing = true; this.state = 'exchanging'
    try {
      const tokens = await this.exchange({ grant_type: 'authorization_code', code, client_id: attempt.clientId,
        redirect_uri: attempt.redirect, code_verifier: attempt.verifier, resource: RESOURCE })
      if (this.disposed || this.attempt !== attempt) throw new Error('Authorization expired')
      await this.save(tokens, attempt.clientId)
      answer(200, 'moonix 授权已保存。请返回 DeepSeek 验证连接并查看可用功能。 Authorization saved; return to DeepSeek to verify the connection.')
      this.stopAttempt()
    } catch { answer(400, 'Moonix authorization could not be completed. Return to DeepSeek and retry.'); this.stopAttempt(); this.state = 'authorization-failed' }
  }
  async exchange(parameters) {
    const tokens = await this.json(`${ORIGIN}/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(parameters).toString() })
    if (typeof tokens.access_token !== 'string' || !tokens.access_token || tokens.token_type?.toLowerCase() !== 'bearer'
      || (tokens.expires_in !== undefined && (!Number.isFinite(tokens.expires_in) || tokens.expires_in <= 60))
      || (tokens.scope && !tokens.scope.split(/\s+/).includes('mcp'))) throw new Error('Moonix returned an invalid grant')
    return tokens
  }
  async save(tokens, clientId, previous) {
    const grant = { issuer: ORIGIN, resource: RESOURCE, clientId, accessToken: tokens.access_token,
      scope: 'mcp',
      ...((tokens.refresh_token || previous?.refreshToken) ? { refreshToken: tokens.refresh_token || previous.refreshToken } : {}),
      ...(typeof tokens.expires_in === 'number' ? { expiresAt: Date.now() + tokens.expires_in * 1000 } : {}) }
    if (this.disposed) throw new Error('Disposed')
    await this.ctx.credentials.modifyRecord(KEY, async () => { if (this.disposed) throw new Error('Disposed'); return { kind: 'grant', payload: grant } })
    this.grant = grant
    await this.activate()
  }
  async activate() {
    if (this.grant.expiresAt && this.grant.expiresAt <= Date.now() + 30000) {
      if (!this.grant.refreshToken) throw new Error('Authorization expired')
      if (!this.refreshing) this.refreshing = this.exchange({ grant_type: 'refresh_token', refresh_token: this.grant.refreshToken,
        client_id: this.grant.clientId, resource: RESOURCE }).then(t => this.save(t, this.grant.clientId, this.grant)).finally(() => { this.refreshing = undefined })
      return this.refreshing
    }
    if (this.disposed) throw new Error('Disposed')
    this.activatedAt = Date.now()
    await this.ctx.credentials.set(REF, this.grant.accessToken)
    if (typeof this.ctx.mcpManager.restart === 'function') await this.ctx.mcpManager.restart('moonix')
    this.state = 'authorized-unverified'
    clearTimeout(this.refreshTimer)
    if (this.grant.expiresAt) {
      this.refreshTimer = setTimeout(() => { void this.activate().catch(() => { this.state = 'authorization-required' }) }, Math.max(1000, Math.min(2147483647, this.grant.expiresAt - Date.now() - 30000)))
      this.refreshTimer.unref?.()
    }
  }
  status() {
    const status = this.ctx.mcpManager.list().find(s => s.name === 'moonix')?.status
    const verified = this.grant && this.state === 'authorized-unverified' && status?.state === 'connected' && status.toolCount > 0 && status.connectedAt >= this.activatedAt
    return { state: verified ? 'connected' : this.state, authentication: 'OAuth', verified: !!verified,
      ...(this.failureReason && this.state === 'authorization-failed' ? { failureReason: this.failureReason } : {}),
      ...(this.attempt?.url ? { authorizationUrl: this.attempt.url, browserOpened: !!this.browserOpened,
        instruction: '请在 api.moonix.cn 完成登录和授权；若未自动打开，请打开此链接。不要发送验证码或回调地址。' } : {}),
      ...(verified ? { capabilities: 'moonix 已连接。可以检索录音记录、阅读摘要和逐字原文、查看个人待办；只读访问。', toolCount: status.toolCount } : {}) }
  }
  stopAttempt() { const a = this.attempt; this.attempt = undefined; if (a) { clearTimeout(a.timer); a.server?.close(); a.server?.closeIdleConnections?.(); a.verifier = ''; a.state = '' } }
  dispose() { this.disposed = true; this.stopAttempt(); clearTimeout(this.refreshTimer) }
}

export function openBrowser(url) {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'rundll32' : 'xdg-open'
  const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url]
  return new Promise(resolve => { const child = spawn(command, args, { stdio: 'ignore', shell: false }); child.once('error', () => resolve(false)); child.once('exit', code => resolve(code === 0)) })
}
