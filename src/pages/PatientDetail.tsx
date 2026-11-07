import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Cake, CalendarPlus, ImagePlus, Mail, MessageCircle, MousePointerClick, Pencil, Phone, Plus, X } from 'lucide-react';
import { useStore } from '../db';
import { useAuth } from '../auth';
import { Legend, Odontogram } from '../components/Odontogram';
import { Lightbox, Modal } from '../components/Modal';
import { APPT_LABEL, AppointmentForm, ExamForm, PatientForm, ProcedureForm } from '../components/Forms';
import { WhatsButton } from '../components/WhatsButton';
import { ExamImage } from '../components/ExamImage';
import { initials, Status } from '../components/ui';
import { toothInfo } from '../teeth';
import type { Appointment, Exam, Procedure } from '../types';
import {
  age,
  fillTemplate,
  firstName,
  fmtDate,
  fmtDateTime,
  fmtMoney,
  fmtPhone,
  STATE_LABEL,
  STATUS_LABEL,
  todayISO,
  toothState,
  whatsappLink,
} from '../utils';

type Dialog =
  | { k: 'patient' }
  | { k: 'proc'; item?: Procedure; dente?: number | null }
  | { k: 'exam'; item?: Exam; dente?: number | null }
  | { k: 'appt'; item?: Appointment };

const STATE_KIND: Record<string, string> = {
  saudavel: '',
  planejado: 'planejado',
  em_andamento: 'em_andamento',
  realizado: 'realizado',
  ausente: '',
};

