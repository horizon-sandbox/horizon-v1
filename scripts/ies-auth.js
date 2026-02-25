/*
 * IES v2 Authentication Module
 * OAuth 2.0 Authorization Code flow with PKCE against ForgeRock IES.
 *
 * Local dev:  token exchange goes through /ies-proxy/ on the local HTTPS proxy.
 * Production: calls IES directly (requires CORS whitelisting on IES side).
 */

const IES_ORIGIN = 'https://iam-stage.pearson.com';
const IES_REALM = '/auth/oauth2/realms/root/realms/pearson';
const CLIENT_ID = 'PCASUS-Client';
const SCOPE = 'openid profile email pearsonUID';
const REALM_PATH = 'pearson';
const AUTH_TREE = 'Login';

const CALLBACK_PATH = '/auth/callback';
const STORAGE_KEY_VERIFIER = 'ies_pkce_verifier';
const STORAGE_KEY_STATE = 'ies_oauth_state';
const STORAGE_KEY_TOKENS = 'ies_tokens';
const STORAGE_KEY_USER = 'ies_user';

function isLocalDev() {
  const { hostname } = window.location;
  return hostname === 'test.pearson.com'
    || hostname === 'local.pearsonassessments.com'
    || hostname === 'localhost';
}

/**
 * When running locally the HTTPS proxy at /ies-proxy/ forwards to IES
 * (avoids CORS).  In production we call IES directly.
 */
function iesUrl(path) {
  if (isLocalDev()) return `/ies-proxy${path}`;
  return `${IES_ORIGIN}${path}`;
}

// ── PKCE helpers ───────────────────────────────────────────────────────────

function randomString(length) {
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, length);
}

async function sha256(plain) {
  const encoded = new TextEncoder().encode(plain);
  return crypto.subtle.digest('SHA-256', encoded);
}

function base64urlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generatePKCE() {
  const verifier = randomString(64);
  const challenge = base64urlEncode(await sha256(verifier));
  return { verifier, challenge };
}

// ── JWT parser ─────────────────────────────────────────────────────────────

function parseJwt(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getRedirectUri() {
  return `${window.location.origin}${CALLBACK_PATH}`;
}

function extractUser(tokens) {
  const idClaims = tokens.id_token ? parseJwt(tokens.id_token) : null;
  if (!idClaims) return null;
  return {
    email: idClaims.email || '',
    firstName: idClaims.given_name || '',
    lastName: idClaims.family_name || '',
    id: idClaims.pearsonUID || idClaims.sub || '',
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Kick off the OAuth login by redirecting to IES.
 */
export async function login() {
  const { verifier, challenge } = await generatePKCE();
  const state = randomString(32);

  sessionStorage.setItem(STORAGE_KEY_VERIFIER, verifier);
  sessionStorage.setItem(STORAGE_KEY_STATE, state);
  sessionStorage.setItem('ies_login_referrer', window.location.href);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: SCOPE,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    acr_values: `${REALM_PATH}/${AUTH_TREE}`,
  });

  window.location.href = `${iesUrl(`${IES_REALM}/authorize`)}?${params}`;
}

/**
 * Handle the OAuth callback — exchange auth code for tokens.
 * Returns the parsed user info on success or null on failure.
 */
export async function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');

  if (!code || !state) return null;

  const storedState = sessionStorage.getItem(STORAGE_KEY_STATE);
  if (state !== storedState) {
    // eslint-disable-next-line no-console
    console.error('IES auth: state mismatch');
    return null;
  }

  const verifier = sessionStorage.getItem(STORAGE_KEY_VERIFIER);
  if (!verifier) {
    // eslint-disable-next-line no-console
    console.error('IES auth: missing PKCE verifier');
    return null;
  }

  try {
    const tokenRes = await fetch(iesUrl(`${IES_REALM}/access_token`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: getRedirectUri(),
        client_id: CLIENT_ID,
        code_verifier: verifier,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      // eslint-disable-next-line no-console
      console.error('IES auth: token exchange failed', tokenRes.status, errText);
      return null;
    }

    const tokens = await tokenRes.json();
    sessionStorage.setItem(STORAGE_KEY_TOKENS, JSON.stringify(tokens));

    // Clean up PKCE state
    sessionStorage.removeItem(STORAGE_KEY_VERIFIER);
    sessionStorage.removeItem(STORAGE_KEY_STATE);

    const user = extractUser(tokens);
    if (user) sessionStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    return user;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('IES auth: callback error', err);
    return null;
  }
}

/**
 * Returns the current user from session storage, or null if not logged in.
 */
export function getUser() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Returns the stored access token, or null.
 */
export function getAccessToken() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_TOKENS);
    if (!raw) return null;
    const tokens = JSON.parse(raw);
    return tokens.access_token || null;
  } catch {
    return null;
  }
}

/**
 * Log out: clear local session and reload the page.
 * IES end-session is skipped because the post_logout_redirect_uri
 * must also be whitelisted separately; for production, add
 * window.location.origin to the IES post-logout allowlist and
 * uncomment the endSession redirect below.
 */
export function logout() {
  sessionStorage.removeItem(STORAGE_KEY_TOKENS);
  sessionStorage.removeItem(STORAGE_KEY_USER);
  sessionStorage.removeItem(STORAGE_KEY_VERIFIER);
  sessionStorage.removeItem(STORAGE_KEY_STATE);
  window.location.reload();
}

/**
 * Returns true if the current page is the OAuth callback.
 */
export function isCallbackPage() {
  return window.location.pathname === CALLBACK_PATH;
}
