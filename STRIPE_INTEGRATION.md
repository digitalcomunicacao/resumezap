# 🔐 Integração Stripe - Resume Zap

## 📋 Visão Geral

Este documento descreve a integração completa do Stripe para gerenciamento de assinaturas no Resume Zap.

## 🎯 Planos Disponíveis

| Plano | Preço | Grupos | Product ID | Price ID |
|-------|-------|--------|-----------|----------|
| Free | R$ 0 | 1 | - | - |
| Básico | R$ 29/mês | 5 | `prod_TJKjQFeYkduCi3` | `price_1SMi3vISNZSgfXWpjUn9L61g` |
| Pro | R$ 49/mês | 10 | `prod_TJKjqTGj6zixKB` | `price_1SMi44ISNZSgfXWphBJLPYSt` |
| Premium | R$ 97/mês | 20 | `prod_TJKjwMx7K1HN1D` | `price_1SMi4CISNZSgfXWpMhKTeAXh` |

## 🛠️ Estrutura Técnica

### Edge Functions

#### 1. `check-subscription`
**Propósito**: Verificar status da assinatura do usuário.

**Fluxo**:
1. Autentica usuário via JWT
2. Busca customer no Stripe pelo email
3. Verifica assinaturas ativas
4. Atualiza tabela `profiles` com dados da assinatura
5. Retorna: `subscribed`, `product_id`, `subscription_end`, `subscription_plan`

**Chamada Automática**:
- No login
- A cada 60 segundos (auto-refresh)
- Após mudanças de autenticação

#### 2. `create-checkout`
**Propósito**: Criar sessão de checkout Stripe.

**Entrada**: `{ price_id: string }`

**Fluxo**:
1. Autentica usuário
2. Busca/cria customer no Stripe
3. Cria sessão de checkout com `mode: "subscription"`
4. Retorna URL para redirecionamento

**URLs de Retorno**:
- Sucesso: `/success?session_id={CHECKOUT_SESSION_ID}`
- Cancelamento: `/dashboard`

#### 3. `customer-portal`
**Propósito**: Abrir portal de gerenciamento Stripe.

**Fluxo**:
1. Autentica usuário
2. Busca customer no Stripe
3. Cria sessão do Customer Portal
4. Retorna URL do portal

**Funcionalidades do Portal**:
- Alterar plano
- Cancelar assinatura
- Atualizar forma de pagamento
- Ver histórico de faturas

#### 4. `trigger-summaries`
**Propósito**: Gerar resumos sob demanda.

**Fluxo**:
1. Autentica usuário
2. Chama `generate-summaries` function
3. Retorna confirmação

### Database Schema

**Tabela `profiles`** (novos campos):
```sql
- stripe_customer_id: TEXT
- stripe_subscription_id: TEXT
- stripe_product_id: TEXT
- subscription_status: TEXT (default: 'inactive')
- subscription_end_date: TIMESTAMP WITH TIME ZONE
- subscription_plan: TEXT (default: 'free')
```

### Frontend Components

#### 1. `SubscriptionContext`
**Localização**: `src/contexts/SubscriptionContext.tsx`

**Estado Global**:
```typescript
{
  subscriptionPlan: 'free' | 'basic' | 'pro' | 'premium',
  subscriptionEnd: string | null,
  isSubscribed: boolean,
  loading: boolean,
  groupsLimit: number,
  checkSubscription: () => Promise<void>,
  createCheckout: (planKey) => Promise<void>,
  openCustomerPortal: () => Promise<void>
}
```

**Constante `STRIPE_PLANS`**:
```typescript
{
  free: { name, price_id, product_id, groups_limit, price },
  basic: { ... },
  pro: { ... },
  premium: { ... }
}
```

#### 2. `Pricing` Component
**Localização**: `src/components/Pricing.tsx`

**Funcionalidades**:
- Exibe todos os planos
- Destaca plano atual com badge "Seu Plano"
- Botões conectados ao `createCheckout`
- Redireciona para `/auth` se não logado

#### 3. `Dashboard` Updates
**Localização**: `src/pages/Dashboard.tsx`

**Novos Cards**:
- **Plano Atual**: Mostra plano, limite de grupos, data de renovação
- **Botão "Gerenciar Assinatura"**: Abre Customer Portal
- **Botão "Fazer Upgrade"**: Redireciona para pricing

**Novo Botão**:
- **"Gerar Resumos Agora"**: Aciona `trigger-summaries`

#### 4. `GroupsListModal` Updates
**Localização**: `src/components/GroupsListModal.tsx`

