import { registerMoonix } from './register.js'

export const name = 'moonix-oauth'
// This entry is opt-in and requires the native account service from newer DSH.
export const inject = ['mcpManager', 'systemPrompt', 'credentials', 'mcpAccounts']

export function apply(ctx) {
  if (typeof ctx.mcpAccounts?.register !== 'function') {
    throw new Error('Moonix OAuth requires a DSH runtime with native MCP accounts; use the default token entry on DSH 0.2.2-rc.5')
  }
  registerMoonix(ctx, 'oauth')
}
