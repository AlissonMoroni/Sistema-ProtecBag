# PRODUCT REQUIREMENTS DOCUMENT (PRD)
## PROTECBAG SISTEMAS — CONTROLE DE FATURAMENTO DIÁRIO & AUDITORIA OPERACIONAL

**Versão do Documento:** 2.4.0  
**Data:** 10 de Novembro de 2026  
**Finalidade:** Guia técnico de referência e especificação para ferramentas de QA automatizado, testes de penetração (pentest), varreduras de vulnerabilidades (DAST/SAST) e auditoria de conformidade funcional.

---

## 1. VISÃO GERAL DO PRODUTO (PRODUCT OVERVIEW)

### 1.1 Objetivo
O **ProtecBag Sistemas** é uma aplicação web corporativa voltada para a gestão, registro e conciliação do faturamento de turnos operacionais de proteção e embalagem de bagagens em aeroportos do Brasil (Polos CWB - Curitiba e REC - Recife). O sistema atua como ponto único de lançamento operacional por colaboradores e plataforma gerencial de auditoria financeira, validação de fluxo de caixa e emissão de relatórios fiscais/gerenciais.

### 1.2 Ambientes de Execução & URLs de Teste
- **Ambiente de Desenvolvimento (Dev):**  
  `https://ais-dev-3eq5bheim53uzdnui5di5d-688981580191.us-west2.run.app`
- **Ambiente de Demonstração / Homologação (Shared):**  
  `https://ais-pre-3eq5bheim53uzdnui5di5d-688981580191.us-west2.run.app`
- **Porta Local:** `3000`
- **Database ID Firestore:** `ai-studio-65a398fb-0491-4472-b843-dd69185e5e56`

### 1.3 Stack Tecnológica
- **Frontend:** React 19 SPA, TypeScript 5+, Vite
- **Estilização & UI:** Tailwind CSS, Lucide React (Ícones corporativos)
- **Visualização de Dados:** Recharts (Gráficos analíticos de faturamento por franquia)
- **Persistência & Sincronização:** Google Cloud Firestore SDK v10 (Realtime Listeners `onSnapshot` + fallback de persistência em cache local)
- **Criptografia & Segurança:** Web Crypto API (`window.crypto.subtle`) com SHA-256 salted hashing e Lockout Manager persistido
- **Exportação de Documentos:** `jspdf` e `jspdf-autotable` para relatórios gerenciais e demonstrativos de embalagens vendidas

---

## 2. MATRIZ DE CONTROLE DE ACESSO & CONTAS DE TESTE (RBAC MATRIX)

O sistema possui 4 níveis de privilégios estritos. Ferramentas de teste devem validar os limites horizontais e verticais de permissão (prevenção de IDOR e elevação de privilégios).

| Nível / Role | Escopo de Visão | Permissão de Lançamento | Permissão de Auditoria / Aprovação | Gestão de Equipe / Colaboradores |
| :--- | :--- | :--- | :--- | :--- |
| **`admin` (Administrador Geral)** | Todas as franquias (Global / Matriz) | Sim (Simulação / Teste) | Sim (Aprovar / Rejeitar / Auditar todas) | Sim (Adicionar, editar, inativar, excluir, resetar) |
| **`admin_franquia` (Admin Regional)** | Somente franquias da sua base (ex: CWB ou REC) | Não / Restrito | Sim (Apenas lançamentos da sua base) | Consulta da base |
| **`colaborador` (Operador de Caixa)** | Somente lançamentos da sua própria franquia | Sim (Lançamento e edição restrito à sua filial) | Não | Não |
| **`usuario_normal` (Consulta Operacional)** | Somente visualização da sua própria franquia | Não (Somente leitura) | Não | Não |

### 2.1 Credenciais Pré-configuradas para Testes Automatizados

