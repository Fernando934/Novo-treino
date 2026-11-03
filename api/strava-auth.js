const crypto = require('crypto');
const { serialize } = require('cookie');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const APP_URL = process.env.APP_URL;
function send(res,status,obj){res.status(status).json(obj)}
module.exports = async (req,res)=>{
 if(req.method!=='POST') return send(res,405,{error:'Use POST'});
 if(!SUPABASE_URL||!SUPABASE_ANON_KEY||!STRAVA_CLIENT_ID||!STRAVA_CLIENT_SECRET||!APP_URL) return send(res,500,{error:'Variáveis de ambiente incompletas na Vercel.'});
 const token=req.body?.access_token;
 if(!token) return send(res,401,{error:'Sessão Supabase ausente. Entre novamente.'});
 try{
  const u=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${token}`}});
  if(!u.ok) return send(res,401,{error:'Sessão Supabase inválida ou expirada.'});
  const user=await u.json();
  const state=crypto.randomBytes(24).toString('hex');
  const payload=Buffer.from(JSON.stringify({uid:user.id,state,ts:Date.now()})).toString('base64url');
  const sig=crypto.createHmac('sha256',STRAVA_CLIENT_SECRET).update(payload).digest('base64url');
  res.setHeader('Set-Cookie',serialize('st_strava_state',`${payload}.${sig}`,{httpOnly:true,secure:true,sameSite:'lax',path:'/api',maxAge:600}));
  const redirect=`${APP_URL.replace(/\/$/,'')}/api/strava-callback`;
  const url=new URL('https://www.strava.com/oauth/authorize');
  url.searchParams.set('client_id',STRAVA_CLIENT_ID);url.searchParams.set('response_type','code');url.searchParams.set('redirect_uri',redirect);url.searchParams.set('approval_prompt','auto');url.searchParams.set('scope','read,activity:read_all');url.searchParams.set('state',state);
  return res.status(200).json({authorization_url:url.toString()});
 }catch(e){return send(res,500,{error:'Falha ao iniciar OAuth.',detail:e.message})}
};

