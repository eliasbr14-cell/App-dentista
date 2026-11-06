import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../db';
import { demoData } from '../seed';
import { WhatsButton } from '../components/WhatsButton';
import { APPT_LABEL } from '../components/Forms';
import { age, daysBetween, daysToBirthday, fillTemplate, fmtDate, fmtTime, fmtWeekday, todayISO } from '../utils';

export function Dashboard() {
  const { db, replaceAll } = useStore();
  const [range, setRange] = useState(7);
  const today = todayISO();
  const pat = (id: string) => db.patients.find((p) => p.id === id);
  const year = new Date().getFullYear();

  const todays = db.appointments
    .filter((a) => a.dataHora.startsWith(today) && a.status !== 'cancelada')
    .sort((a, b) => a.dataHora.localeCompare(b.dataHora));

  const upcoming = db.appointments
    .filter((a) => {
      const d = a.dataHora.slice(0, 10);
      const diff = daysBetween(today, d);
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

  if (db.patients.length === 0) {
    return (
      <div className="empty-hero">
        <div className="big-tooth">🦷</div>
        <h1>Bem-vindo ao seu consultório digital</h1>
        <p>Cadastre o primeiro paciente ou carregue dados de exemplo para conhecer o sistema.</p>
        <div className="row center">
          <Link className="btn primary" to="/pacientes?novo=1">+ Cadastrar paciente</Link>
          <button className="btn ghost" onClick={() => replaceAll(demoData())}>Carregar dados de exemplo</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Painel</h1>
          <p className="muted cap">{fmtWeekday(today + 'T12:00')}</p>
        </div>
        <Link className="btn primary" to="/agenda?nova=1">+ Nova consulta</Link>
      </header>

      <div className="stats">
        <div className="stat"><b>{todays.length}</b><span>consultas hoje</span></div>
        <div className="stat"><b>{db.patients.length}</b><span>pacientes</span></div>
        <div className="stat"><b>{birthdays.filter((b) => b.dias === 0).length}</b><span>aniversariantes hoje</span></div>
        <div className="stat"><b>{returns.length}</b><span>retornos a agendar</span></div>
      </div>

      <div className="grid-2">
        <section className="card">
          <h2>📅 Consultas de hoje</h2>
          {todays.length === 0 && <p className="muted">Nenhuma consulta hoje.</p>}
          <ul className="list">
            {todays.map((a) => {
              const p = pat(a.patientId);
              return (
                <li key={a.id}>
                  <span className="time">{fmtTime(a.dataHora)}</span>
                  <div className="grow">
                    <Link to={`/pacientes/${a.patientId}`}><b>{p?.nome ?? '—'}</b></Link>
                    <div className="muted small">{a.motivo || 'Consulta'} · {a.duracaoMin} min</div>
                  </div>
                  <span className={`badge ${a.status}`}>{APPT_LABEL[a.status]}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card">
          <h2>⏰ Lembretes de consulta <small className="muted">(próximos 2 dias)</small></h2>
          {upcoming.length === 0 && <p className="muted">Nenhuma consulta nos próximos 2 dias.</p>}
          <ul className="list">
            {upcoming.map((a) => {
              const p = pat(a.patientId);
              if (!p) return null;
              return (
                <li key={a.id}>
                  <div className="grow">
                    <Link to={`/pacientes/${p.id}`}><b>{p.nome}</b></Link>
                    <div className="muted small cap">{fmtWeekday(a.dataHora)} às {fmtTime(a.dataHora)} · {a.motivo || 'Consulta'}</div>
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
        </section>

        <section className="card">
          <h2>
            🎂 Aniversariantes
            <select className="inline-select" value={range} onChange={(e) => setRange(Number(e.target.value))}>
              <option value={0}>hoje</option>
              <option value={7}>próximos 7 dias</option>
              <option value={30}>próximos 30 dias</option>
            </select>
          </h2>
          {birthdays.length === 0 && <p className="muted">Ninguém faz aniversário nesse período.</p>}
          <ul className="list">
            {birthdays.map(({ p, dias }) => (
              <li key={p.id}>
                <div className="grow">
                  <Link to={`/pacientes/${p.id}`}><b>{p.nome}</b></Link>
                  <div className="muted small">
                    {dias === 0 ? '🎉 É hoje!' : dias === 1 ? 'Amanhã' : `Em ${dias} dias`} · faz {(age(p.dataNascimento) ?? 0) + (dias === 0 ? 0 : 1)} anos
                  </div>
                </div>
                {dias === 0 ? (
                  <WhatsButton
                    sentKey={`aniv:${p.id}:${year}`}
                    telefone={p.telefone}
                    mensagem={fillTemplate(db.settings.templateAniversario, { patient: p, settings: db.settings })}
                    label="Parabéns"
                  />
                ) : (
                  <span className="muted small">{fmtDate(p.dataNascimento).slice(0, 5)}</span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2>🔁 Retornos para agendar</h2>
          {returns.length === 0 && <p className="muted">Nenhum retorno pendente.</p>}
          <ul className="list">
            {returns.map((r) => {
              const p = pat(r.patientId);
              if (!p) return null;
              const diff = daysBetween(today, r.retorno!);
              return (
                <li key={r.id}>
                  <div className="grow">
                    <Link to={`/pacientes/${p.id}`}><b>{p.nome}</b></Link>
                    <div className={`small ${diff < 0 ? 'late' : 'muted'}`}>
                      {r.tipo}{r.dente ? ` (dente ${r.dente})` : ''} · {diff < 0 ? `atrasado ${-diff} dia(s)` : diff === 0 ? 'hoje' : `em ${diff} dia(s)`}
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
        </section>
      </div>
    </div>
  );
}