**Validação de Limites**:
- Bloqueia seleção acima do limite do plano
- Exibe `UpgradeModal` ao atingir limite
- Usa `groupsLimit` do contexto

#### 5. `UpgradeModal` Component
**Localização**: `src/components/UpgradeModal.tsx`

**Propósito**: Modal exibido ao atingir limite de grupos.

**Ações**:
- Botão "Ver Planos": redireciona para `/#pricing`
- Botão "Cancelar": fecha modal

#### 6. `Success` Page
**Localização**: `src/pages/Success.tsx`

**Funcionalidades**:
- Confirma assinatura bem-sucedida
- Auto-refresh do status (2s delay)
- Redireciona para Dashboard

## 🔄 Fluxo de Assinatura

### Novo Usuário
1. Usuário navega para pricing
2. Clica em "Assinar Agora"
3. Redireciona para `/auth` se não logado
4. Após login, clica novamente
5. Abre Stripe Checkout em nova aba
6. Completa pagamento
7. Redireciona para `/success`
8. Auto-refresh verifica assinatura
9. Navega para `/dashboard`

### Upgrade de Plano
1. Usuário clica "Fazer Upgrade" no Dashboard
2. Rola para section `#pricing`
3. Seleciona novo plano
4. Abre Stripe Checkout
5. Completa pagamento
6. Sistema atualiza automaticamente

### Gerenciamento
1. Usuário clica "Gerenciar Assinatura"
2. Abre Stripe Customer Portal
3. Pode alterar plano, forma de pagamento, ou cancelar
4. Ao retornar, auto-refresh atualiza status

## 🔒 Segurança

### Edge Functions JWT
Todas as functions (exceto públicas) requerem JWT:
```toml
[functions.check-subscription]
verify_jwt = true

[functions.create-checkout]
verify_jwt = true

[functions.customer-portal]
verify_jwt = true

[functions.trigger-summaries]
verify_jwt = true
```

### Secrets
- `STRIPE_SECRET_KEY`: Armazenado em Lovable Secrets
- Nunca exposto no frontend
- Usado apenas em Edge Functions

### RLS Policies
Tabela `profiles`:
- SELECT: Usuário vê apenas próprio perfil
- UPDATE: Usuário atualiza apenas próprio perfil

## 📊 Validação de Limites

### Lógica de Grupos
```typescript
const PLAN_LIMITS = {
  free: 1,
  basic: 5,
  pro: 10,
  premium: 20,
};

// No GroupsListModal
if (!currentlySelected && limitReached) {
  setShowUpgradeModal(true);
  return;
}
```

### Verificação Periódica
- Auto-check a cada 60s
- Verifica em `onAuthStateChange`
- Atualiza após checkout

## 🎨 UX/UI Highlights

### Visual Indicators
- 👑 Crown icon para planos pagos
- 💳 CreditCard icon para plano free
- ⭐ Badge "Seu Plano" em card atual
- 📈 Progress bar de grupos selecionados

### Mensagens
- Toast success ao criar checkout
- Toast error em falhas
- Loading states em todos os botões
- Disabled states quando apropriado

## 🧪 Testing Checklist

- [ ] Login e auto-verificação de assinatura
- [ ] Criar checkout para cada plano
- [ ] Completar pagamento no Stripe
- [ ] Verificar atualização de perfil
- [ ] Testar Customer Portal
- [ ] Validar limites de grupos
- [ ] Testar upgrade/downgrade
- [ ] Verificar cancelamento
- [ ] Auto-refresh funcionando
- [ ] Redirecionamentos corretos

## 📝 Notas Importantes

1. **Customer Portal**: Requer configuração prévia no Stripe Dashboard
   - https://docs.stripe.com/customer-management/activate-no-code-customer-portal

2. **Webhooks**: Não implementados (validação via polling)
   - Se precisar de webhooks, adicionar endpoint separado

3. **Modo de Teste**: Usar Stripe Test Mode durante desenvolvimento
   - Cartão teste: `4242 4242 4242 4242`

4. **Cancelamento**: Assinatura continua até fim do período pago

5. **Proration**: Stripe calcula automaticamente ao fazer upgrade/downgrade

## 🔗 Links Úteis

- [Stripe Dashboard](https://dashboard.stripe.com)
- [Stripe API Docs](https://stripe.com/docs/api)
- [Customer Portal Setup](https://docs.stripe.com/customer-management/activate-no-code-customer-portal)
- [Test Cards](https://stripe.com/docs/testing)

---

**Última Atualização**: 2025-01-27  
**Versão**: 1.0.0
