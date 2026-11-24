# Development

Version 0.1.0-alpha.4 defaults to browser OAuth, including on DSH 0.2.2-rc.5. No manual App token is required by default. The plugin uses a local loopback callback, dynamically registered public client, PKCE S256 and state validation. It accepts only the Moonix issuer, expected resource, mcp scope and documented HTTPS OAuth endpoints. Tokens stay in the host credential store; the legacy MCP client consumes the stored access-token reference. Reauthorization and status tools return a real expiring authorization URL; token data and callback codes are never returned to the model.

The default entry uses stable MCP manager, tools, systemPrompt and credentials interfaces. The /token entry remains an explicit manual fallback; /oauth remains the newer native-account entry. These entries must not run simultaneously.

Icon: supplied by the publisher at the specified icon.png path. It was proportionally resized to 506×512 and encoded as lossless WebP after resizing to stay below the 256 KiB metadata limit. The design was not redrawn.

Run npm test and npm pack. Browser OAuth tests mock Moonix HTTP metadata, registration and token responses; these do not prove live service acceptance. Verify a real login, callback, initialization and tool discovery before claiming end-to-end success.
