
const crypto = require('crypto');
const { parse, serialize } = require('cookie');

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  STRAVA_CLIENT_ID,
  STRAVA_CLIENT_SECRET,
  APP_URL
} = process.env;

module.exports = async (req, res) => {
  const cookies = parse(req.headers.cookie || '');
  const raw = cookies.st_strava_state;

  res.setHeader('Set-Cookie', serialize(
    'st_strava_state',
    '',
    {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/api',
      maxAge: 0
    }
  ));

  const fallback = (msg) =>
    res.redirect(`${APP_URL}/?strava_error=${encodeURIComponent(msg)}#connections`);

  if (req.query.error) {
    return fallback(`Strava recusou autorização: ${req.query.error}`);
  }

  if (!raw || !req.query.code || !req.query.state) {
    return fallback('Estado OAuth ausente. Tente conectar novamente.');
  }

  try {
    const [payload, sig] = raw.split('.');

    const expected = crypto
      .createHmac('sha256', STRAVA_CLIENT_SECRET)
      .update(payload)
      .digest('base64url');

    if (
      !sig ||
      !crypto.timingSafeEqual(
        Buffer.from(sig),
        Buffer.from(expected)
      )
    ) {
      return fallback('Validação OAuth falhou.');
    }

    const data = JSON.parse(
      Buffer.from(payload, 'base64url').toString()
    );

    if (
      data.state !== req.query.state ||
      Date.now() - data.ts > 600000
    ) {
      return fallback('Solicitação expirada ou inválida.');
    }

    // Retorna ao domínio exato de onde a autorização começou.
    const origin = data.origin || APP_URL;
    const redirect = `${origin}/api/strava-callback`;

    const tokenResp = await fetch(
      'https://www.strava.com/oauth/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: STRAVA_CLIENT_ID,
          client_secret: STRAVA_CLIENT_SECRET,
          code: req.query.code,
          grant_type: 'authorization_code'
        })
      }
    );

    const tokenData = await tokenResp.json();

    if (!tokenResp.ok) {
      return res.redirect(
        `${origin}/?strava_error=${encodeURIComponent(
          tokenData.message || 'Falha ao obter token Strava'
        )}#connections`
      );
    }

    const athlete = tokenData.athlete || {};

    const row = {
      user_id: data.uid,
      strava_athlete_id: athlete.id,
      athlete_name: [
        athlete.firstname,
        athlete.lastname
      ].filter(Boolean).join(' '),
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
      scope: 'read,activity:read_all',
      updated_at: new Date().toISOString()
    };

    const db = await fetch(
      `${SUPABASE_URL}/rest/v1/strava_connections?on_conflict=user_id`,
      {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(row)
      }
    );

    if (!db.ok) {
      return res.redirect(
        `${origin}/?strava_error=${encodeURIComponent(
          'Autorização obtida, mas falhou ao salvar no Supabase.'
        )}#connections`
      );
    }

    return res.redirect(`${origin}/?strava_connected=1#connections`);

  } catch (e) {
    return fallback('Erro ao concluir Strava: ' + e.message);
  }
};
