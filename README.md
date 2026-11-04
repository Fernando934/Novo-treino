# StaminaLab 360° — pacote integrado

Aplicação web estática com rotas serverless para OAuth/importação do Strava.

## O que está incluído nesta versão
- **Strava:** autorização OAuth sem dependência de cookie de estado; validação HMAC do `state`; suporte a domínio Vercel e ao domínio HTTPS definido em `APP_URL`; renovação de token e importação de atividades com paginação.
- **Importação:** confirmação antes de gravar, prevenção de duplicatas por `strava_id` e mapeamento de corrida, caminhada, ciclismo e esteira para o tipo correspondente.
- **Plano semanal:** calendário completo de segunda a domingo, sexta-feira incluída e domingo fixo para descanso; sessões de corrida e força com elásticos distribuídas de forma conservadora conforme as preferências/histórico disponíveis.
- **Biblioteca:** quatro ilustrações SVG corrigidas e instruções para movimentos com elásticos.
- **Interface:** mantém o menu lateral e o layout premium existentes.
- **Conta:** login Supabase e sincronização de dados do atleta.

## Estrutura
- `index.html`: interface, lógica do app e cliente Supabase.
- `api/strava-auth.js`: inicia OAuth e valida a sessão Supabase.
- `api/strava-callback.js`: valida o retorno OAuth e grava tokens no Supabase.
- `api/strava-activities.js`: renova tokens quando necessário e consulta atividades no Strava.
- `package.json`: dependências do backend.

## Variáveis de ambiente na Vercel
Configure no projeto Vercel:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — somente no ambiente server-side da Vercel; nunca exponha no HTML.
- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `APP_URL` — URL pública HTTPS principal do app, por exemplo `https://seu-projeto.vercel.app`.

No portal de desenvolvedores do Strava, configure o callback/redirect URI exatamente como:
`https://SEU-DOMINIO/api/strava-callback`

O domínio usado para iniciar a autorização deve corresponder ao redirect URI cadastrado no Strava. Se usar domínio próprio, configure também esse domínio em `APP_URL`.

## Tabelas necessárias no Supabase

A aplicação usa `stamina_data` para os dados do atleta e `strava_connections` para tokens do Strava. Execute no SQL Editor:

```sql
create table if not exists public.stamina_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.stamina_data enable row level security;
create policy "Usuário acessa seus próprios dados"
on public.stamina_data for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.strava_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  strava_athlete_id bigint,
  athlete_name text,
  access_token text not null,
  refresh_token text not null,
  expires_at bigint not null,
  scope text,
  updated_at timestamptz not null default now()
);

alter table public.strava_connections enable row level security;
-- Não crie políticas de leitura para usuários comuns nesta tabela.
-- O backend acessa-a usando SUPABASE_SERVICE_ROLE_KEY.
```

**Segurança:** a `SERVICE_ROLE_KEY` e o `STRAVA_CLIENT_SECRET` devem existir somente nas variáveis de ambiente da Vercel. Não os coloque no repositório nem no navegador. Se algum segredo já foi publicado anteriormente, revogue-o e gere outro.

## Testes recomendados antes de promover para produção
1. Faça deploy de Preview na branch de teste.
2. Entre com uma conta Supabase e confira sincronização em dois navegadores/dispositivos.
3. Conecte o Strava, confirme o retorno ao domínio correto, consulte e importe atividades.
4. Confira que a importação não duplica atividades e que caminhada/ciclismo não entram nos totais de corrida.
5. Gere o plano semanal e confira os sete dias, sexta-feira e domingo de descanso.
6. Abra a biblioteca em desktop e celular e confira as quatro ilustrações.
7. Só depois promova o deploy para produção.

O plano é uma sugestão geral, não prescrição clínica ou treinamento individualizado. Ajuste volume e intensidade à experiência, recuperação e histórico real; interrompa diante de dor ou sintomas incomuns.
