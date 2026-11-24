import { registerMoonix } from './register.js'

export const name = 'moonix'
export const inject = ['mcpManager', 'systemPrompt', 'credentials']

/** DSH 0.2.2-rc.5 entry: use the host credential provider without newer OAuth APIs. */
export function apply(ctx) {
  registerMoonix(ctx, 'token')
}
