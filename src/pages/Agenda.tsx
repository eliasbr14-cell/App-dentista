import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStore } from '../db';
import { Modal } from '../components/Modal';
import { APPT_LABEL, AppointmentForm } from '../components/Forms';
import { WhatsButton } from '../components/WhatsButton';
import type { Appointment, AppointmentStatus } from '../types';
import { fillTemplate, fmtTime, todayISO } from '../utils';

const startOfWeek = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // segunda-feira
  return x;
};

export function Agenda() {
  const { db, upsert } = useStore();
  const [params, setParams] = useSearchParams();
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const [edit, setEdit] = useState<{ item?: Appointment; dataHora?: string } | null>(params.get('nova') ? {} : null);
  const today = todayISO();

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(week);
    d.setDate(d.getDate() + i);
    return d;
  });
  const shift = (n: number) => {
    const d = new Date(week);
    d.setDate(d.getDate() + n * 7);
    setWeek(d);
  };
  const close = () => {
    setEdit(null);
    if (params.get('nova')) setParams({});
  };

  const pat = (id: string) => db.patients.find((p) => p.id === id);
  const dentistas = db.profiles.filter((p) => p.role === 'admin' || p.role === 'dentista');
  const dentName = (id?: string) => (dentistas.length > 1 ? dentistas.find((d) => d.id === id)?.nome : undefined);
  const label = `${days[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${days[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`;

  return (
    <div className="page">
      <header className="page-head">
        <h1>Agenda</h1>
        <div className="row">
          <button className="btn ghost" onClick={() => shift(-1)} aria-label="Semana anterior">‹</button>
          <button className="btn ghost" onClick={() => setWeek(startOfWeek(new Date()))}>Hoje</button>
          <button className="btn ghost" onClick={() => shift(1)} aria-label="Próxima semana">›</button>
          <button className="btn primary" onClick={() => setEdit({})}>+ Nova consulta</button>
        </div>
      </header>
      <p className="muted cap">{label}</p>

      <div className="week">
        {days.map((d) => {
          const iso = todayISO(d);
          const list = db.appointments.filter((a) => a.dataHora.startsWith(iso)).sort((a, b) => a.dataHora.localeCompare(b.dataHora));
          return (
            <section key={iso} className={`day card ${iso === today ? 'today' : ''} ${iso < today ? 'past' : ''}`}>
              <header>
                <b className="cap">{d.toLocaleDateString('pt-BR', { weekday: 'short' })}</b>
                <span>{d.getDate()}</span>
                <button className="icon-btn sm" title="Agendar neste dia" onClick={() => setEdit({ dataHora: `${iso}T09:00` })}>＋</button>
              </header>
              {list.length === 0 && <p className="muted small">Livre</p>}
              {list.map((a) => {
                const p = pat(a.patientId);
                return (
                  <div key={a.id} className={`appt ${a.status}`} onClick={() => setEdit({ item: a })}>
                    <div className="appt-top">
                      <b>{fmtTime(a.dataHora)}</b>
                      <select
                        className={`badge ${a.status}`}
                        value={a.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => upsert('appointments', { ...a, status: e.target.value as AppointmentStatus })}
                      >
                        {(Object.keys(APPT_LABEL) as AppointmentStatus[]).map((s) => <option key={s} value={s}>{APPT_LABEL[s]}</option>)}
                      </select>
                    </div>
                    <Link to={`/pacientes/${a.patientId}`} onClick={(e) => e.stopPropagation()}>{p?.nome ?? '—'}</Link>
                    <div className="small muted">{a.motivo || 'Consulta'} · {a.duracaoMin}min</div>
                    {dentName(a.dentistaId) && <div className="small dent">👤 {dentName(a.dentistaId)}</div>}
                    {p && iso >= today && (a.status === 'agendada' || a.status === 'confirmada') && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <WhatsButton
                          sentKey={`lembrete:${a.id}:${a.dataHora}`}
                          telefone={p.telefone}
                          mensagem={fillTemplate(db.settings.templateLembrete, { patient: p, settings: db.settings, dataHora: a.dataHora, motivo: a.motivo })}
                          label="Lembrar"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>

      {edit && (
        <Modal title={edit.item ? 'Editar consulta' : 'Nova consulta'} onClose={close}>
          {db.patients.length === 0 ? (
            <p>Cadastre um paciente primeiro. <Link to="/pacientes?novo=1">Cadastrar</Link></p>
          ) : (
            <AppointmentForm initial={edit.item} dataHora={edit.dataHora} onDone={close} />
          )}
        </Modal>
      )}
    </div>
  );
}
