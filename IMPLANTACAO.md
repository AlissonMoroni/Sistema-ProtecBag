# Guia de implantação — versão segura (v1.1)

Esta versão troca o login "caseiro" (senha comparada no navegador) pelo **Firebase Authentication**
e fecha o banco com **regras de segurança por perfil e franquia**. Siga os passos **nesta ordem**.

> ⚠️ Até o passo 3, o banco continua aberto como antes. Faça tudo de uma vez.

## 1. Ativar o login no Firebase Console

Projeto: `united-elevator-79v0l` → **Authentication → Sign-in method**

1. Ative **E-mail/senha**.
2. Ative **Google** (usado pelo administrador principal `thetoic@gmail.com`).
3. Em **Authentication → Settings → Authorized domains**, confirme que o domínio onde o site
   roda está na lista (ex.: `localhost` e o domínio de produção).

## 2. Publicar o site novo

```bash
npm install
npm run build
```

Publique a pasta `dist/` no mesmo lugar de antes.

## 3. Publicar as regras do Firestore

Firebase Console → **Firestore Database** → selecione o banco
`ai-studio-65a398fb-0491-4472-b843-dd69185e5e56` → aba **Regras** → cole o conteúdo de
[`firestore.rules`](firestore.rules) → **Publicar**.

(Ou, com a Firebase CLI: `firebase deploy --only firestore:rules`.)

## 4. Primeiro acesso e migração

1. Abra o site e clique em **Entrar com Google** usando `thetoic@gmail.com`.
   O sistema cria automaticamente o seu perfil de Administrador Geral.
2. Vá em **Gestão de Colaboradores & Acessos**. Vai aparecer o aviso amarelo
   **"Migração de segurança pendente"**. Clique em **Migrar dados antigos agora**.
   - Cada usuário antigo ganha uma conta no Firebase Auth com uma **senha temporária nova**.
   - A senha antiga (texto puro) é apagada do banco.
   - Os faturamentos antigos ganham o campo `region` (necessário para os admins de franquia).
3. **Baixe o CSV** com as senhas temporárias e entregue a cada pessoa por canal privado.
   Elas não aparecem de novo. Quem preferir pode usar **"Esqueci minha senha"** na tela de login
   (funciona só se o e-mail for real).

Se algum usuário der "Já existe conta no Firebase Auth", apague essa conta em
**Authentication → Users** e rode a migração de novo.

## 5. Recomendado

- **Bloquear auto-cadastro:** qualquer pessoa consegue criar uma conta no Firebase Auth usando a
  chave pública do app. Sem um perfil cadastrado pelo admin, essa conta **não acessa nada**, mas
  dá para bloquear de vez em *Authentication → Settings → User actions → desmarcar "Enable create (sign-up)"*.
  ⚠️ Se fizer isso, o cadastro de novos colaboradores pelo painel deixa de funcionar (ele usa a
  mesma API). Nesse caso, crie as contas pelo Console.
- **Excluir colaborador** apaga o perfil (perde todo o acesso na hora). A conta continua em
  *Authentication → Users* e pode ser apagada lá.
- As senhas antigas (`admin`, `123`) ficaram públicas no histórico do GitHub. Depois da migração
  elas não servem para nada, mas não reutilize essas senhas em outros lugares.

## O que mudou (resumo)

| Antes | Agora |
|---|---|
| Firestore com `allow read, write: if true` | Acesso por perfil: admin geral, admin da base, colaborador (só os próprios lançamentos), consulta (só a franquia) |
| Senhas em texto puro no banco e no navegador | Senhas só no Firebase Auth, nunca no banco |
| "Login" salvo no `localStorage` (editável) | Sessão do Firebase Auth, validada no servidor pelas regras |
| Admin de franquia gerenciava qualquer usuário | Só colaboradores e consultas da própria base |
| Data do lançamento em UTC (errada depois das 21h) | Data local |
| Perfil "consulta" conseguia enviar lançamentos | Somente leitura, vê todos os lançamentos da franquia |
| Erro de gravação mostrava "sucesso" | Mostra o erro e mantém os dados no formulário |
| Excluir na auditoria sem confirmar | Pede confirmação |
| Filtros e telas "resetavam" a cada atualização | Atualização em tempo real sem perder o estado |
| Relatório com datas fixas de 2026 | Mês e semana atuais |
| ~15 pacotes 3D/IA sem uso, 1,7 MB de JS inicial | Só o necessário; painel admin e PDF carregam sob demanda |
| Tailwind via CDN | Tailwind instalado (build de produção) |
