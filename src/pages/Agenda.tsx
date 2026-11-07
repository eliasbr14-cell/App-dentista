import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
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
  const isThisWeek = startOfWeek(new Date()).getTime() === week.getTime();
  const sameMonth = days[0].getMonth() === days[6].getMonth();
  const label = sameMonth
    ? `${days[0].getDate()} a ${days[6].getDate()} de ${days[6].toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`
    : `${days[0].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} a ${days[6].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const weekCount = db.appointments.filter((a) => a.dataHora.slice(0, 10) >= todayISO(days[0]) && a.dataHora.slice(0, 10) <= todayISO(days[6]) && a.status !== 'cancelada').length;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Agenda</h1>
          <p className="sub">{weekCount} {weekCount === 1 ? 'consulta' : 'consultas'} nesta semana</p>
        </div>
        <div className="row">
          <div className="week-nav">
            <button className="btn ghost sm" onClick={() => shift(-1)} aria-label="Semana anterior"><ChevronLeft /></button>
            <button className="btn ghost sm" onClick={() => setWeek(startOfWeek(new Date()))} disabled={isThisWeek}>Hoje</button>
            <button className="btn ghost sm" onClick={() => shift(1)} aria-label="Próxima semana"><ChevronRight /></button>
            <span className="week-label">{label}</span>
          </div>
          <button className="btn primary" onClick={() => setEdit({})}><Plus /> Nova consulta</button>
        </div>
      </header>

      <div className="week">
        {days.map((d) => {
          const iso = todayISO(d);
          const list = db.appointments.filter((a) => a.dataHora.startsWith(iso)).sort((a, b) => a.dataHora.localeCompare(b.dataHora));
          return (
            <section key={iso} className={`day ${iso === today ? 'today' : ''} ${iso < today ? 'past' : ''}`}>
              <header>
                <span className="dname cap">{d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span>
                <span className="dnum">{d.getDate()}</span>
                <button className="icon-btn" title="Agendar neste dia" aria-label={`Agendar em ${d.toLocaleDateString('pt-BR')}`} onClick={() => setEdit({ dataHora: `${iso}T09:00` })}>
                  <Plus />
                </button>
              </header>
              <div className="day-body">
                {list.length === 0 && <span className="day-free">Livre</span>}
                {list.map((a) => {
                  const p = pat(a.patientId);
                  const dn = dentName(a.dentistaId);
                  return (
                    <div key={a.id} className={`appt ${a.status}`} onClick={() => setEdit({ item: a })}>
                      <span className="t">{fmtTime(a.dataHora)}</span> <span className="what">{a.duracaoMin} min</span>
                      <Link className="who" to={`/pacientes/${a.patientId}`} onClick={(e) => e.stopPropagation()}>{p?.nome ?? 'Paciente removido'}</Link>
                      <div className="what">{a.motivo || 'Consulta'}</div>
                      {dn && <div className="dent">{dn}</div>}
                      <div className="appt-actions" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={a.status}
                          aria-label="Situação da consulta"
                          onChange={(e) => upsert('appointments', { ...a, status: e.target.value as AppointmentStatus })}
                        >
                          {(Object.keys(APPT_LABEL) as AppointmentStatus[]).map((s) => <option key={s} value={s}>{APPT_LABEL[s]}</option>)}
                        </select>
                        {p && iso >= today && (a.status === 'agendada' || a.status === 'confirmada') && (
                          <WhatsButton
                            sentKey={`lembrete:${a.id}:${a.dataHora}`}
                            telefone={p.telefone}
                            mensagem={fillTemplate(db.settings.templateLembrete, { patient: p, settings: db.settings, dataHora: a.dataHora, motivo: a.motivo })}
                            label="Lembrar"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {edit && (
        <Modal title={edit.item ? 'Editar consulta' : 'Nova consulta'} onClose={close}>
          {db.patients.length === 0 ? (
            <p>Cadastre um paciente antes de agendar. <Link className="link" to="/pacientes?novo=1">Cadastrar paciente</Link></p>
          ) : (
            <AppointmentForm initial={edit.item} dataHora={edit.dataHora} onDone={close} />
          )}
        </Modal>
      )}
    </div>
  );
}
