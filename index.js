import { registerMoonix } from './register.js'
import { BrowserOAuth } from './browser-oauth.js'

export const name = 'moonix'
export const inject = ['mcpManager', 'systemPrompt', 'credentials', 'tools']

export async function apply(ctx) {
  registerMoonix(ctx, 'browser')
  const auth = new BrowserOAuth(ctx)
  ctx.effect(() => () => auth.dispose(), 'moonix browser OAuth lifetime')
  const tool = (name, description, execute) => ({
    name, description,
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    output: { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    execute,
  })
  ctx.tools.register(tool('moonix_connect', 'Start Moonix browser OAuth. Opens the real authorization page and returns a fallback authorization link. The user completes login and consent.', () => auth.start()))
  ctx.tools.register(tool('moonix_connection_status', 'Check Moonix OAuth and actual MCP tool-discovery status. Returns capabilities only after a live connection with discovered tools.', async () => auth.status()))
  await auth.initialize()
}
