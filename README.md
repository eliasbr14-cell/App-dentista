# Imperium Odonto — sistema da clínica

Sistema web da **Imperium Odonto — Clínica Odontológica**: pacientes, odontograma interativo, exames/raio-X,
agenda e mensagens por WhatsApp, com login e perfis de acesso.

## Perfis de acesso

| Perfil | O que pode |
|---|---|
| **Admin Master** | Tudo, em todos os consultórios. Cria/bloqueia consultórios, mensalidade e vencimento. |
| **Administrador** | Tudo do consultório + cadastrar usuários, configurações e ver o registro de atividades. |
| **Dentista** | Pacientes, odontograma, procedimentos, exames e agenda. |
| **Recepção** | Agenda, cadastro de pacientes e WhatsApp. **Não vê** a parte clínica (odontograma, procedimentos, raio-X). |

As permissões são garantidas no **banco de dados** (Row Level Security do Supabase), não só na tela.

## Funcionalidades

- **Odontograma** (numeração FDI, adulto e de leite): dente colorido pela situação; passar o mouse mostra resumo e
  miniatura do raio-X; clicar abre histórico completo e exames.
- **Procedimentos** por dente/faces ou gerais, com valor e data de retorno.
- **Exames / raio-X**: imagens guardadas de forma privada no servidor (links temporários).
- **Agenda** semanal com status e dentista.
- **Painel**: consultas do dia, lembretes, aniversariantes e retornos.
- **WhatsApp** com mensagem pronta (parabéns, lembrete, retorno), textos editáveis.
- **Registro de atividades** (quem cadastrou/alterou/excluiu o quê) — LGPD.
- **Tempo real**: o que a recepção agenda aparece na tela do dentista na hora.
- Instalável no celular (ícone dourado "Imperium" na tela inicial).

## Estrutura

- `src/` — site (React + Vite + TypeScript)
- `supabase/migrations/001_schema.sql` — tabelas, permissões e regras de segurança
- `supabase/functions/gerenciar-usuarios/` — função de servidor que cria/gerencia usuários

## Rodar localmente

```bash
npm install
npm run dev
```

O site já aponta para o projeto Supabase `imperium-odonto` (as chaves no código são públicas por natureza;
a segurança fica nas regras do banco). Para usar outro projeto, defina `VITE_SUPABASE_URL` e
`VITE_SUPABASE_PUBLISHABLE_KEY`.

## Primeiro acesso

Na primeira vez que o site abre, aparece **Configuração inicial** para criar a conta **Admin Master**
(só funciona uma vez). Depois, em **Usuários**, o Master cria o Administrador da clínica.

## Ajustes recomendados no painel do Supabase

1. *Authentication → Sign In / Providers*: desligar **Allow new users to sign up** (os usuários são criados só pelo sistema).
2. *Authentication → URL Configuration*: colocar o endereço do site em **Site URL** (para o "esqueci minha senha").
3. Antes de usar com pacientes reais: plano pago (o gratuito pausa após 7 dias sem uso e não tem backup diário).
