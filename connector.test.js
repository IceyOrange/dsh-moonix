import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { apply as defaultApply, inject as defaultInject } from './index.js'
import { apply as tokenApply } from './token.js'
import { apply as oauthApply } from './oauth.js'

const contract = JSON.parse(readFileSync(new URL('./compatibility.json', import.meta.url), 'utf8'))
const allowed = new Set(contract.registrationFields)

function harness({ legacy = true, conflict = false } = {}) {
  const entries = new Map([['unrelated', { url: 'https://example.invalid/mcp' }]])
  const accounts = []
  const disposers = []
  const prompts = []
  const ctx = {
    mcpManager: {
      register(name, entry) {
        if (conflict || entries.has(name)) throw new Error('Server name already registered')
        if (legacy) for (const field of Object.keys(entry)) {
          assert.ok(allowed.has(field), `DSH ${contract.runtime} has no registration field: ${field}`)
        }
        entries.set(name, entry)
      },
    },
    systemPrompt: { section: p => prompts.push(p), getSectionOrder: () => 100 },
    inject(services, callback) {
      if (legacy) throw new Error('The legacy entry must not request the newer account service')
      callback({
        mcpAccounts: ctx.mcpAccounts,
        effect: fn => disposers.push(fn()),
      })
    },
  }
  if (!legacy) ctx.mcpAccounts = { register: account => {
    accounts.push(account)
    return () => accounts.splice(accounts.indexOf(account), 1)
  } }
  return { ctx, entries, accounts, prompts, disposers }
}

test('default entry fits the fields extracted from the pinned DSH 0.2.2-rc.5 schema', () => {
  const h = harness()
  defaultApply(h.ctx)
  const entry = h.entries.get('moonix')
  assert.equal(entry.url, 'https://api.moonix.cn/mcp')
  assert.equal(entry.transport, 'streamable-http')
  assert.equal(entry.headers.Authorization, 'Bearer ${credential:MOONIX_TOKEN}')
  assert.equal(entry.oauth, undefined)
  assert.equal(entry.toolLoading, undefined)
  assert.ok(!defaultInject.includes('mcpAccounts'))
  assert.equal(h.accounts.length, 0)
  assert.equal(h.entries.get('unrelated').url, 'https://example.invalid/mcp')
})

test('default entry never touches new account APIs, even when they exist', () => {
  const h = harness({ legacy: false })
  h.ctx.inject = () => { throw new Error('Unexpected account registration') }
  defaultApply(h.ctx)
  assert.equal(h.accounts.length, 0)
  assert.match(h.prompts[0].text, /access-token authentication, not OAuth/)
  assert.match(h.prompts[0].text, /user-level store/)
})

test('explicit token alias keeps the same compatibility configuration', () => {
  const a = harness()
  const b = harness()
  defaultApply(a.ctx)
  tokenApply(b.ctx)
  assert.deepEqual(a.entries.get('moonix'), b.entries.get('moonix'))
})

test('OAuth opt-in rejects an unsupported host before registering anything', () => {
  const h = harness()
  assert.throws(() => oauthApply(h.ctx), /requires a DSH runtime with native MCP accounts/)
  assert.equal(h.entries.size, 1)
  assert.equal(h.prompts.length, 0)
})

test('OAuth opt-in on a newer host preserves account UI and keeps tokens out of config', () => {
  const h = harness({ legacy: false })
  oauthApply(h.ctx)
  const entry = h.entries.get('moonix')
  assert.deepEqual(entry.oauth, { credentialKey: 'mcp-client/moonix', scope: 'mcp' })
  assert.equal(entry.headers, undefined)
  assert.equal(h.accounts[0].packageName, 'dsh-moonix')
  h.disposers[0]()
  assert.equal(h.accounts.length, 0)
})

test('conflict never overwrites an existing registration or adds a prompt', () => {
  const h = harness({ conflict: true })
  assert.throws(() => defaultApply(h.ctx), /already registered/)
  assert.equal(h.entries.size, 1)
  assert.equal(h.prompts.length, 0)
})

test('authentication modes cannot be loaded simultaneously under the same name', () => {
  const h = harness({ legacy: false })
  defaultApply(h.ctx)
  const entry = h.entries.get('moonix')
  assert.throws(() => oauthApply(h.ctx), /already registered/)
  assert.equal(h.entries.get('moonix'), entry)
  assert.equal(h.accounts.length, 0)
})