| Role | E-mail de Acesso | Senha Inicial | Token ID de Acesso | Franquia Alocada |
| :--- | :--- | :--- | :--- | :--- |
| **Admin Geral** | `admin@protecbag.com.br` | `admin` | `PB-TOK-ADM-001` | `TODAS / Matriz` |
| **Admin Regional CWB** | `admin.cwb@protecbag.com.br` | `admin` | `PB-TOK-CWB-901` | `CWB` (CWB01, 02, 03) |
| **Admin Regional REC** | `admin.rec@protecbag.com.br` | `admin` | `PB-TOK-REC-902` | `REC` (REC01, 02, 03) |
| **Colaborador CWB01** | `marcos.cwb@protecbag.com.br` | `123` | `PB-TOK-CWB-101` | `CWB01` |
| **Colaborador CWB02** | `juliana.cwb@protecbag.com.br` | `123` | `PB-TOK-CWB-102` | `CWB02` |
| **Colaborador REC01** | `felipe.rec1@protecbag.com.br` | `123` | `PB-TOK-REC-201` | `REC01` |
| **Colaborador REC02** | `mariana.rec2@protecbag.com.br` | `123` | `PB-TOK-REC-202` | `REC02` |
| **Usuário Normal (Leitura)**| `renata.consulta@protecbag.com.br` | `123` | `PB-TOK-USR-301` | `CWB01` |

---

## 3. ESPECIFICAÇÕES DE SEGURANÇA & CRIPTOGRAFIA

### 3.1 Hashing Salteado de Senhas (Anti-Leak Engine)
- **Algoritmo:** SHA-256 via `window.crypto.subtle.digest`.
- **Salt:** 16 bytes pseudo-aleatórios gerados via `crypto.getRandomValues()`.
- **Pepper Corporativo:** `PB_CORP_SECURITY_SALT_2026_PROTECBAG`.
- **Fórmula de Digestão:** `SHA-256("${userSalt}:${plainPassword}:${PEPPER}")`.
- **Sanitização de Sessão:** Ao persistir o usuário ativo no `localStorage` (`protecbag_auth_current_user_v6`), as propriedades `password`, `passwordHash` e `passwordSalt` são obrigatoriamente deletadas.
- **Prevenção de Fuga na UI:** A tabela de colaboradores e as telas de perfil nunca renderizam a senha em texto puro.

### 3.2 Política de Bloqueio Contra Força Bruta (Brute-Force Lockout Policy)
- **Chave de Rastreamento:** `protecbag_sec_lockout_<identifier>` (onde identifier é o e-mail ou o Token ID em formato minúsculo).
- **Limite de Tentativas Consecutivas:** Exatamente 3 tentativas falhas (`MAX_LOGIN_ATTEMPTS = 3`).
- **Tempo de Bloqueio (Lockout Duration):** 2 minutos (120.000 ms).
- **Comportamento da Interface:**
  1. Tentativas 1 e 2: Alerta dinâmico informando as tentativas restantes (`Tentativa X de 3`).
  2. Tentativa 3: Bloqueio automático. Exibição de banner vermelho de emergência com contador regressivo em tempo real (`MM:SS`).
  3. Desativação de Controles: Todos os campos de input e botão de login são marcados como `disabled`.
  4. Persistência de Bloqueio: Recarregar a página (F5) não anula o bloqueio, pois a data de liberação (`lockedUntil`) é validada contra o timestamp atual do sistema.
  5. Desbloqueio Gerencial: O Administrador Geral possui botão dedicado ("Desbloquear") na tela de Gestão de Colaboradores para limpar o bloqueio caso solicitado pelo operador.

### 3.3 Acesso com Token ID Corporativo
- Permite acesso rápido por Chave / Token sem a necessidade de expor ou digitar senhas padrão.
- Formato: `PB-TOK-XXXX-XXXX` (gerado criptograficamente com 8 bytes hexadecimais em maiúsculas).
- Aceito diretamente no campo "Chave Token ID" ou no campo "E-mail ou Token ID".

