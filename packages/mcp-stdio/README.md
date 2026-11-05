# freelancer-crm-mcp

stdio MCP server for [Freelancer CRM](https://github.com/Olinkkt/freelancer-crm). It forwards every request to a running CRM's `/api/mcp` endpoint, so tools and permissions match the HTTP server exactly.

```sh
CRM_URL=http://localhost:3000 CRM_TOKEN=fcrm_... node index.mjs
```

- `CRM_TOKEN` (required): API token from the CRM's Settings → API.
- `CRM_URL` (default `http://localhost:3000`): where the CRM runs.

Setup for Claude Desktop, Claude Code and Cursor: [docs/mcp.md](../../docs/mcp.md).
