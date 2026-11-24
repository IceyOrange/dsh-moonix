import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apply as oauthApply } from './index.js'
import { apply as tokenApply } from './token.js'

function harness({ conflict = false, accounts = true } = {}) {
  const entries = new Map([['unrelated', { url: 'https://example.invalid/mcp' }]])
  const registrations = []
  const disposers = []
  const prompts = []
  const ctx = {
    mcpManager: {
      register(name, entry) {
        if (conflict || entries.has(name)) throw new Error('Server name already registered')
        entries.set(name, entry)
      },
    },
    systemPrompt: { section: p => prompts.push(p), getSectionOrder: () => 100 },
    inject(services, callback) {
      if (accounts) callback({
        mcpAccounts: { register: account => {
          registrations.push(account)
          return () => registrations.splice(registrations.indexOf(account), 1)
        } },
        effect: fn => disposers.push(fn()),
      })
    },
  }
  return { ctx, entries, registrations, prompts, disposers }
}

test('OAuth registers a native account without a token header or invented client identity', () => {
  const h = harness()
  oauthApply(h.ctx)
  const entry = h.entries.get('moonix')
  assert.equal(entry.url, 'https://api.moonix.cn/mcp')
  assert.equal(entry.transport, 'streamable-http')
  assert.deepEqual(entry.oauth, { credentialKey: 'mcp-client/moonix', scope: 'mcp' })
  assert.equal(entry.headers, undefined)
  assert.equal(h.registrations[0].packageName, 'dsh-moonix')
  assert.equal(h.registrations[0].server, 'moonix')
  assert.equal(typeof h.disposers[0], 'function')
  h.disposers[0]()
  assert.equal(h.registrations.length, 0)
})

test('token fallback leaves the secret as a host credential reference and registers no OAuth account', () => {
  const h = harness()
  tokenApply(h.ctx)
  const entry = h.entries.get('moonix')
  assert.equal(entry.headers.Authorization, 'Bearer ${credential:MOONIX_TOKEN}')
  assert.equal(entry.oauth, undefined)
  assert.equal(h.registrations.length, 0)
  assert.match(h.prompts[0].text, /access-token authentication, not OAuth/)
})

test('existing server conflict is surfaced before adding an account or prompt', () => {
  const h = harness({ conflict: true })
  assert.throws(() => oauthApply(h.ctx), /already registered/)
  assert.equal(h.entries.size, 1)
  assert.equal(h.prompts.length, 0)
  assert.equal(h.registrations.length, 0)
})

test('switching authentication requires removing the previous registration', () => {
  const h = harness()
  oauthApply(h.ctx)
  const entry = h.entries.get('moonix')
  assert.throws(() => tokenApply(h.ctx), /already registered/)
  assert.equal(h.entries.get('moonix'), entry)
  assert.equal(h.entries.get('unrelated').url, 'https://example.invalid/mcp')
})

test('missing account UI does not break server registration', () => {
  const h = harness({ accounts: false })
  oauthApply(h.ctx)
  assert.ok(h.entries.has('moonix'))
  assert.equal(h.registrations.length, 0)
})
