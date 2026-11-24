import { registerMoonix } from './register.js'

export const name = 'moonix-token'
export const inject = ['mcpManager', 'systemPrompt', 'credentials']

/** Explicit fallback: resolve the user's token through the host credential provider. */
export function apply(ctx) {
  registerMoonix(ctx, 'token')
}
