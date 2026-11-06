// Cloudflare Worker for R5S / Decap CMS. Credentials belong in Worker Secrets.
const WORKER_ORIGIN = 'https://r5s-auth.dmitry724.workers.dev';
const SITE_ORIGIN = 'https://r5s.ru';
const REPO = 'dmitry724gmail/r5s-site';
const COOKIE = '__Host-r5s-oauth';
const encoder = new TextEncoder();
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const random = () => b64(crypto.getRandomValues(new Uint8Array(32)));
const cookie = (value, age) => `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
const headers = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};
function reply(text, status = 200, extra = {}) {
  return new Response(text, { status, headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8', ...extra } });
}
async function key(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function signedSession(state, verifier, secret) {
  const body = `${state}.${verifier}.${Date.now() + 600000}`;
  return body + '.' + b64(await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(body)));
}
async function readSession(request, secret) {
  try {
    const raw = (request.headers.get('Cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
    if (!raw) return null;
    const parts = raw.split('.');
    if (parts.length !== 4 || !/^[\w-]{43}$/.test(parts[0]) || !/^[\w-]{43}$/.test(parts[1]) || !/^[\w-]{43}$/.test(parts[3])) return null;
    const expires = Number(parts[2]);
    if (!Number.isFinite(expires) || expires <= Date.now() || expires > Date.now() + 600000) return null;
    const bytes = Uint8Array.from(atob(parts[3].replace(/-/g, '+').replace(/_/g, '/') + '='), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', await key(secret), bytes, encoder.encode(parts.slice(0, 3).join('.')));
    return valid ? { state: parts[0], verifier: parts[1] } : null;
  } catch { return null; }
}
function popup(payload, success) {
  const nonce = random();
  const message = 'authorization:github:' + (success ? 'success:' : 'error:') + JSON.stringify(payload);
  const literal = JSON.stringify(message).replace(/</g, '\\u003c');
  const html = `<!doctype html><html lang="ru"><meta charset="utf-8"><title>Вход R5S</title><p id="status">Завершаем вход. Не закрывайте окно…</p><script nonce="${nonce}">
