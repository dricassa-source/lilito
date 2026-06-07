# CORREÇÃO GLOBAL 02 — UX e Gestão

Apenas mudanças de UX/layout/apresentação. Sem migrations, sem mudar regras de negócio, permissões, cálculos ou integrações.

## 1. Meu Dia (`src/routes/_authenticated/index.tsx`)
- **Mini Agenda Semanal**: substitui a lista "Próximos 7 Dias" por grade SEG–DOM com chips coloridos por etapa (paleta oficial). Click no chip abre o compromisso; botão "Abrir Calendário Completo" navega para `/calendario`.
- **Aniversariantes**: remover "Em breve". Se houver hoje → `🎂 Nome — Hoje`. Senão → próximo aniversariante (nome, data, dias restantes). Usa dados de `clientes`/`prospects` já carregados.
- **Follow-ups**: deduplicar por prospect_id, recalcular atraso usando `vencimento`. Adicionar indicadores estratégicos: Onboardings Pendentes, Fechamentos Agendados, Prospects Parados (>7d na etapa) — reaproveitando queries existentes.

## 2. Dashboard (`src/routes/_authenticated/dashboard.tsx`)
- **Hero cards** maiores e em destaque: PA Fechado, Capital Segurado, Clientes Emitidos, Comissão Projetada.
- **Pipeline** vira o bloco visual principal: Originação → HOT → AB → Fechamento → Onboarding → Cliente, com qtd + PA por etapa, cores da paleta oficial.
- **Conversão**, **Qualidade**, **Auditoria** colapsadas em `<Collapsible>` (recolhidas por padrão).
- **Paleta oficial** aplicada via tokens existentes:
  - HOT = laranja, AB = amarelo, Revisita = azul, Fechamento = verde, Onboarding = verde claro, Cliente = dourado, Delay = vermelho.

## 3. Resultado Semanal (`src/routes/_authenticated/resultado-semanal.tsx`)
- Reorganizar Stats em dois blocos: **Produção da Semana** e **Próxima Semana** com os ícones/labels solicitados.
- Remover destaque a Revisitas.
- Manter alertas atuais (já cobrem as 4 regras). Filtro Unidade/Consultor já vem do `ConsultorFilter`.

## 4. Em Delay (`src/routes/_authenticated/em-delay.tsx`)
- Trocar `<Table>` por grid de cards mobile-first. Cada card: Nome + ScoreStars, Etapa (chip colorido), Motivo, Consultor, Dias parado. Botões grandes: Reagendar, Adiar 7d, Ligar, WhatsApp, Destravar, Perdido. Mantém handlers existentes.

## 5. Calendário (`src/routes/_authenticated/calendario.tsx`)
- Remover círculo vermelho grande e badge vermelho dos eventos delayed.
- Manter borda vermelha fina + 🚩 pequena no canto superior esquerdo.
- Ao `delay_resolvido=true`, esconder a bandeira (já é o comportamento; só limpar UI duplicada).

## 6. HOT (`src/routes/_authenticated/hot.tsx`)
- Adicionar topo de página com 3 blocos novos (apenas leitura — agregando dados já consultados):
  1. **Sessão HOT da Semana**: Ligações, ABs geradas, Conversão HOT→AB, Retornos, Não Atendeu, Sem Interesse.
  2. **Ranking HOT por consultor** (Master): Ligações, ABs, Conversão, Tempo Médio com semáforo 🟢/🟡/🔴.
  3. **Funil HOT → Cliente**: Recomendação → HOT → AB → Fechamento → Onboarding → Cliente.
- Lista operacional atual permanece abaixo.

## 7. Tempo na Etapa (`src/components/lilito/ScoreStars.tsx` adjacente — helper)
- Auditar usos de `tempoEtapaDot`/cálculo de dias na etapa em `recomendacoes.tsx`, `funil.tsx`, `em-delay.tsx`, `hot.tsx`. Trocar referências de `created_at` por `entrou_etapa_em` (já existe no schema). Semáforo: 🟢 0–3d / 🟡 4–7d / 🔴 8+d.
- Centralizar helper `diasNaEtapa(prospect)` + `etapaDot(dias)` em `src/lib/utils.ts` ou novo `src/lib/tempo-etapa.ts` para reuso.

## Fora de escopo
- Migrations, novos campos de banco, mudanças de RLS.
- Renomear rotas ou criar novos módulos.
- Mexer em sidebar, auth, ou lógica de scope (já implementada na CG-01).

## Validação
Após implementar, abrir preview em mobile (375px) e desktop para verificar a mini-agenda, os cards de Em Delay e o pipeline do Dashboard.