---

## 4. REGRAS DE NEGÓCIO, CATÁLOGO E VALIDAÇÃO FINANCEIRA

### 4.1 Catálogo Oficial de Embalagens e Serviços (Preços Fixos)
O sistema opera com preços tabelados invioláveis:

| ID do Produto | Descrição Oficial | Preço Unitário |
| :--- | :--- | :--- |
| `prod_aerobag_mg` | Aerobag M/G | R$ 199,00 |
| `prod_aerobag_parceria` | Aerobag Parceria | R$ 179,00 |
| `prod_lacracao_basico` | Lacração Básico Pequeno | R$ 149,00 |
| `prod_lacre_especial` | Lacre Especial | R$ 298,00 |
| `prod_extra_grande` | Extra Grande | R$ 398,00 |
| `prod_tag_digital` | Tag Digital | R$ 60,00 |
| `prod_manual_total` | Total de Produtos Manual (Sem discriminação de itens) | Valor Direto (R$) |

### 4.2 Formas de Pagamento Homologadas
1. Cartão de Crédito (`payments.credit`)
2. Cartão de Débito (`payments.debit`)
3. PIX (`payments.pix`)
4. Dinheiro em Espécie (`payments.cash`)
5. Outros / Vouchers (`payments.others`)

### 4.3 Invariante Matemática e Sistema de Alerta de Divergência
- **Cálculo de Produtos:**  
  $$\text{TotalProdutos} = \sum (\text{quantidade} \times \text{preçoUnitário}) + \text{manualProductsAmount}$$
- **Cálculo de Pagamentos:**  
  $$\text{TotalPagamentos} = \text{Crédito} + \text{Débito} + \text{PIX} + \text{Dinheiro} + \text{Outros}$$
- **Invariante de Caixa:**  
  $$\text{Diferença} = \text{TotalPagamentos} - \text{TotalProdutos}$$
- **Regra de Auditoria Automática:**
  - Se $\text{Diferença} == 0$: Caixa balanceado. Badge verde indicando conferência exata.
  - Se $\text{Diferença} \neq 0$: Quebra de caixa detectada. A interface do Administrador dispara um **alerta visual destacado** (badge vermelho/amarelo com o valor exato da sobra ou falta de caixa), bloqueando a aprovação sem notas de auditoria explicativas.

---

## 5. ESTRUTURA DE DADOS & SCHEMAS FIRESTORE

### 5.1 Coleção: `users`
Caminho: `/users/{userId}`

```typescript
interface UserDocument {
  id: string;                    // Identificador único (ex: 'usr_1731234567890' ou 'usr_admin_global')
  name: string;                  // Nome completo do colaborador
  email: string;                 // E-mail corporativo em minúsculas (único)
  tokenId: string;               // Token ID corporativo (ex: 'PB-TOK-CWB-101')
  passwordHash?: string;         // Hash SHA-256 com salt
  passwordSalt?: string;         // Salt exclusivo de 16 bytes
  role: 'admin' | 'admin_franquia' | 'colaborador' | 'usuario_normal';
  franchise: string;             // 'TODAS / Matriz' ou 'CWB', 'REC', 'CWB01', 'CWB02', 'CWB03', 'REC01', 'REC02', 'REC03'
  active: boolean;               // Flag de bloqueio operacional (true = ativo, false = inativo)
  phone?: string;                // Telefone de contato corporativo
  createdAt: string;             // ISO 8601 Timestamp
  updatedAt?: string;            // ISO 8601 Timestamp
}
```

### 5.2 Coleção: `billings`
Caminho: `/billings/{billingId}`

