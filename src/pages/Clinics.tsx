import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth';
import { Modal } from '../components/Modal';
import { supabase } from '../supabase';
import type { Clinic } from '../types';
import { daysBetween, fmtDate, fmtMoney, todayISO } from '../utils';

/** Área do Admin Master: consultórios, mensalidade e bloqueio. */
export function Clinics() {
  const { clinics, reload, setClinicId, clinic: current } = useAuth();
  const [edit, setEdit] = useState<Partial<Clinic> | null>(null);
  const [counts, setCounts] = useState<Record<string, { users: number; patients: number }>>({});

  useEffect(() => {
    Promise.all([supabase.from('profiles').select('clinic_id'), supabase.from('patients').select('clinic_id')]).then(([u, p]) => {
      const c: Record<string, { users: number; patients: number }> = {};
      const g = (id: string) => (c[id] ??= { users: 0, patients: 0 });
      u.data?.forEach((r) => r.clinic_id && g(r.clinic_id).users++);
      p.data?.forEach((r) => g(r.clinic_id).patients++);
      setCounts(c);
    });
  }, [clinics]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    const row = {
      nome: edit.nome,
      ativo: edit.ativo ?? true,
      plano: edit.plano || 'padrao',
      mensalidade: edit.mensalidade ?? null,
      vencimento: edit.vencimento || null,
    };
    const { error } = edit.id ? await supabase.from('clinics').update(row).eq('id', edit.id) : await supabase.from('clinics').insert(row);
    if (error) return alert(error.message);
    setEdit(null);
    reload();
  };

  const today = todayISO();
  const total = clinics.filter((c) => c.ativo).reduce((s, c) => s + (c.mensalidade ?? 0), 0);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Consultórios</h1>
          <p className="sub">Receita mensal dos consultórios ativos: <b>{fmtMoney(total) || 'R$ 0,00'}</b></p>
        </div>
        <button className="btn primary" onClick={() => setEdit({ ativo: true })}>Novo consultório</button>
      </header>

      <div className="panel table-wrap">
        <table className="table">
          <thead>
            <tr><th>Consultório</th><th>Situação</th><th>Mensalidade</th><th>Vencimento</th><th className="hide-sm">Usuários</th><th className="hide-sm">Pacientes</th><th></th></tr>
          </thead>
          <tbody>
            {clinics.map((c) => {
              const late = c.vencimento && c.vencimento < today;
              const soon = c.vencimento && !late && daysBetween(today, c.vencimento) <= 5;
              return (
                <tr key={c.id} onClick={() => setEdit(c)}>
                  <td><b>{c.nome}</b>{current?.id === c.id && <span className="tag gold">Aberto</span>}</td>
                  <td>{c.ativo ? <span className="status ativo">Ativo</span> : <span className="status bloqueado">Bloqueado</span>}</td>
                  <td>{fmtMoney(c.mensalidade) || '—'}</td>
                  <td className={late ? 'late' : soon ? 'warn-text' : ''}>{c.vencimento ? fmtDate(c.vencimento) : '—'}{late && ' (vencido)'}</td>
                  <td className="hide-sm">{counts[c.id]?.users ?? 0}</td>
                  <td className="hide-sm">{counts[c.id]?.patients ?? 0}</td>
                  <td>
                    <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); setClinicId(c.id); }}>Abrir</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {edit && (
        <Modal title={edit.id ? 'Editar consultório' : 'Novo consultório'} onClose={() => setEdit(null)}>
          <form className="form-grid" onSubmit={save}>
            <label className="field full"><span>Nome *</span><input required value={edit.nome ?? ''} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} /></label>
            <label className="field">
              <span>Mensalidade (R$)</span>
              <input type="number" min="0" step="0.01" value={edit.mensalidade ?? ''} onChange={(e) => setEdit({ ...edit, mensalidade: e.target.value === '' ? undefined : Number(e.target.value) })} />
            </label>
            <label className="field"><span>Próximo vencimento</span><input type="date" value={edit.vencimento ?? ''} onChange={(e) => setEdit({ ...edit, vencimento: e.target.value })} /></label>
            <label className="field full check">
              <input type="checkbox" checked={edit.ativo ?? true} onChange={(e) => setEdit({ ...edit, ativo: e.target.checked })} />
              <span>Ativo (desmarque para bloquear o acesso de todos os usuários deste consultório)</span>
            </label>
            <div className="form-actions">
              <span className="spacer" />
              <button type="button" className="btn ghost" onClick={() => setEdit(null)}>Cancelar</button>
              <button className="btn primary">Salvar</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
