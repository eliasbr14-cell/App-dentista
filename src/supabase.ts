import { createClient } from '@supabase/supabase-js';

// Chaves públicas (podem ficar no site). A segurança é feita pelas regras (RLS) no banco.
const url = import.meta.env.VITE_SUPABASE_URL ?? 'https://bjphfsrbeaeoiecwjwgj.supabase.co';
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_NamyZuLj-Dv-O6gyVtqsww_wev_DEu_';

export const supabase = createClient(url, key, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const toSnake = (k: string) => k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
const toCamel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const DATE_KEYS = new Set(['data_nascimento', 'retorno', 'data', 'vencimento', 'data_hora']);

/** objeto do app (camelCase) -> linha do banco (snake_case) */
export function toRow(o: object): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    const sk = toSnake(k);
    r[sk] = v === undefined || (v === '' && DATE_KEYS.has(sk)) ? null : v;
  }
  return r;
}

/** linha do banco -> objeto do app */
export function fromRow<T>(r: Record<string, unknown>): T {
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) if (v !== null) o[toCamel(k)] = v;
  return o as T;
}

/** Busca todas as linhas (o banco entrega no máximo 1000 por vez). */
export async function fetchAll<T>(table: string, clinicId: string, order = 'criado_em'): Promise<T[]> {
  const out: T[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('clinic_id', clinicId)
      .order(order)
      .range(from, from + page - 1);
    if (error) throw error;
    out.push(...(data ?? []).map((r) => fromRow<T>(r)));
    if (!data || data.length < page) return out;
  }
}

export async function callUsersFn(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('gerenciar-usuarios', { body });
  if (error) {
    // tenta extrair a mensagem enviada pela função
    let msg = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) msg = (await ctx.json()).error ?? msg;
    } catch {
      /* ignora */
    }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