export function PatientDetail() {
  const { id } = useParams();
  const { db } = useStore();
  const { can } = useAuth();
  const [selected, setSelected] = useState<number | null>(null);
  const [decidua, setDecidua] = useState(() => {
    const a = age(db.patients.find((x) => x.id === id)?.dataNascimento);
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
        <Link to="/pacientes" className="back"><ArrowLeft /> Pacientes</Link>
        <p>Este paciente não existe ou foi excluído.</p>
      </div>
    );
  }

  const today = todayISO();
  const toothProcs = selected != null ? procs.filter((p) => p.dente === selected) : [];
  const toothExams = selected != null ? exams.filter((e) => e.dentes.includes(selected)) : [];
  const st = toothState(toothProcs);
  const total = procs.filter((p) => p.status === 'realizado').reduce((s, p) => s + (p.valor ?? 0), 0);
  const a = age(patient.dataNascimento);
  const close = () => setDialog(null);
  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const next = appts.filter((x) => x.dataHora.slice(0, 16) >= nowLocal && (x.status === 'agendada' || x.status === 'confirmada')).sort((x, y) => x.dataHora.localeCompare(y.dataHora))[0];

  return (
    <div className="page">
      <Link to="/pacientes" className="back"><ArrowLeft /> Pacientes</Link>

      <section className="panel patient-head">
        <div className="avatar">{initials(patient.nome)}</div>
        <div className="grow">
          <h1 className="patient-name">{patient.nome}</h1>
          <div className="facts">
            {patient.telefone && <span><Phone /> {fmtPhone(patient.telefone)}</span>}
            {patient.dataNascimento && <span><Cake /> {fmtDate(patient.dataNascimento)} ({a} anos)</span>}
            {patient.email && <span><Mail /> {patient.email}</span>}
            {patient.cpf && <span>CPF {patient.cpf}</span>}
            {next && <span><CalendarPlus /> Próxima consulta {fmtDateTime(next.dataHora)}</span>}
          </div>
          {patient.alergias && <div className="alert"><AlertTriangle /> {patient.alergias}</div>}
          {patient.observacoes && <p className="notes">{patient.observacoes}</p>}
        </div>
        <div className="head-actions">
          {patient.telefone && (
            <a className="btn ghost" href={whatsappLink(patient.telefone, `Olá, ${firstName(patient.nome)}! `)} target="_blank" rel="noreferrer">
              <MessageCircle /> WhatsApp
            </a>
          )}
          <button className="btn ghost" onClick={() => setDialog({ k: 'patient' })}><Pencil /> Editar</button>
          <button className="btn primary" onClick={() => setDialog({ k: 'appt' })}><CalendarPlus /> Agendar</button>
        </div>
      </section>

      {can.clinical && (
        <section className="panel chart">
          <header className="panel-head">
            <h2>Odontograma</h2>
            <div className="seg" role="tablist" aria-label="Dentição">
              <button role="tab" aria-selected={!decidua} className={!decidua ? 'on' : ''} onClick={() => { setDecidua(false); setSelected(null); }}>Permanente</button>
              <button role="tab" aria-selected={decidua} className={decidua ? 'on' : ''} onClick={() => { setDecidua(true); setSelected(null); }}>Decídua</button>
            </div>
          </header>
          <div className="odonto-layout">
            <div className="odonto-stage">
              <Odontogram procedures={procs} exams={exams} selected={selected} onSelect={setSelected} decidua={decidua} />
              <Legend />
            </div>

            <aside className="tooth-panel">
              {selected == null ? (
                <div className="panel-empty">
                  <span className="hint-icon"><MousePointerClick /></span>
                  <p>Selecione um dente para ver o histórico, os exames e registrar um procedimento.</p>
                  <button className="btn ghost sm" onClick={() => setDialog({ k: 'proc', dente: null })}><Plus /> Procedimento geral</button>
                </div>
              ) : (
                <>
                  <div className="panel-title">
                    <div>
                      <h3>Dente {selected}</h3>
                      <div className="muted small">{toothInfo(selected).completo}</div>
                    </div>
                    <button className="icon-btn" onClick={() => setSelected(null)} aria-label="Fechar"><X /></button>
                  </div>
                  <div className="state-line"><Status kind={STATE_KIND[st]}>{STATE_LABEL[st]}</Status></div>
                  <div className="row">
                    <button className="btn primary sm" onClick={() => setDialog({ k: 'proc', dente: selected })}><Plus /> Procedimento</button>
                    <button className="btn ghost sm" onClick={() => setDialog({ k: 'exam', dente: selected })}><ImagePlus /> Exame</button>
                  </div>

                  <h4>Exames</h4>
                  {toothExams.length === 0 && <p className="muted small">Nenhum exame deste dente.</p>}
                  {toothExams.map((e) => (
                    <div key={e.id} className="exam-item">
                      <div className="exam-imgs">
                        {e.imagens.slice(0, 2).map((src, i) => (
                          <ExamImage key={i} path={src} alt={e.tipo} onClick={() => setImg(src)} />
                        ))}
                      </div>
                      <div className="grow">
                        <div style={{ fontWeight: 500 }}>{e.tipo}</div>
                        <div className="muted small">{fmtDate(e.data)}</div>
                        {e.descricao && <p className="small" style={{ marginTop: 4 }}>{e.descricao}</p>}
                        <button className="link" onClick={() => setDialog({ k: 'exam', item: e })}>Editar</button>
                      </div>
                    </div>
                  ))}

                  <h4>Histórico</h4>
                  {toothProcs.length === 0 && <p className="muted small">Nenhum procedimento neste dente.</p>}
                  <ul className="timeline">
                    {toothProcs.map((p) => (
                      <li key={p.id} onClick={() => setDialog({ k: 'proc', item: p })}>
                        <span className={`dot ${p.status}`} />
                        <div style={{ fontWeight: 500 }}>
                          {p.tipo}
                          {p.faces?.length ? <span className="muted" style={{ fontWeight: 400 }}>, faces {p.faces.join('')}</span> : null}
                        </div>
                        <div className="small muted">
                          {fmtDate(p.data)}, {STATUS_LABEL[p.status].toLowerCase()}{p.valor ? `, ${fmtMoney(p.valor)}` : ''}
                        </div>
                        {p.descricao && <div className="small" style={{ marginTop: 2 }}>{p.descricao}</div>}
                        {p.retorno && <div className="small" style={{ color: 'var(--gold-text)' }}>Retorno em {fmtDate(p.retorno)}</div>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </aside>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="tabs" role="tablist">
          {can.clinical && <button role="tab" aria-selected={tab === 'hist'} className={tab === 'hist' ? 'on' : ''} onClick={() => setTab('hist')}>Procedimentos <span className="muted">{procs.length}</span></button>}
          {can.clinical && <button role="tab" aria-selected={tab === 'exames'} className={tab === 'exames' ? 'on' : ''} onClick={() => setTab('exames')}>Exames <span className="muted">{exams.length}</span></button>}
          <button role="tab" aria-selected={tab === 'consultas'} className={tab === 'consultas' ? 'on' : ''} onClick={() => setTab('consultas')}>Consultas <span className="muted">{appts.length}</span></button>
          <span className="spacer" />
          {tab === 'hist' && <button className="btn ghost sm" onClick={() => setDialog({ k: 'proc' })}><Plus /> Procedimento</button>}
          {tab === 'exames' && <button className="btn ghost sm" onClick={() => setDialog({ k: 'exam' })}><ImagePlus /> Exame</button>}
          {tab === 'consultas' && <button className="btn ghost sm" onClick={() => setDialog({ k: 'appt' })}><CalendarPlus /> Consulta</button>}
        </div>

        {tab === 'hist' && (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Data</th><th className="hide-sm">Dente</th><th>Procedimento</th><th>Situação</th><th className="hide-sm right">Valor</th><th className="hide-sm">Retorno</th></tr>
                </thead>
                <tbody>
                  {procs.map((p) => (
                    <tr key={p.id} onClick={() => setDialog({ k: 'proc', item: p })}>
                      <td className="num">{fmtDate(p.data)}</td>
                      <td className="num hide-sm">
                        {p.dente ? (
                          <button className="link" onClick={(e) => { e.stopPropagation(); setDecidua(p.dente! >= 50); setSelected(p.dente); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                            {p.dente}
                          </button>
                        ) : <span className="muted">Geral</span>}
                      </td>
                      <td>{p.tipo}{p.dente ? <span className="muted show-sm"> ({p.dente})</span> : null}{p.descricao && <div className="small muted hide-sm">{p.descricao}</div>}</td>
                      <td><Status kind={p.status}>{STATUS_LABEL[p.status]}</Status></td>
                      <td className="hide-sm right num">{fmtMoney(p.valor)}</td>
                      <td className="hide-sm num">{p.retorno ? fmtDate(p.retorno) : ''}</td>
                    </tr>
                  ))}
                  {procs.length === 0 && <tr><td colSpan={6} className="muted center" style={{ padding: 28 }}>Nenhum procedimento registrado.</td></tr>}
                </tbody>
              </table>
            </div>
            {total > 0 && <div className="total"><span className="muted">Total realizado</span><b>{fmtMoney(total)}</b></div>}
          </>
        )}

        {tab === 'exames' && (
          <div className="gallery">
            {exams.map((e) => (
              <figure key={e.id}>
                {e.imagens[0] ? <ExamImage path={e.imagens[0]} alt={e.tipo} onClick={() => setImg(e.imagens[0])} /> : <div className="noimg">Sem imagem</div>}
                <figcaption>
                  <b style={{ fontWeight: 500 }}>{e.tipo}</b>
                  <span className="small muted">{fmtDate(e.data)}, {e.dentes.length ? `dentes ${e.dentes.join(', ')}` : 'boca toda'}</span>
                  {e.descricao && <span className="small">{e.descricao}</span>}
                  <button className="link" onClick={() => setDialog({ k: 'exam', item: e })}>Editar</button>
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
                  <div className="primary-line num">{fmtDateTime(ap.dataHora)}</div>
                  <div className="meta">{ap.motivo || 'Consulta'}, {ap.duracaoMin} min</div>
                </div>
                {(ap.status === 'agendada' || ap.status === 'confirmada') && ap.dataHora.slice(0, 10) >= today && (
                  <span onClick={(e) => e.stopPropagation()}>
                    <WhatsButton
                      sentKey={`lembrete:${ap.id}:${ap.dataHora}`}
                      telefone={patient.telefone}
                      mensagem={fillTemplate(db.settings.templateLembrete, { patient, settings: db.settings, dataHora: ap.dataHora, motivo: ap.motivo })}
                      label="Lembrar"
                    />
                  </span>
                )}
                <Status kind={ap.status}>{APPT_LABEL[ap.status]}</Status>
              </li>
            ))}
            {appts.length === 0 && <p className="empty-line">Nenhuma consulta registrada.</p>}
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
        <Modal title={dialog.item ? 'Editar exame' : 'Novo exame'} onClose={close}>
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