```typescript
interface ShiftBillingDocument {
  id: string;                    // Identificador do lançamento (ex: 'bil_sep_001')
  date: string;                  // Data contábil no formato YYYY-MM-DD
  month: string;                 // Mês contábil no formato YYYY-MM (ex: '2026-09')
  shift: 'Manhã' | 'Tarde' | 'Noite';
  franchise: string;             // Código da Franquia (ex: 'CWB01')
  collaboratorId: string;        // ID do usuário criador
  collaboratorName: string;      // Nome do colaborador
  products: {
    id: string;                  // ID do produto cadastrado
    name: string;                // Nome do produto
    quantity: number;            // Quantidade vendida (inteiro >= 0)
    unitPrice: number;           // Preço unitário tabelado (float >= 0)
  }[];
  payments: {
    credit: number;
    debit: number;
    pix: number;
    cash: number;
    others: number;
  };
  totalProductsAmount: number;   // Soma dos produtos
  totalPaymentsAmount: number;   // Soma das formas de pagamento
  manualProductsAmount?: number; // Valor avulso direto
  totalAmount: number;           // Valor consolidado registrado
  differenceAmount: number;      // totalPaymentsAmount - totalProductsAmount
  status: 'Pendente' | 'Aprovado' | 'Rejeitado';
  collaboratorNotes?: string;    // Observações do colaborador
  auditNotes?: string;           // Parecer da auditoria/administrador
  auditedBy?: string;            // Nome do auditor responsável
  auditedAt?: string;            // ISO 8601 Timestamp
  createdAt: string;             // ISO 8601 Timestamp
  updatedAt: string;             // ISO 8601 Timestamp
}
```

---

## 6. CASOS DE TESTE PARA FERRAMENTAS AUTOMATIZADAS (TEST SUITES)

As ferramentas de teste automatizado (ex: Playwright, Cypress, OWASP ZAP, Postman) devem executar os seguintes cenários:

### Suíte 1: Testes de Segurança & Resiliência (Security & Pentest)
- **SEC-01 (Lockout Força Bruta):**
  - **Ação:** Submeter 3 requisições de login consecutivas com e-mail válido `admin@protecbag.com.br` e senha incorreta `senha_errada`.
  - **Resultado Esperado:** Na 3ª tentativa, a chave `protecbag_sec_lockout_admin@protecbag.com.br` é gravada no `localStorage` com `lockedUntil = now + 120000`. O botão de login e os inputs ficam desabilitados. Um contador de 2 minutos é renderizado.
- **SEC-02 (Persistência do Bloqueio):**
  - **Ação:** Estando em estado bloqueado (SEC-01), recarregar o navegador ou enviar nova tentativa via script com menos de 120 segundos.
  - **Resultado Esperado:** O sistema recusa o processamento e mantém a mensagem de bloqueio ativa com o tempo remanescente.
- **SEC-03 (Desbloqueio Administrativo):**
  - **Ação:** Logar como Administrador Geral, navegar até "Gestão de Colaboradores" e clicar no botão "Desbloquear" do usuário bloqueado.
  - **Resultado Esperado:** O registro de lockout é expurgado e o usuário volta a poder realizar login imediatamente.
- **SEC-04 (Autenticação com Token ID Direto):**
  - **Ação:** Acessar a aba "Token ID / Chave" e informar `PB-TOK-ADM-001`.
  - **Resultado Esperado:** O sistema autentica diretamente como Carlos Eduardo Mendes (Admin Geral) sem exigir senha adicional.
- **SEC-05 (Prevenção de Fuga de Credenciais em Sessão):**
  - **Ação:** Inspecionar a chave `localStorage.getItem('protecbag_auth_current_user_v6')` após autenticação.
  - **Resultado Esperado:** Os campos `password`, `passwordHash` e `passwordSalt` devem ser rigorosamente `undefined` ou ausentes do objeto JSON.
- **SEC-06 (Isolamento de Franquia / Anti-IDOR para Colaborador):**
  - **Ação:** Logar com colaborador de `CWB01` (`marcos.cwb@protecbag.com.br`). Tentar alterar o campo de franquia no formulário de fechamento ou submeter lançamento para `REC01`.
  - **Resultado Esperado:** O campo de franquia deve estar travado em `CWB01` e desabilitado para edição. O sistema deve validar e gravar somente na franquia do usuário.

