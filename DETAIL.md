# Moonix

Search Moonix recordings, read summaries and transcripts, and view your tasks in DeepSeek conversations. Access is read-only.

Version 0.1.0-alpha.2 defaults to access-token authentication for embedded DSH 0.2.2-rc.5. Copy an access token from the Moonix App and let the client store it as the user-level credential MOONIX_TOKEN. Do not save it to a project or echo it. Missing credentials may show waiting-credentials.

Verify actual authentication, MCP initialization, tool discovery and a minimal read-only account query before claiming success. This mode is not OAuth.

Newer hosts with native MCP accounts can explicitly select dsh-moonix/oauth and authorize from Plugins → Moonix. The user completes login and consent.

This alpha still requires real DeepSeek connection verification.
