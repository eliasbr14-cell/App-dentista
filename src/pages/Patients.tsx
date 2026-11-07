import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Plus, Search } from 'lucide-react';
import { useStore } from '../db';
import { Modal } from '../components/Modal';
import { PatientForm } from '../components/Forms';
import { initials } from '../components/ui';
import { age, fmtDate, fmtPhone, onlyDigits, todayISO } from '../utils';

export function Patients() {
  const { db } = useStore();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const creating = params.get('novo') === '1';
  const today = todayISO();

  const list = useMemo(() => {
    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const t = norm(q.trim());
    const digits = onlyDigits(q);
    return [...db.patients]
      .filter((p) => !t || norm(p.nome).includes(t) || (digits && (onlyDigits(p.telefone).includes(digits) || onlyDigits(p.cpf ?? '').includes(digits))))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [db.patients, q]);

  const lastVisit = (id: string) =>
    db.appointments.filter((a) => a.patientId === id && a.status === 'concluida').map((a) => a.dataHora).sort().pop() ??
    db.procedures.filter((p) => p.patientId === id && p.status === 'realizado').map((p) => p.data).sort().pop();
  const nextAppt = (id: string) =>
    db.appointments.filter((a) => a.patientId === id && a.dataHora.slice(0, 10) >= today && a.status !== 'cancelada').map((a) => a.dataHora).sort()[0];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Pacientes</h1>
          <p className="sub">{db.patients.length} cadastrados</p>
        </div>
        <button className="btn primary" onClick={() => setParams({ novo: '1' })}><Plus /> Novo paciente</button>
      </header>

      <section className="panel">
        <div className="panel-head">
          <div className="gsearch" style={{ width: '100%', maxWidth: 380 }}>
            <Search />
            <input placeholder="Filtrar por nome, telefone ou CPF" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filtrar pacientes" />
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Telefone</th>
                <th className="hide-sm right">Idade</th>
                <th className="hide-sm">Última visita</th>
                <th className="hide-sm">Próxima consulta</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const n = nextAppt(p.id);
                return (
                  <tr key={p.id} onClick={() => nav(`/pacientes/${p.id}`)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && nav(`/pacientes/${p.id}`)}>
                    <td>
                      <div className="person">
                        <span className="avatar-s">{initials(p.nome)}</span>
                        <div>
                          <b>{p.nome}</b>
                          {p.alergias && <span className="tag warn" title={p.alergias}><AlertTriangle /> Alergia</span>}
                        </div>
                      </div>
                    </td>
                    <td className="num">{fmtPhone(p.telefone) || '—'}</td>
                    <td className="hide-sm right num">{age(p.dataNascimento) ?? '—'}</td>
                    <td className="hide-sm num">{fmtDate(lastVisit(p.id))}</td>
                    <td className="hide-sm num">{n ? fmtDate(n) : <span className="muted">—</span>}</td>
                  </tr>
                );
              })}
              {list.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted center" style={{ padding: 32 }}>
                    {q ? 'Nenhum paciente corresponde a essa busca.' : 'Nenhum paciente cadastrado.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {creating && (
        <Modal title="Novo paciente" onClose={() => setParams({})}>
          <PatientForm onDone={(p) => (p ? nav(`/pacientes/${p.id}`) : setParams({}))} />
        </Modal>
      )}
    </div>
  );
}
