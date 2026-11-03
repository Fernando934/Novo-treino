const crypto = require('crypto');

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  STRAVA_CLIENT_ID,
  STRAVA_CLIENT_SECRET,
  APP_URL
} = process.env;

function safeOrigin(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || !u.hostname.endsWith('.vercel.app') && u.hostname !== 'vercel.app') {
      return null;
    }
    return u.origin;
  } catch (_) {
    return null;
  }
}

module.exports = async (req, res) => {
  const fallbackOrigin = safeOrigin(APP_URL) || 'https://treinador-chi.vercel.app';
  const fallback = (msg) => res.redirect(
    `${fallbackOrigin}/?strava_error=${encodeURIComponent(msg)}#connections`
  );

  if (req.query.error) {
    return fallback(`Strava recusou autorização: ${req.query.error}`);
  }

  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  if (!state || !code) {
    return fallback('Retorno OAuth incompleto (state ou code ausente). Inicie a conexão novamente.');
  }

  if (!STRAVA_CLIENT_SECRET || !STRAVA_CLIENT_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return fallback('Variáveis do backend incompletas na Vercel.');
  }

  try {
    // O state contém payload + HMAC. Não é necessário cookie/sessão do navegador.
    const dot = state.lastIndexOf('.');
    if (dot <= 0 || dot === state.length - 1) {
      return fallback('Estado OAuth inválido. Inicie a conexão novamente.');
    }

    const payload = state.slice(0, dot);
    const signature = state.slice(dot + 1);
    const expected = crypto.createHmac('sha256', STRAVA_CLIENT_SECRET)
      .update(payload)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length ||
        !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return fallback('Assinatura do estado OAuth inválida. Inicie novamente.');
    }

    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.uid || !data.origin || !data.ts || Date.now() - data.ts > 10 * 60 * 1000 || Date.now() < data.ts - 60 * 1000) {
      return fallback('Solicitação OAuth expirada ou inválida. Inicie novamente.');
    }

    const origin = safeOrigin(data.origin);
    if (!origin) {
      return fallback('Domínio de retorno OAuth inválido. Inicie novamente.');
    }

    const redirectUri = `${origin}/api/strava-callback`;
    const tokenResp = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResp.json();
    if (!tokenResp.ok) {
      return res.redirect(`${origin}/?strava_error=${encodeURIComponent(
        tokenData.message || tokenData.errors?.[0]?.message || 'Falha na troca do código Strava'
      )}#connections`);
    }

    const athlete = tokenData.athlete || {};
    const row = {
      user_id: data.uid,
      strava_athlete_id: athlete.id,
      athlete_name: [athlete.firstname, athlete.lastname].filter(Boolean).join(' '),
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
      scope: 'read,activity:read_all',
      updated_at: new Date().toISOString()
    };

    const db = await fetch(`${SUPABASE_URL}/rest/v1/strava_connections?on_conflict=user_id`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(row)
    });

    if (!db.ok) {
      const detail = await db.text().catch(() => '');
      return res.redirect(`${origin}/?strava_error=${encodeURIComponent(
        `Strava autorizado, mas não foi possível salvar no Supabase (${db.status}). ${detail.slice(0,180)}`
      )}#connections`);
    }

    return res.redirect(`${origin}/?strava_connected=1#connections`);
  } catch (e) {
    return fallback('Erro ao concluir Strava: ' + (e.message || 'erro inesperado'));
  }
};