### Suíte 2: Testes Funcionais & Regras Financeiras (Functional & QA)
- **QA-01 (Invariante Financeira Balanceada):**
  - **Ação:** Lançar 2 unidades de `Aerobag M/G` (R$ 199,00 x 2 = R$ 398,00). Informar PIX = R$ 398,00.
  - **Resultado Esperado:** `Diferença = R$ 0,00`. Status do faturamento = "Pendente". Badge indicando caixa correto.
- **QA-02 (Alerta de Inconsistência de Caixa):**
  - **Ação:** Lançar 1 unidade de `Aerobag M/G` (R$ 199,00). Informar PIX = R$ 150,00 e Dinheiro = R$ 0,00 (Total Pagamentos = R$ 150,00).
  - **Resultado Esperado:** `Diferença = -R$ 49,00`. No painel do Administrador, o item deve exibir um alerta visual destacado em vermelho indicando quebra de caixa de R$ 49,00.
- **QA-03 (Consolidação de 600 un Aerobag em Setembro):**
  - **Ação:** Acessar o Painel do Administrador, aplicar filtro de Mês = `Setembro/2026`.
  - **Resultado Esperado:** O resumo gerencial e o relatório em PDF devem contabilizar exatamente **600 unidades vendidas de Aerobag M/G (R$ 199,00)** entre os lançamentos consolidados do mês.
- **QA-04 (Restrição de Administrador Regional):**
  - **Ação:** Logar como Administrador Regional de CWB (`admin.cwb@protecbag.com.br`).
  - **Resultado Esperado:** O seletor de franquias e a listagem de auditoria só podem conter faturamentos das bases `CWB01`, `CWB02` e `CWB03`. Lançamentos de `REC01`, `REC02` e `REC03` não devem aparecer ou estar acessíveis para auditoria.
- **QA-05 (Exportação de Relatório PDF):**
  - **Ação:** Clicar no botão "Exportar Relatório PDF" no painel administrativo, selecionar modo Mensal ou Semanal.
  - **Resultado Esperado:** O componente `ReportPdfModal` gera o documento PDF contendo cabeçalho institucional ProtecBag, tabela de faturamento por método de pagamento, contagem discriminada de embalagens e hash de conformidade.
- **QA-06 (CRUD e Exclusão Segura no Firestore):**
  - **Ação:** No painel de colaboradores, criar novo operador e em seguida excluí-lo pelo botão da lixeira no modal de confirmação.
  - **Resultado Esperado:** O documento é deletado tanto no estado do React quanto na coleção `users` do Firestore via `deleteDoc(doc(db, 'users', userId))`.

---

## 7. CRITÉRIOS DE ACEITAÇÃO DE SEGURANÇA & QUALIDADE (SECURITY CHECKLIST)

| Critério | Status Requerido | Verificação |
| :--- | :--- | :--- |
| **Sanitização de LocalStorage** | Aprovado | Nenhuma credencial em texto puro no browser storage. |
| **Proteção contra Brute Force** | Aprovado | 3 erros bloqueiam a conta/token por 2 minutos. |
| **Resistência a Recarregamento** | Aprovado | Timer persiste no storage com expiração real via timestamp. |
| **Validação de Divergência** | Aprovado | Alerta automático quando `TotalProdutos !== TotalPagamentos`. |
| **Controle de Franquia (RBAC)** | Aprovado | Colaborador só lança na sua franquia; Admin regional só vê sua base. |
| **Auditoria e Logs** | Aprovado | Gravação de `auditedBy`, `auditedAt` e `auditNotes` no Firestore. |
| **Disponibilidade Offline** | Aprovado | Se Firestore estiver indisponível, opera com cache local resiliente. |

---

*Fim do Documento PRD — ProtecBag Sistemas*
