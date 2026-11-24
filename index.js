import { registerMoonix } from './register.js'

export const name = 'moonix'
export const inject = ['mcpManager', 'systemPrompt', 'credentials']

/** Register the server and native Plugins-page OAuth account for this plugin's lifetime. */
export function apply(ctx) {
  registerMoonix(ctx, 'oauth')
}
