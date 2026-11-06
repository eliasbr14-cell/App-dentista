// Função de servidor: cria e gerencia usuários do sistema.
// Só ela usa a chave de serviço (nunca vai para o navegador).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const ROLES = ['master', 'admin', 'dentista', 'recepcao'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Requisição inválida' }, 400);
  }
  const str = (k: string) => (typeof body[k] === 'string' ? (body[k] as string).trim() : '');

  // ---------- Primeiro acesso: cria a conta Master (só se ainda não existir nenhuma) ----------
  if (body.action === 'bootstrap') {
    const { count, error: cErr } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'master');
    if (cErr) return json({ error: cErr.message }, 500);
    if (count) return json({ error: 'O sistema já foi configurado.' }, 403);
    const allowed = Deno.env.get('MASTER_EMAIL');
    const email = str('email').toLowerCase();
    if (allowed && allowed.toLowerCase() !== email) return json({ error: 'E-mail não autorizado para a conta Master.' }, 403);
    const nome = str('nome');
    const password = str('password');
    if (!nome || !email || password.length < 8) return json({ error: 'Preencha nome, e-mail e senha (mínimo 8 caracteres).' }, 400);
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nome } });
    if (error || !data.user) return json({ error: error?.message ?? 'Erro ao criar usuário' }, 400);
    const { error: pErr } = await admin.from('profiles').insert({ id: data.user.id, nome, email, role: 'master', clinic_id: null });
    if (pErr) {
      await admin.auth.admin.deleteUser(data.user.id);
      return json({ error: pErr.message }, 500);
    }
    return json({ ok: true });
  }

  // ---------- Demais ações: precisa estar logado como master ou admin ----------
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth?.user) return json({ error: 'Não autenticado' }, 401);

  const { data: me } = await admin.from('profiles').select('*, clinics(ativo)').eq('id', auth.user.id).maybeSingle();
  if (!me || !me.ativo) return json({ error: 'Sem permissão' }, 403);
  const isMaster = me.role === 'master';
  if (!isMaster && (me.role !== 'admin' || !me.clinics?.ativo)) return json({ error: 'Sem permissão' }, 403);
  const canManage = (clinicId: string | null) => isMaster || (clinicId != null && clinicId === me.clinic_id);

  if (body.action === 'create') {
    const nome = str('nome');
    const email = str('email').toLowerCase();
    const password = str('password');
    const role = str('role');
    const cro = str('cro') || null;
    if (!ROLES.includes(role)) return json({ error: 'Perfil inválido' }, 400);
    if (role === 'master' && !isMaster) return json({ error: 'Só o Master pode criar outro Master.' }, 403);
    const clinic_id = role === 'master' ? null : isMaster ? str('clinic_id') || null : me.clinic_id;
    if (role !== 'master' && !clinic_id) return json({ error: 'Escolha o consultório.' }, 400);
    if (!nome || !email || password.length < 8) return json({ error: 'Preencha nome, e-mail e senha (mínimo 8 caracteres).' }, 400);

    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nome } });
    if (error || !data.user) {
      const msg = error?.message?.includes('already') ? 'Já existe um usuário com este e-mail.' : error?.message;
      return json({ error: msg ?? 'Erro ao criar usuário' }, 400);
    }
    const { error: pErr } = await admin.from('profiles').insert({ id: data.user.id, nome, email, role, cro, clinic_id });
    if (pErr) {
      await admin.auth.admin.deleteUser(data.user.id);
      return json({ error: pErr.message }, 500);
    }
    return json({ ok: true, id: data.user.id });
  }

  // ações sobre um usuário existente
  const id = str('id');
  const { data: target } = await admin.from('profiles').select('*').eq('id', id).maybeSingle();
  if (!target) return json({ error: 'Usuário não encontrado' }, 404);
  if (!canManage(target.clinic_id) || (target.role === 'master' && !isMaster)) return json({ error: 'Sem permissão' }, 403);

  if (body.action === 'update') {
    const patch: Record<string, unknown> = {};
    if (typeof body.nome === 'string' && body.nome.trim()) patch.nome = body.nome.trim();
    if (typeof body.cro === 'string') patch.cro = body.cro.trim() || null;
    if (typeof body.role === 'string') {
      if (!ROLES.includes(body.role) || body.role === 'master' || target.role === 'master') return json({ error: 'Perfil inválido' }, 400);
      if (id === me.id) return json({ error: 'Você não pode mudar o seu próprio perfil.' }, 400);
      patch.role = body.role;
    }
    if (typeof body.ativo === 'boolean') {
      if (id === me.id) return json({ error: 'Você não pode desativar a si mesmo.' }, 400);
      patch.ativo = body.ativo;
      const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: body.ativo ? 'none' : '876000h' });
      if (error) return json({ error: error.message }, 500);
    }
    const { error } = await admin.from('profiles').update(patch).eq('id', id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  if (body.action === 'reset_password') {
    const password = str('password');
    if (password.length < 8) return json({ error: 'A senha precisa ter pelo menos 8 caracteres.' }, 400);
    const { error } = await admin.auth.admin.updateUserById(id, { password });
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  return json({ error: 'Ação desconhecida' }, 400);
});
