# StaminaLab 360° — revisão inicial (v2 em preparação)

Projeto web estático publicado pelo GitHub e Vercel.

## Estrutura atual
- `index.html`: interface, estilos via CDN e lógica JavaScript no navegador.
- Persistência atual: `localStorage` do navegador.

## Alterações desta revisão inicial
- Leitura defensiva de JSON no `localStorage` para evitar que dados corrompidos interrompam a inicialização.
- Remoção dos pesos/idades fictícios predefinidos para perfis novos.
- Validação de dados biométricos antes de salvar.
- Validação de backup antes de importar atividades e biometria.
- Remoção do ritmo/duração fictícios ao cadastrar atividade; agora é exigida duração ou ritmo real.
- Cálculo do ritmo a partir de duração/distância quando o usuário não informa o ritmo.
- Cálculo do volume semanal limitado à semana atual (segunda a hoje), excluindo atividades futuras.
- Filtro de meses gerado dinamicamente, incluindo a virada do ano.
- Ritmo médio ponderado pela distância, em vez de média simples das sessões.
- Previsões sem ritmo padrão inventado: exigem atividade recente válida de 3 a 15 km e limitam extrapolações.
- Sanitização de alguns campos livres exibidos no HTML e validação do identificador do perfil.

## Limitações conhecidas — não considerar produção concluída
- Ainda é uma aplicação de página única; não há backend nem banco de dados multiusuário.
- `localStorage` não sincroniza entre dispositivos e não é adequado para contas privadas compartilhadas.
- Não existe integração Strava nesta revisão. A conexão exige OAuth 2.0, rotas de servidor, variáveis de ambiente e configuração no portal de desenvolvedores do Strava.
- O plano semanal ainda contém regras estáticas e não deve ser tratado como prescrição individual ou IA. Antes de automatizar cargas, será necessário implementar avaliação de histórico, disponibilidade, recuperação, experiência, lesões e objetivos.
- Previsões de desempenho são estimativas matemáticas, não garantias nem substituem resultados de prova.

## Publicação segura no Vercel
1. Faça upload desta versão em uma branch de teste (ex.: `staminalab-v2`).
2. Confira o Preview Deployment do Vercel.
3. Teste perfis, cadastro/edição/exclusão de atividades, filtros, gráficos e backup.
4. Só depois faça merge na branch de produção.

Não publique chaves ou tokens do Strava no HTML, JavaScript do navegador ou repositório.
