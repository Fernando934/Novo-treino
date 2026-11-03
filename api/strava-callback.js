const crypto=require('crypto');const {parse,serialize}=require('cookie');
const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,STRAVA_CLIENT_ID,STRAVA_CLIENT_SECRET,APP_URL}=process.env;
module.exports=async(req,res)=>{
 const cookies=parse(req.headers.cookie||'');const raw=cookies.st_strava_state;
 res.setHeader('Set-Cookie',serialize('st_strava_state','',{httpOnly:true,secure:true,sameSite:'lax',path:'/api',maxAge:0}));
 const fail=(msg)=>res.redirect(`${APP_URL}/?strava_error=${encodeURIComponent(msg)}#connections`);
 if(req.query.error)return fail(`Strava recusou autorização: ${req.query.error}`);
 if(!raw||!req.query.code||!req.query.state)return fail('Estado OAuth ausente. Tente conectar novamente.');
 try{
  const [payload,sig]=raw.split('.');const expected=crypto.createHmac('sha256',STRAVA_CLIENT_SECRET).update(payload).digest('base64url');
  if(!sig||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return fail('Validação OAuth falhou.');
  const data=JSON.parse(Buffer.from(payload,'base64url').toString());
  if(data.state!==req.query.state||Date.now()-data.ts>600000)return fail('Solicitação expirada ou inválida.');
  const redirect=`${APP_URL.replace(/\/$/,'')}/api/strava-callback`;
  const tokenResp=await fetch('https://www.strava.com/oauth/token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_id:STRAVA_CLIENT_ID,client_secret:STRAVA_CLIENT_SECRET,code:req.query.code,grant_type:'authorization_code'})});
  const tokenData=await tokenResp.json();if(!tokenResp.ok) return fail(tokenData.message||'Não foi possível trocar o código por token.');
  const athlete=tokenData.athlete||{};
  const row={user_id:data.uid,strava_athlete_id:athlete.id,athlete_name:[athlete.firstname,athlete.lastname].filter(Boolean).join(' '),access_token:tokenData.access_token,refresh_token:tokenData.refresh_token,expires_at:tokenData.expires_at,scope:'read,activity:read_all',updated_at:new Date().toISOString()};
  const db=await fetch(`${SUPABASE_URL}/rest/v1/strava_connections?on_conflict=user_id`,{method:'POST',headers:{apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(row)});
  if(!db.ok)return fail('Autorização Strava obtida, mas não foi possível salvar a conexão no banco. Confira o SQL e as variáveis Supabase.');
  return res.redirect(`${APP_URL}/?strava_connected=1#connections`);
 }catch(e){return fail('Erro ao concluir Strava: '+e.message)}
};
