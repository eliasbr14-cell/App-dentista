import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../db';
import { Modal } from '../components/Modal';
import { PatientForm } from '../components/Forms';
import { age, fmtDate, fmtPhone, onlyDigits } from '../utils';

export function Patients() {
  const { db } = useStore();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const creating = params.get('novo') === '1';

  const list = useMemo(() => {
    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const t = norm(q.trim());
    const digits = onlyDigits(q);
    return [...db.patients]
      .filter((p) => !t || norm(p.nome).includes(t) || (digits && (onlyDigits(p.telefone).includes(digits) || onlyDigits(p.cpf ?? '').includes(digits))))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [db.patients, q]);

  const lastVisit = (id: string) =>
    db.procedures.filter((p) => p.patientId === id && p.status === 'realizado').map((p) => p.data).sort().pop();
  const nextAppt = (id: string) =>
    db.appointments
      .filter((a) => a.patientId === id && a.dataHora >= new Date().toISOString().slice(0, 10) && a.status !== 'cancelada')
      .map((a) => a.dataHora)
      .sort()[0];

  return (
    <div className="page">
      <header className="page-head">
        <h1>Pacientes</h1>
        <button className="btn primary" onClick={() => setParams({ novo: '1' })}>+ Novo paciente</button>
      </header>

      <input className="search" placeholder="🔍 Buscar por nome, telefone ou CPF…" value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="card no-pad">
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Telefone</th>
              <th className="hide-sm">Idade</th>
              <th className="hide-sm">Último atendimento</th>
              <th className="hide-sm">Próxima consulta</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const n = nextAppt(p.id);
              return (
                <tr key={p.id} onClick={() => nav(`/pacientes/${p.id}`)}>
                  <td>
                    <Link to={`/pacientes/${p.id}`} onClick={(e) => e.stopPropagation()}><b>{p.nome}</b></Link>
                    {p.alergias && <span className="badge warn" title={p.alergias}>⚠ alergia</span>}
                  </td>
                  <td>{fmtPhone(p.telefone)}</td>
                  <td className="hide-sm">{age(p.dataNascimento) ?? '—'}</td>
                  <td className="hide-sm">{fmtDate(lastVisit(p.id))}</td>
                  <td className="hide-sm">{n ? fmtDate(n) : '—'}</td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={5} className="muted center">Nenhum paciente encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {creating && (
        <Modal title="Novo paciente" onClose={() => setParams({})}>
          <PatientForm onDone={(p) => (p ? nav(`/pacientes/${p.id}`) : setParams({}))} />
        </Modal>
      )}
    </div>
  );
}