const origin = ${JSON.stringify(SITE_ORIGIN)};
const openerWindow = window.opener;
if (!openerWindow) {
  document.getElementById('status').textContent = 'Откройте вход через https://r5s.ru/admin/';
} else {
  const timer = setTimeout(() => { window.removeEventListener('message', receive); document.getElementById('status').textContent = 'Время ожидания истекло. Повторите вход из админки.'; }, 60000);
  function receive(event) {
    if (event.origin !== origin || event.source !== openerWindow || event.data !== 'authorizing:github') return;
    window.removeEventListener('message', receive);
    clearTimeout(timer);
    openerWindow.postMessage(${literal}, origin);
    document.getElementById('status').textContent = 'Ответ передан редактору. Это окно можно закрыть.';
  }
  window.addEventListener('message', receive);
  openerWindow.postMessage('authorizing:github', origin);
}
</script></html>`;
  return reply(html, 200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Set-Cookie': cookie('', 0),
    'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`,
  });
}
async function githubFetch(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      ...options,
      headers: { 'User-Agent': 'R5S-Admin', ...options.headers },
      redirect: 'manual',
      signal: controller.signal,
    });
    // Consume the body under the same timeout and reject non-JSON responses safely.
    const body = await response.text();
    if (response.status >= 300 && response.status < 400) throw new Error('REDIRECT_' + response.status);
    if (!response.ok) throw new Error('HTTP_' + response.status);
    try { return JSON.parse(body); } catch { throw new Error('INVALID_JSON'); }
  } catch (error) {
    if (controller.signal.aborted) throw new Error('TIMEOUT');
    if (/^(REDIRECT_[0-9]{3}|HTTP_[0-9]{3}|INVALID_JSON)$/.test(error?.message || '')) throw error;
    throw new Error('NETWORK');
  } finally { clearTimeout(timer); }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.origin !== WORKER_ORIGIN) return reply('Неверный адрес сервиса.', 400);
    if (request.method !== 'GET') return reply('Method not allowed', 405, { Allow: 'GET' });
    if (url.pathname === '/' || url.pathname === '/health') {
      const configured = Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
      return reply(configured ? 'R5S: сервис входа настроен. Откройте https://r5s.ru/admin/ для проверки входа.' : 'R5S: добавьте GITHUB_CLIENT_ID и GITHUB_CLIENT_SECRET в Cloudflare Secrets.', configured ? 200 : 503);
    }
    if (!['/auth', '/callback'].includes(url.pathname)) return reply('Not found', 404);
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) return reply('Добавьте GITHUB_CLIENT_ID и GITHUB_CLIENT_SECRET в Cloudflare Secrets.', 503);
    let stage = 'START';
    try {
      if (url.pathname === '/auth') {
        if (url.searchParams.get('provider') !== 'github' || url.searchParams.get('site_id') !== 'r5s.ru') return reply('Вход разрешён только из редактора r5s.ru.', 400);
        const state = random();
        const verifier = random();
        const target = new URL('https://github.com/login/oauth/authorize');
        target.search = new URLSearchParams({
          client_id: env.GITHUB_CLIENT_ID,
          redirect_uri: WORKER_ORIGIN + '/callback',
          scope: 'public_repo',
          state,
          code_challenge: b64(await crypto.subtle.digest('SHA-256', encoder.encode(verifier))),
          code_challenge_method: 'S256',
          allow_signup: 'false',
        }).toString();
        return reply('', 302, { Location: target.href, 'Set-Cookie': cookie(await signedSession(state, verifier, env.GITHUB_CLIENT_SECRET), 600) });
      }
      const session = await readSession(request, env.GITHUB_CLIENT_SECRET);
      const state = url.searchParams.get('state');
      if (!session || !state || state !== session.state) return reply('Сеанс входа истёк или не совпадает. Закройте окно и повторите вход из https://r5s.ru/admin/', 400, { 'Set-Cookie': cookie('', 0) });
      if (url.searchParams.has('error')) return popup({ message: 'Вход через GitHub отменён.' }, false);
      const code = url.searchParams.get('code');
      if (!code || code.length > 512) return reply('Отсутствует код авторизации.', 400, { 'Set-Cookie': cookie('', 0) });
      stage = 'TOKEN';
      const data = await githubFetch('https://github.com/login/oauth/access_token', {
        method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: WORKER_ORIGIN + '/callback', code_verifier: session.verifier }).toString(),
      });
      if (data.error || typeof data.access_token !== 'string' || !data.access_token) return popup({ message: 'GitHub не подтвердил вход (TOKEN_REJECTED). Проверьте Client ID, Client Secret и callback приложения.' }, false);
      stage = 'REPOSITORY';
      const repo = await githubFetch('https://api.github.com/repos/' + REPO, {
        headers: { Authorization: 'Bearer ' + data.access_token, Accept: 'application/vnd.github+json', 'User-Agent': 'R5S-Admin', 'X-GitHub-Api-Version': '2022-11-28' },
      });
      if ( repo.full_name?.toLowerCase() !== REPO || repo.permissions?.push !== true) return popup({ message: 'У этого аккаунта нет права редактировать сайт R5S.' }, false);
      // Only the access token reaches the authenticated CMS popup. No refresh token or client secret is returned.
      // If an expiring token expires, sign out and sign in again through the CMS.
      return popup({ token: data.access_token, provider: 'github' }, true);
    } catch (error) {
      // Only allowlisted diagnostic codes are displayed. No server responses, codes or secrets.
      const reason = /^(REDIRECT_\d{3}|HTTP_\d{3}|INVALID_JSON|TIMEOUT|NETWORK)$/.test(error?.message || '') ? error.message : 'INTERNAL';
      return popup({ message: 'Не удалось завершить вход. Код: ' + stage + '_' + reason + '. Сообщите этот код для проверки.' }, false);
    }
  },
};
