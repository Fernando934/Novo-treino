const crypto = require('crypto');

const {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  STRAVA_CLIENT_ID,
  STRAVA_CLIENT_SECRET
} = process.env;

function send(res, status, obj) {
  return res.status(status).json(obj);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return send(res, 405, { error: 'Use POST' });
  }

  const missing = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'STRAVA_CLIENT_ID',
    'STRAVA_CLIENT_SECRET'
  ].filter(name => !process.env[name]);

  if (missing.length) {
    return send(res, 500, {
      error: 'Variáveis incompletas na Vercel.',
      missing
    });
  }

  const token = req.body?.access_token;
  if (!token) {
    return send(res, 401, { error: 'Sessão Supabase ausente. Entre novamente.' });
  }

  try {
    const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`
      }
    });

    if (!userResp.ok) {
      return send(res, 401, { error: 'Sessão Supabase inválida ou expirada.' });
    }

    const user = await userResp.json();
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const origin = `${protocol}://${host}`;

    // State autocontido e assinado: não depende de cookie no navegador.
    const statePayload = Buffer.from(JSON.stringify({
      uid: user.id,
      origin,
      ts: Date.now(),
      nonce: crypto.randomBytes(24).toString('hex')
    })).toString('base64url');

    const stateSignature = crypto
      .createHmac('sha256', STRAVA_CLIENT_SECRET)
      .update(statePayload)
      .digest('base64url');

    const state = `${statePayload}.${stateSignature}`;
    const redirectUri = `${origin}/api/strava-callback`;

    const url = new URL('https://www.strava.com/oauth/authorize');
    url.searchParams.set('client_id', STRAVA_CLIENT_ID);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('approval_prompt', 'auto');
    url.searchParams.set('scope', 'read,activity:read_all');
    url.searchParams.set('state', state);

    return res.status(200).json({ authorization_url: url.toString() });
  } catch (e) {
    return send(res, 500, { error: 'Falha ao iniciar OAuth.', detail: e.message });
  }
};
