import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useStore } from '../db';
import { Legend, Odontogram, STATE_COLORS } from '../components/Odontogram';
import { Lightbox, Modal } from '../components/Modal';
import { APPT_LABEL, AppointmentForm, ExamForm, PatientForm, ProcedureForm } from '../components/Forms';
import { WhatsButton } from '../components/WhatsButton';
import { ExamImage } from '../components/ExamImage';
import { useAuth } from '../auth';
import { toothInfo } from '../teeth';
import type { Appointment, Exam, Procedure } from '../types';
import {
  age,
  fillTemplate,
  fmtDate,
  fmtDateTime,
  fmtMoney,
  fmtPhone,
  STATE_LABEL,
  STATUS_LABEL,
  toothState,
  whatsappLink,
  firstName,
} from '../utils';

type Dialog =
  | { k: 'patient' }
  | { k: 'proc'; item?: Procedure; dente?: number | null }
  | { k: 'exam'; item?: Exam; dente?: number | null }
  | { k: 'appt'; item?: Appointment };

export function PatientDetail() {
  const { id } = useParams();
  const { db } = useStore();
  const { can } = useAuth();
  const [selected, setSelected] = useState<number | null>(null);
  const [decidua, setDecidua] = useState(() => {
    const p = db.patients.find((x) => x.id === id);
    const a = age(p?.dataNascimento);
    return a != null && a < 6;
  });
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [img, setImg] = useState<string | null>(null);
  const [tab, setTab] = useState<'hist' | 'exames' | 'consultas'>(can.clinical ? 'hist' : 'consultas');

  const patient = db.patients.find((p) => p.id === id);
  const procs = useMemo(() => db.procedures.filter((p) => p.patientId === id).sort((a, b) => b.data.localeCompare(a.data)), [db.procedures, id]);
  const exams = useMemo(() => db.exams.filter((p) => p.patientId === id).sort((a, b) => b.data.localeCompare(a.data)), [db.exams, id]);
  const appts = useMemo(() => db.appointments.filter((p) => p.patientId === id).sort((a, b) => b.dataHora.localeCompare(a.dataHora)), [db.appointments, id]);

  if (!patient) {
    return (
      <div className="page">
        <p>Paciente não encontrado. <Link to="/pacientes">Voltar</Link></p>
      </div>
    );
  }

  const toothProcs = selected != null ? procs.filter((p) => p.dente === selected) : [];
  const toothExams = selected != null ? exams.filter((e) => e.dentes.includes(selected)) : [];
  const st = toothState(toothProcs);
  const total = procs.filter((p) => p.status === 'realizado').reduce((s, p) => s + (p.valor ?? 0), 0);
  const a = age(patient.dataNascimento);
  const close = () => setDialog(null);

  return (
    <div className="page">
      <Link to="/pacientes" className="back">← Pacientes</Link>

      <header className="patient-head card">
        <div className="avatar">{patient.nome.trim()[0]?.toUpperCase()}</div>
        <div className="grow">
          <h1>{patient.nome}</h1>
          <div className="meta">
            <span>📱 {fmtPhone(patient.telefone) || '—'}</span>
            {patient.dataNascimento && <span>🎂 {fmtDate(patient.dataNascimento)} ({a} anos)</span>}
            {patient.email && <span>✉️ {patient.email}</span>}
            {patient.cpf && <span>CPF {patient.cpf}</span>}
          </div>
          {patient.alergias && <div className="alert">⚠ {patient.alergias}</div>}
          {patient.observacoes && <p className="muted small">{patient.observacoes}</p>}
        </div>
        <div className="head-actions">
          {patient.telefone && (
            <a className="btn whats" href={whatsappLink(patient.telefone, `Olá, ${firstName(patient.nome)}! `)} target="_blank" rel="noreferrer">💬 WhatsApp</a>
          )}
          <button className="btn ghost" onClick={() => setDialog({ k: 'appt' })}>📅 Agendar</button>
          <button className="btn ghost" onClick={() => setDialog({ k: 'patient' })}>✏️ Editar</button>
        </div>
      </header>

      {can.clinical && (
      <section className="card odonto-card">
        <div className="odonto-head">
          <h2>Odontograma</h2>
          <div className="seg">
            <button className={!decidua ? 'on' : ''} onClick={() => { setDecidua(false); setSelected(null); }}>Permanente (adulto)</button>
            <button className={decidua ? 'on' : ''} onClick={() => { setDecidua(true); setSelected(null); }}>Decídua (de leite)</button>
          </div>
        </div>
        <div className="odonto-layout">
          <div>
            <Odontogram procedures={procs} exams={exams} selected={selected} onSelect={setSelected} decidua={decidua} />
            <Legend />
          </div>

          <aside className="tooth-panel">
            {selected == null ? (
              <div className="panel-empty">
                <div className="big-tooth">🦷</div>
                <p>Passe o mouse sobre um dente para ver um resumo, ou <b>clique</b> para ver o histórico completo, exames e raio-X.</p>
                <button className="btn ghost" onClick={() => setDialog({ k: 'proc', dente: null })}>+ Procedimento geral</button>
              </div>
            ) : (
              <>
                <div className="panel-title">
                  <div>
                    <h3>Dente {selected}</h3>
                    <div className="muted small">{toothInfo(selected).completo}</div>
                  </div>
                  <button className="icon-btn" onClick={() => setSelected(null)} aria-label="Fechar">✕</button>
                </div>
                <div className="state-pill" style={{ background: STATE_COLORS[st].fill, borderColor: STATE_COLORS[st].stroke }}>
                  {STATE_LABEL[st]}
                </div>
                <div className="row">
                  <button className="btn primary sm" onClick={() => setDialog({ k: 'proc', dente: selected })}>+ Procedimento</button>
                  <button className="btn ghost sm" onClick={() => setDialog({ k: 'exam', dente: selected })}>+ Exame / Raio-X</button>
                </div>

                <h4>Exames</h4>
                {toothExams.length === 0 && <p className="muted small">Nenhum exame para este dente.</p>}
                {toothExams.map((e) => (
                  <div key={e.id} className="exam-item">
                    <div className="exam-imgs">
                      {e.imagens.map((src, i) => (
                        <ExamImage key={i} path={src} alt={e.tipo} onClick={() => setImg(src)} />
                      ))}
                    </div>
                    <div>
                      <b>{e.tipo}</b> · {fmtDate(e.data)}
                      {e.descricao && <p className="small">{e.descricao}</p>}
                      <button className="link" onClick={() => setDialog({ k: 'exam', item: e })}>editar</button>
                    </div>
                  </div>
                ))}

                <h4>Histórico do dente</h4>
                {toothProcs.length === 0 && <p className="muted small">Nada feito neste dente ainda.</p>}
                <ul className="timeline">
                  {toothProcs.map((p) => (
                    <li key={p.id} onClick={() => setDialog({ k: 'proc', item: p })}>
                      <span className={`dot ${p.status}`} />
                      <div>
                        <b>{p.tipo}</b>
                        {p.faces?.length ? <span className="muted"> · faces {p.faces.join('')}</span> : null}
                        <div className="small muted">
                          {fmtDate(p.data)} · {STATUS_LABEL[p.status]} {p.valor ? `· ${fmtMoney(p.valor)}` : ''}
                        </div>
                        {p.descricao && <div className="small">{p.descricao}</div>}
                        {p.retorno && <div className="small">🔁 Retorno: {fmtDate(p.retorno)}</div>}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </aside>
        </div>
      </section>
      )}

      <section className="card">
        <div className="tabs">
          {can.clinical && <button className={tab === 'hist' ? 'on' : ''} onClick={() => setTab('hist')}>Histórico ({procs.length})</button>}
          {can.clinical && <button className={tab === 'exames' ? 'on' : ''} onClick={() => setTab('exames')}>Exames ({exams.length})</button>}
          <button className={tab === 'consultas' ? 'on' : ''} onClick={() => setTab('consultas')}>Consultas ({appts.length})</button>
          <span className="spacer" />
          {tab === 'hist' && <button className="btn primary sm" onClick={() => setDialog({ k: 'proc' })}>+ Procedimento</button>}
          {tab === 'exames' && <button className="btn primary sm" onClick={() => setDialog({ k: 'exam' })}>+ Exame</button>}
          {tab === 'consultas' && <button className="btn primary sm" onClick={() => setDialog({ k: 'appt' })}>+ Consulta</button>}
        </div>

        {tab === 'hist' && (
          <>
            <table className="table">
              <thead>
                <tr><th>Data</th><th>Dente</th><th>Procedimento</th><th>Situação</th><th className="hide-sm">Valor</th><th className="hide-sm">Retorno</th></tr>
              </thead>
              <tbody>
                {procs.map((p) => (
                  <tr key={p.id} onClick={() => setDialog({ k: 'proc', item: p })}>
                    <td>{fmtDate(p.data)}</td>
                    <td>
                      {p.dente ? (
                        <button className="link" onClick={(e) => { e.stopPropagation(); setDecidua(p.dente! >= 50); setSelected(p.dente); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                          {p.dente}
                        </button>
                      ) : 'Geral'}
                    </td>
                    <td>{p.tipo}{p.descricao && <div className="small muted">{p.descricao}</div>}</td>
                    <td><span className={`badge ${p.status}`}>{STATUS_LABEL[p.status]}</span></td>
                    <td className="hide-sm">{fmtMoney(p.valor)}</td>
                    <td className="hide-sm">{p.retorno ? fmtDate(p.retorno) : ''}</td>
                  </tr>
                ))}
                {procs.length === 0 && <tr><td colSpan={6} className="muted center">Nenhum procedimento ainda.</td></tr>}
              </tbody>
            </table>
            {total > 0 && <p className="total">Total realizado: <b>{fmtMoney(total)}</b></p>}
          </>
        )}

        {tab === 'exames' && (
          <div className="gallery">
            {exams.map((e) => (
              <figure key={e.id}>
                {e.imagens[0] ? <ExamImage path={e.imagens[0]} alt={e.tipo} onClick={() => setImg(e.imagens[0])} /> : <div className="noimg">sem imagem</div>}
                <figcaption>
                  <b>{e.tipo}</b>
                  <span className="small muted">{fmtDate(e.data)} · {e.dentes.length ? `dentes ${e.dentes.join(', ')}` : 'boca toda'}</span>
                  {e.descricao && <span className="small">{e.descricao}</span>}
                  <button className="link" onClick={() => setDialog({ k: 'exam', item: e })}>editar</button>
                </figcaption>
              </figure>
            ))}
            {exams.length === 0 && <p className="muted">Nenhum exame cadastrado.</p>}
          </div>
        )}

        {tab === 'consultas' && (
          <ul className="list">
            {appts.map((ap) => (
              <li key={ap.id} onClick={() => setDialog({ k: 'appt', item: ap })} className="clickable">
                <div className="grow">
                  <b>{fmtDateTime(ap.dataHora)}</b>
                  <div className="muted small">{ap.motivo || 'Consulta'} · {ap.duracaoMin} min</div>
                </div>
                {(ap.status === 'agendada' || ap.status === 'confirmada') && ap.dataHora >= new Date().toISOString().slice(0, 10) && (
                  <span onClick={(e) => e.stopPropagation()}>
                    <WhatsButton
                      sentKey={`lembrete:${ap.id}:${ap.dataHora}`}
                      telefone={patient.telefone}
                      mensagem={fillTemplate(db.settings.templateLembrete, { patient, settings: db.settings, dataHora: ap.dataHora, motivo: ap.motivo })}
                      label="Lembrar"
                    />
                  </span>
                )}
                <span className={`badge ${ap.status}`}>{APPT_LABEL[ap.status]}</span>
              </li>
            ))}
            {appts.length === 0 && <p className="muted">Nenhuma consulta.</p>}
          </ul>
        )}
      </section>

      {dialog?.k === 'patient' && (
        <Modal title="Editar paciente" onClose={close}>
          <PatientForm initial={patient} onDone={close} />
        </Modal>
      )}
      {dialog?.k === 'proc' && (
        <Modal title={dialog.item ? 'Editar procedimento' : 'Novo procedimento'} onClose={close}>
          <ProcedureForm patientId={patient.id} initial={dialog.item} dente={dialog.dente} onDone={close} />
        </Modal>
      )}
      {dialog?.k === 'exam' && (
        <Modal title={dialog.item ? 'Editar exame' : 'Novo exame / raio-X'} onClose={close}>
          <ExamForm patientId={patient.id} initial={dialog.item} dente={dialog.dente} onDone={close} />
        </Modal>
      )}
      {dialog?.k === 'appt' && (
        <Modal title={dialog.item ? 'Editar consulta' : 'Agendar consulta'} onClose={close}>
          <AppointmentForm initial={dialog.item} patientId={patient.id} onDone={close} />
        </Modal>
      )}
      {img && <Lightbox src={img} onClose={() => setImg(null)} />}
    </div>
  );
}
