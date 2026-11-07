import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useStore } from '../db';
import { useAuth } from '../auth';
import { WhatsButton } from '../components/WhatsButton';
import { APPT_LABEL } from '../components/Forms';
import { initials, Panel, Status } from '../components/ui';
import { age, daysBetween, daysToBirthday, fillTemplate, firstName, fmtTime, fmtWeekday, todayISO } from '../utils';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
};

export function Dashboard() {
  const { db } = useStore();
  const { can, profile } = useAuth();
  const [range, setRange] = useState(7);
  const today = todayISO();
  const pat = (id: string) => db.patients.find((p) => p.id === id);
  const year = new Date().getFullYear();
  const nowHM = new Date().toTimeString().slice(0, 5);

  const todays = db.appointments
    .filter((a) => a.dataHora.startsWith(today) && a.status !== 'cancelada')
    .sort((a, b) => a.dataHora.localeCompare(b.dataHora));
  const nextIdx = todays.findIndex((a) => fmtTime(a.dataHora) >= nowHM && a.status !== 'concluida' && a.status !== 'faltou');

  const upcoming = db.appointments
    .filter((a) => {
      const diff = daysBetween(today, a.dataHora.slice(0, 10));
      return diff >= 1 && diff <= 2 && (a.status === 'agendada' || a.status === 'confirmada');
    })
    .sort((a, b) => a.dataHora.localeCompare(b.dataHora));

  const birthdays = db.patients
    .map((p) => ({ p, dias: daysToBirthday(p.dataNascimento) }))
    .filter((x): x is { p: typeof x.p; dias: number } => x.dias != null && x.dias <= range)
    .sort((a, b) => a.dias - b.dias);

  const returns = db.procedures
    .filter((p) => p.retorno && daysBetween(today, p.retorno) <= 15)
    .filter((p) => !db.appointments.some((a) => a.patientId === p.patientId && a.dataHora.slice(0, 10) >= today && a.status !== 'cancelada'))
    .sort((a, b) => a.retorno!.localeCompare(b.retorno!));

  const confirmed = todays.filter((a) => a.status === 'confirmada' || a.status === 'concluida').length;

  if (db.patients.length === 0) {
    return (
      <div className="empty-hero">
        <img className="hero-logo" src="./simbolo.png" alt="" />
        <h1>{db.settings.nomeClinica}</h1>
        <p>Nenhum paciente cadastrado ainda. Cadastre o primeiro para começar a montar a agenda e o odontograma.</p>
        <Link className="btn primary" to="/pacientes?novo=1"><Plus /> Cadastrar paciente</Link>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{greeting()}, {firstName(profile?.nome ?? '')}</h1>
          <p className="sub cap">{fmtWeekday(today + 'T12:00')}</p>
        </div>
        <Link className="btn primary" to="/agenda?nova=1"><Plus /> Nova consulta</Link>
      </header>

      <div className="kpis">
        <div className="kpi accent"><b>{todays.length}</b><span>Consultas hoje</span></div>
        <div className="kpi"><b>{confirmed}<span className="muted" style={{ fontSize: '1rem', fontWeight: 400 }}> / {todays.length}</span></b><span>Confirmadas</span></div>
        <div className="kpi"><b>{birthdays.filter((b) => b.dias === 0).length}</b><span>Aniversariantes hoje</span></div>
        {can.clinical ? (
          <div className="kpi"><b>{returns.length}</b><span>Retornos a agendar</span></div>
        ) : (
          <div className="kpi"><b>{db.patients.length}</b><span>Pacientes</span></div>
        )}
      </div>

      <div className="dash-main">
        <Panel title="Agenda de hoje" count={todays.length} flush actions={<Link className="btn quiet sm" to="/agenda">Ver semana</Link>}>
          {todays.length === 0 && <p className="empty-line">Nenhuma consulta marcada para hoje.</p>}
          <ul className="list today-list">
            {todays.map((a, i) => {
              const p = pat(a.patientId);
              return (
                <li key={a.id} className={i === nextIdx ? 'now' : ''}>
                  <span className={`slot ${a.status}`} />
                  <span className="time">{fmtTime(a.dataHora)}</span>
                  <div className="grow">
                    <div className="primary-line"><Link to={`/pacientes/${a.patientId}`}>{p?.nome ?? 'Paciente removido'}</Link></div>
                    <div className="meta">{a.motivo || 'Consulta'}, {a.duracaoMin} min{i === nextIdx ? ' — próxima' : ''}</div>
                  </div>
                  <Status kind={a.status}>{APPT_LABEL[a.status]}</Status>
                </li>
              );
            })}
          </ul>
        </Panel>

        <div className="stack">
          <Panel title="Lembrar consultas" count={upcoming.length} flush>
            {upcoming.length === 0 && <p className="empty-line">Ninguém para lembrar nos próximos 2 dias.</p>}
            <ul className="list">
              {upcoming.map((a) => {
                const p = pat(a.patientId);
                if (!p) return null;
                return (
                  <li key={a.id}>
                    <div className="grow">
                      <div className="primary-line truncate"><Link to={`/pacientes/${p.id}`}>{p.nome}</Link></div>
                      <div className="meta cap">{fmtWeekday(a.dataHora)}, {fmtTime(a.dataHora)}</div>
                    </div>
                    <WhatsButton
                      sentKey={`lembrete:${a.id}:${a.dataHora}`}
                      telefone={p.telefone}
                      mensagem={fillTemplate(db.settings.templateLembrete, { patient: p, settings: db.settings, dataHora: a.dataHora, motivo: a.motivo })}
                      label="Lembrar"
                    />
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel
            title="Aniversários"
            count={birthdays.length}
            flush
            actions={
              <select className="inline-select" value={range} onChange={(e) => setRange(Number(e.target.value))} aria-label="Período">
                <option value={0}>Hoje</option>
                <option value={7}>Próximos 7 dias</option>
                <option value={30}>Próximos 30 dias</option>
              </select>
            }
          >
            {birthdays.length === 0 && <p className="empty-line">Nenhum aniversário nesse período.</p>}
            <ul className="list">
              {birthdays.map(({ p, dias }) => (
                <li key={p.id}>
                  <span className="avatar-s">{initials(p.nome)}</span>
                  <div className="grow">
                    <div className="primary-line truncate"><Link to={`/pacientes/${p.id}`}>{p.nome}</Link></div>
                    <div className="meta">
                      {dias === 0 ? 'Hoje' : dias === 1 ? 'Amanhã' : `Em ${dias} dias`}, {(age(p.dataNascimento) ?? 0) + (dias === 0 ? 0 : 1)} anos
                    </div>
                  </div>
                  {dias === 0 && (
                    <WhatsButton
                      sentKey={`aniv:${p.id}:${year}`}
                      telefone={p.telefone}
                      mensagem={fillTemplate(db.settings.templateAniversario, { patient: p, settings: db.settings })}
                      label="Parabenizar"
                    />
                  )}
                </li>
              ))}
            </ul>
          </Panel>

          {can.clinical && (
            <Panel title="Retornos para agendar" count={returns.length} flush>
              {returns.length === 0 && <p className="empty-line">Nenhum retorno pendente.</p>}
              <ul className="list">
                {returns.map((r) => {
                  const p = pat(r.patientId);
                  if (!p) return null;
                  const diff = daysBetween(today, r.retorno!);
                  return (
                    <li key={r.id}>
                      <div className="grow">
                        <div className="primary-line truncate"><Link to={`/pacientes/${p.id}`}>{p.nome}</Link></div>
                        <div className={`meta ${diff < 0 ? 'late' : ''}`}>
                          {r.tipo}{r.dente ? `, dente ${r.dente}` : ''} — {diff < 0 ? `atrasado ${-diff} dia(s)` : diff === 0 ? 'vence hoje' : `em ${diff} dia(s)`}
                        </div>
                      </div>
                      <WhatsButton
                        sentKey={`retorno:${r.id}:${r.retorno}`}
                        telefone={p.telefone}
                        mensagem={fillTemplate(db.settings.templateRetorno, { patient: p, settings: db.settings, data: r.retorno, motivo: r.tipo })}
                        label="Chamar"
                      />
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
