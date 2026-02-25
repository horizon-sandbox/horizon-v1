import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PROXY_PORT = 3000;
const AEM_PORT = 3001;
const IES_HOST = 'iam-stage.pearson.com';

const sslConfig = {
  key: fs.readFileSync(path.join(__dirname, 'certificates/test.pearson.com.key')),
  cert: fs.readFileSync(path.join(__dirname, 'certificates/test.pearson.com.crt')),
};

function proxyRequest(clientReq, clientRes, targetHost, targetPort, useTLS = false) {
  const mod = useTLS ? https : http;
  const options = {
    hostname: targetHost,
    port: targetPort,
    path: clientReq.url,
    method: clientReq.method,
    headers: { ...clientReq.headers, host: targetHost },
    rejectAuthorized: false,
  };

  const proxy = mod.request(options, (proxyRes) => {
    clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(clientRes, { end: true });
  });

  proxy.on('error', (err) => {
    console.error(`Proxy error → ${targetHost}:${targetPort}${clientReq.url}`, err.message);
    if (!clientRes.headersSent) {
      clientRes.writeHead(502, { 'Content-Type': 'text/plain' });
    }
    clientRes.end('Bad Gateway');
  });

  clientReq.pipe(proxy, { end: true });
}

// Minimal callback page served directly by the proxy so the URL is exactly
// /auth/callback regardless of AEM's routing conventions.
const CALLBACK_HTML = `<!doctype html>
<html><head>
<meta http-equiv="Content-Security-Policy"
  content="script-src 'nonce-aem' 'strict-dynamic' 'unsafe-inline' http: https:; base-uri 'self'; object-src 'none';"
  move-to-http-header="true">
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<script nonce="aem" src="/scripts/aem.js" type="module"></script>
<script nonce="aem" src="/scripts/scripts.js" type="module"></script>
<link rel="stylesheet" href="/styles/styles.css"/>
<title>Signing in\u2026</title>
</head><body><header></header><main>
<div><p>Completing sign-in, please wait\u2026</p></div>
</main><footer></footer></body></html>`;

const server = https.createServer(sslConfig, (req, res) => {
  // Serve OAuth callback page directly
  const callbackPath = req.url.split('?')[0];
  if (callbackPath === '/auth/callback'
    || callbackPath === '/content/global-store-horizon/sites/en-us/auth/callback') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(CALLBACK_HTML);
    return;
  }

  // Proxy IES API calls to ForgeRock (avoids CORS)
  // /ies-proxy/auth/oauth2/... → /auth/oauth2/... on iam-stage.pearson.com
  if (req.url.startsWith('/ies-proxy/')) {
    req.url = req.url.replace('/ies-proxy', '');
    proxyRequest(req, res, IES_HOST, 443, true);
    return;
  }

  // Everything else → AEM dev server
  proxyRequest(req, res, 'localhost', AEM_PORT, false);
});

server.listen(PROXY_PORT, () => {
  console.log(`\n  HTTPS proxy running at https://test.pearson.com:${PROXY_PORT}/`);
  console.log(`  → AEM dev server at http://localhost:${AEM_PORT}`);
  console.log(`  → IES API proxy at /ies-proxy/ → https://${IES_HOST}/\n`);
  console.log('  NOTE: Start AEM dev server on port 3001:');
  console.log('    aem up --port 3001\n');
});
