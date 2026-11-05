export const dynamic = 'force-static'

const SCALAR_VERSION = '1.75.0'

/** Public API reference rendered by Scalar from /api/v1/openapi.json */
export async function GET() {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Freelancer CRM API</title>
  </head>
  <body>
    <script id="api-reference" data-url="/api/v1/openapi.json"></script>
    <script>
      document.getElementById('api-reference').dataset.configuration = JSON.stringify({
        theme: 'default',
        hideDownloadButton: false,
        defaultHttpClient: { targetKey: 'shell', clientKey: 'curl' },
        authentication: { preferredSecurityScheme: 'bearerAuth' },
      })
    </script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@${SCALAR_VERSION}"></script>
  </body>
</html>`
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}
