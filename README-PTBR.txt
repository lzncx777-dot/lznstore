LZN STORE — INSTALAÇÃO

O QUE ESTÁ INCLUÍDO
- index.html: loja preta e dourada, catálogo, busca, filtros, sacola e formulário de entrega.
- api/create-preference.js: cria pedido e checkout Mercado Pago no servidor.
- api/mercadopago-webhook.js: recebe atualizações do pagamento.
- api/admin/: APIs protegidas para produtos e pedidos.
- supabase/schema.sql: tabelas, RLS, perfil e produtos de demonstração.

PASSO 1 — SUPABASE
1. Abra o projeto Supabase > SQL Editor.
2. Execute supabase/schema.sql.
3. Em Project Settings > API, copie Project URL e anon/public key.
4. No index.html, no fim do arquivo, substitua:
   COLE_A_URL_DO_SEU_SUPABASE
   COLE_A_CHAVE_ANON_PUBLICA
   Use somente a chave anon/public no navegador. NUNCA use service_role no index.html.

PASSO 2 — CRIAR SEU ADMIN
1. Crie uma conta no Supabase Authentication > Users (ou pelo fluxo de login, depois de habilitar cadastro).
2. No SQL Editor execute, trocando o e-mail:
   update public.profiles p
   set role = 'admin'
   from auth.users u
   where p.id = u.id and u.email = 'SEU-EMAIL@EXEMPLO.COM';
3. Faça login pelo link Admin da loja. O login é o usuário do Supabase Auth.

PASSO 3 — VARIÁVEIS DA VERCEL
No projeto Vercel > Settings > Environment Variables, adicione:
SUPABASE_URL = URL do projeto
SUPABASE_ANON_KEY = chave anon/public
SUPABASE_SERVICE_ROLE_KEY = chave service_role (SOMENTE VERCEL, segredo)
MERCADOPAGO_ACCESS_TOKEN = token de acesso do Mercado Pago
MERCADOPAGO_WEBHOOK_SECRET = segredo de assinatura do webhook
SITE_URL = https://SEU-DOMINIO.vercel.app

Marque Production, Preview e Development conforme necessário. Salve e faça Redeploy.
Não compartilhe nem publique as chaves secretas.

PASSO 4 — MERCADO PAGO
1. Use credenciais de TESTE primeiro.
2. Configure a URL de notificações/webhook:
   https://SEU-DOMINIO.vercel.app/api/mercadopago-webhook
3. Ative notificações de pagamentos e copie o segredo de assinatura para MERCADOPAGO_WEBHOOK_SECRET.
4. Faça uma compra de teste. Só depois de validar tudo use credenciais de produção.
A URL de retorno sozinha não comprova pagamento. O status do pedido é atualizado pela notificação consultando o pagamento na API do Mercado Pago.

PASSO 5 — GITHUB / VERCEL
1. Envie TODOS os arquivos e pastas deste pacote para a raiz do repositório GitHub ligado à Vercel.
2. A estrutura precisa ficar assim:
   index.html
   package.json
   vercel.json
   api/_lib.js
   api/create-preference.js
   api/mercadopago-webhook.js
   api/admin/products.js
   api/admin/orders.js
   supabase/schema.sql
3. Faça commit na branch main e aguarde a Vercel publicar.

IMPORTANTE SOBRE O FORNECEDOR
A loja registra pedidos e endereço e o painel permite acompanhar status. A compra no fornecedor e o despacho direto ao cliente continuam sendo uma operação sua: este pacote NÃO faz login automático nem compra sozinho em sites de fornecedores. Adicione links de fornecedor no cadastro do produto para consulta privada no painel.

ANTES DE VENDER
- Configure domínio, e-mail e WhatsApp de atendimento.
- Revise preços, estoque, prazos, política de troca/devolução, privacidade e termos.
- Configure frete real; esta primeira versão ainda não calcula transportadora nem etiqueta.
- Teste pagamentos, webhook, cancelamentos, reembolsos e segurança em modo de teste.
- Não anuncie produto sem confirmar disponibilidade e prazo com o fornecedor.

LIMITAÇÕES / PRÓXIMAS MELHORIAS
Esta é uma base funcional inicial, não uma operação comercial certificada. Não há cálculo de frete, emissão fiscal, integração automática com fornecedor, rastreamento de transportadora nem e-mails transacionais. A API cria pedido como guest; login administrativo é separado. Faça revisão técnica e jurídica antes de operar em produção.
