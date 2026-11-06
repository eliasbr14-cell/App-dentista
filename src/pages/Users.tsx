import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ROLE_LABEL, useAuth } from '../auth';
import { useStore } from '../db';
import { Modal } from '../components/Modal';
import { callUsersFn, fromRow, supabase } from '../supabase';
import type { Profile, Role } from '../types';

const ROLE_HELP: Record<Role, string> = {
  master: 'Acesso total ao sistema e a todos os consultórios.',
  admin: 'Tudo do consultório + cadastrar usuários e configurações.',
  dentista: 'Pacientes, odontograma, procedimentos, exames e agenda.',
  recepcao: 'Agenda, cadastro de pacientes e WhatsApp. Não vê a parte clínica.',
};

const randomPass = () => {
  const c = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const a = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(a, (n) => c[n % c.length]).join('');
};

interface Audit {
  id: number;
  userId?: string;
  acao: string;
  tabela: string;
  registroId?: string;
  em: string;
}

const TABELA: Record<string, string> = { patients: 'paciente', procedures: 'procedimento', exams: 'exame', appointments: 'consulta' };
const ACAO: Record<string, string> = { insert: 'cadastrou', update: 'alterou', delete: 'excluiu' };

export function Users() {
  const { profile: me, clinic, clinics, can } = useAuth();
  const { db } = useStore();
  const [users, setUsers] = useState<Profile[]>([]);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<'users' | 'log'>('users');
  const [log, setLog] = useState<Audit[]>([]);

  const load = useCallback(async () => {
    let q = supabase.from('profiles').select('*').order('nome');
    q = can.master ? q.or(`clinic_id.eq.${clinic?.id},role.eq.master`) : q.eq('clinic_id', clinic?.id ?? '');
    const { data, error } = await q;
    if (error) return alert(error.message);
    setUsers((data ?? []).map((r) => fromRow<Profile>(r)));
  }, [can.master, clinic?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab !== 'log' || !clinic) return;
    supabase
      .from('audit_log')
      .select('*')
      .eq('clinic_id', clinic.id)
      .order('em', { ascending: false })
      .limit(300)
      .then(({ data }) => setLog((data ?? []).map((r) => fromRow<Audit>(r))));
  }, [tab, clinic]);

  const act = async (body: Record<string, unknown>) => {
    try {
      await callUsersFn(body);
      await load();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const who = (id?: string) => users.find((u) => u.id === id)?.nome ?? '—';
  const what = (a: Audit) => {
    const id = a.registroId;
    const pat =
      db.patients.find((p) => p.id === id) ??
      db.patients.find((p) => p.id === (db.procedures.find((x) => x.id === id) ?? db.exams.find((x) => x.id === id) ?? db.appointments.find((x) => x.id === id))?.patientId);
    return `${ACAO[a.acao] ?? a.acao} ${TABELA[a.tabela] ?? a.tabela}${pat ? ` — ${pat.nome}` : ''}`;
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Usuários</h1>
          <p className="muted">{clinic?.nome}</p>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}>+ Novo usuário</button>
      </header>

      <section className="card">
        <div className="tabs">
          <button className={tab === 'users' ? 'on' : ''} onClick={() => setTab('users')}>Equipe ({users.length})</button>
          <button className={tab === 'log' ? 'on' : ''} onClick={() => setTab('log')}>Registro de atividades</button>
        </div>

        {tab === 'users' && (
          <table className="table">
            <thead>
              <tr><th>Nome</th><th className="hide-sm">E-mail</th><th>Perfil</th><th>Situação</th><th></th></tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const self = u.id === me?.id;
                const locked = self || u.role === 'master';
                return (
                  <tr key={u.id} className={u.ativo ? '' : 'inactive'}>
                    <td>
                      <b>{u.nome}</b>{self && <span className="badge">você</span>}
                      {u.cro && <div className="small muted">CRO {u.cro}</div>}
                    </td>
                    <td className="hide-sm">{u.email}</td>
                    <td>
                      {locked ? (
                        <span className="badge role">{ROLE_LABEL[u.role]}</span>
                      ) : (
                        <select className="inline-select" value={u.role} onChange={(e) => act({ action: 'update', id: u.id, role: e.target.value })}>
                          {(['admin', 'dentista', 'recepcao'] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                        </select>
                      )}
                    </td>
                    <td>{u.ativo ? <span className="badge confirmada">Ativo</span> : <span className="badge cancelada">Desativado</span>}</td>
                    <td className="actions">
                      {!self && (u.role !== 'master' || can.master) && (
                        <>
                          <button
                            className="btn ghost sm"
                            onClick={() => {
                              const p = prompt(`Nova senha para ${u.nome} (mínimo 8 caracteres):`, randomPass());
                              if (p) act({ action: 'reset_password', id: u.id, password: p }).then(() => alert(`Senha de ${u.nome} alterada para: ${p}`));
                            }}
                          >
                            Redefinir senha
                          </button>
                          {u.role !== 'master' && (
                            <button
                              className={`btn ghost sm ${u.ativo ? 'danger' : ''}`}
                              onClick={() => confirm(`${u.ativo ? 'Desativar' : 'Reativar'} ${u.nome}?`) && act({ action: 'update', id: u.id, ativo: !u.ativo })}
                            >
                              {u.ativo ? 'Desativar' : 'Reativar'}
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {tab === 'log' && (
          <ul className="list">
            {log.map((a) => (
              <li key={a.id}>
                <span className="small muted log-time">{new Date(a.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                <div className="grow"><b>{who(a.userId)}</b> {what(a)}</div>
              </li>
            ))}
            {log.length === 0 && <p className="muted">Nenhuma atividade registrada ainda.</p>}
          </ul>
        )}
      </section>

      {creating && (
        <Modal title="Novo usuário" onClose={() => setCreating(false)}>
          <NewUserForm
            isMaster={can.master}
            clinics={clinics.map((c) => ({ id: c.id, nome: c.nome }))}
            defaultClinic={clinic?.id}
            onDone={(ok) => {
              setCreating(false);
              if (ok) load();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function NewUserForm({
  isMaster,
  clinics,
  defaultClinic,
  onDone,
}: {
  isMaster: boolean;
  clinics: { id: string; nome: string }[];
  defaultClinic?: string;
  onDone: (ok: boolean) => void;
}) {
  const [f, setF] = useState({ nome: '', email: '', password: randomPass(), role: 'dentista' as Role, cro: '', clinic_id: defaultClinic ?? '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const roles: Role[] = isMaster ? ['admin', 'dentista', 'recepcao', 'master'] : ['admin', 'dentista', 'recepcao'];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await callUsersFn({ action: 'create', ...f });
      setDone(true);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    const text = `Acesso ao sistema ${clinics.find((c) => c.id === f.clinic_id)?.nome ?? ''}\nLink: ${window.location.origin}${window.location.pathname}\nE-mail: ${f.email}\nSenha: ${f.password}\n(troque a senha em "Minha conta" depois de entrar)`;
    return (
      <div>
        <p className="ok">✓ Usuário criado!</p>
        <p className="small muted">Envie os dados de acesso para {f.nome}:</p>
        <pre className="credentials">{text}</pre>
        <div className="form-actions">
          <button className="btn ghost" onClick={() => navigator.clipboard?.writeText(text)}>Copiar</button>
          <span className="spacer" />
          <button className="btn primary" onClick={() => onDone(true)}>Concluir</button>
        </div>
      </div>
    );
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <label className="field full"><span>Nome *</span><input required autoFocus value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></label>
      <label className="field"><span>E-mail (login) *</span><input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
      <label className="field"><span>Senha inicial *</span><input required minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
      <label className="field">
        <span>Perfil *</span>
        <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
          {roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      </label>
      {(f.role === 'dentista' || f.role === 'admin') && (
        <label className="field"><span>CRO</span><input value={f.cro} onChange={(e) => setF({ ...f, cro: e.target.value })} /></label>
      )}
      {isMaster && f.role !== 'master' && (
        <label className="field">
          <span>Consultório *</span>
          <select required value={f.clinic_id} onChange={(e) => setF({ ...f, clinic_id: e.target.value })}>
            {clinics.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
      )}
      <p className="small muted full">{ROLE_HELP[f.role]}</p>
      {err && <p className="err full">{err}</p>}
      <div className="form-actions">
        <span className="spacer" />
        <button type="button" className="btn ghost" onClick={() => onDone(false)}>Cancelar</button>
        <button className="btn primary" disabled={busy}>{busy ? 'Criando…' : 'Criar usuário'}</button>
      </div>
    </form>
  );
}
