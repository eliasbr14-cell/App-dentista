# 🦷 App Dentista — sistema do consultório

Sistema web para controle de pacientes de consultório odontológico.

## O que tem

- **Pacientes**: dados, telefone/WhatsApp, nascimento, alergias, observações. Busca por nome, telefone ou CPF.
- **Odontograma interativo**: arcada superior e inferior desenhadas na tela (numeração FDI: 11–48 adulto, 51–85 de leite).
  - Cada dente fica **colorido** conforme a situação: branco (sem registro), vermelho (a fazer/problema), laranja (em tratamento), azul (tratado), tracejado (extraído). Bolinha roxa = tem exame/raio-X.
  - **Passar o mouse** mostra um resumo do dente (último procedimento + miniatura do raio-X).
  - **Clicar** abre o painel com todo o histórico daquele dente, os exames com imagens (clique para ampliar) e botões para adicionar procedimento ou exame.
- **Procedimentos**: por dente (e faces M/D/O/V/L) ou gerais (limpeza, ortodontia…), com situação, valor e **data de retorno**.
- **Exames / raio-X**: envio de imagens (a foto é reduzida automaticamente), ligadas a um ou mais dentes.
- **Agenda** semanal com status (agendada, confirmada, concluída, faltou, cancelada).
- **Painel do dia**: consultas de hoje, lembretes dos próximos 2 dias, aniversariantes e retornos para agendar.
- **Mensagens por WhatsApp** com um clique (parabéns, lembrete de consulta, chamar para retorno). Os textos são editáveis em *Configurações* e o sistema marca o que já foi enviado.
- **Backup**: baixar/restaurar todos os dados em um arquivo `.json`.

## Rodar

```bash
npm install
npm run dev      # desenvolvimento
npm run build    # gera a pasta dist/ (site estático)
```

Pode ser publicado de graça na Vercel, Netlify ou GitHub Pages (é um site estático).

## Importante

- **Onde ficam os dados:** nesta versão, no navegador (IndexedDB) do computador onde o sistema é usado. Não sincroniza entre aparelhos — use *Configurações → Baixar backup* com frequência. São dados de saúde (LGPD): guarde o backup em local seguro.
- **Envio das mensagens:** o botão abre o WhatsApp (Web ou celular) já com a mensagem pronta; é só apertar enviar. Envio 100% automático, sem clicar, exige um servidor + API paga do WhatsApp (ex.: WhatsApp Business Cloud API, Z-API, Twilio) — ver próximos passos.

## Próximos passos possíveis

1. Banco de dados na nuvem (ex.: Supabase) com login, para acessar do celular e do consultório ao mesmo tempo.
2. Envio automático diário (aniversários às 9h, lembrete 24h antes) via função agendada + API do WhatsApp.
3. Financeiro (pagamentos, parcelas) e impressão de ficha/orçamento.
