import { useState, type FormEvent, type ReactNode } from 'react';
import { useStore } from '../db';
import type { Appointment, AppointmentStatus, Exam, Patient, Procedure, ProcedureStatus } from '../types';
import { ALL_TEETH, EXAM_TYPES, FACES, PROCEDURE_TYPES, toothInfo } from '../teeth';
import { compressImage, nowLocalInput, STATUS_LABEL, todayISO } from '../utils';

function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <label className={`field ${full ? 'full' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function Actions({ onCancel, onDelete }: { onCancel: () => void; onDelete?: () => void }) {
  return (
    <div className="form-actions">
      {onDelete && (
        <button type="button" className="btn danger ghost" onClick={onDelete}>
          Excluir
        </button>
      )}
      <span className="spacer" />
      <button type="button" className="btn ghost" onClick={onCancel}>Cancelar</button>
      <button type="submit" className="btn primary">Salvar</button>
    </div>
  );
}

const ToothOptions = () => (
  <>
    <optgroup label="Permanentes">
      {ALL_TEETH.filter((n) => n < 50).sort((a, b) => a - b).map((n) => (
        <option key={n} value={n}>{n} — {toothInfo(n).completo}</option>
      ))}
    </optgroup>
    <optgroup label="Decíduos (de leite)">
      {ALL_TEETH.filter((n) => n >= 50).sort((a, b) => a - b).map((n) => (
        <option key={n} value={n}>{n} — {toothInfo(n).completo}</option>
      ))}
    </optgroup>
  </>
);

/* ---------------- Paciente ---------------- */

export function PatientForm({ initial, onDone }: { initial?: Patient; onDone: (p?: Patient) => void }) {
  const { upsert, removePatient } = useStore();
  const [f, setF] = useState<Partial<Patient>>(initial ?? {});
  const s = (k: keyof Patient) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = upsert('patients', { criadoEm: new Date().toISOString(), ...f, nome: f.nome!.trim(), telefone: f.telefone ?? '' } as Patient);
    onDone(p);
  };

  return (
    <form className="form-grid" onSubmit={submit}>
      <Field label="Nome completo *" full>
        <input required autoFocus value={f.nome ?? ''} onChange={s('nome')} />
      </Field>
      <Field label="Celular / WhatsApp *">
        <input required type="tel" placeholder="(11) 98765-4321" value={f.telefone ?? ''} onChange={s('telefone')} />
      </Field>
      <Field label="Data de nascimento">
        <input type="date" value={f.dataNascimento ?? ''} onChange={s('dataNascimento')} />
      </Field>
      <Field label="E-mail">
        <input type="email" value={f.email ?? ''} onChange={s('email')} />
      </Field>
      <Field label="CPF">
        <input value={f.cpf ?? ''} onChange={s('cpf')} />
      </Field>
      <Field label="Endereço" full>
        <input value={f.endereco ?? ''} onChange={s('endereco')} />
      </Field>
      <Field label="Alergias / medicamentos" full>
        <input placeholder="Ex.: alergia a penicilina, hipertenso…" value={f.alergias ?? ''} onChange={s('alergias')} />
      </Field>
      <Field label="Observações" full>
        <textarea rows={3} value={f.observacoes ?? ''} onChange={s('observacoes')} />
      </Field>
      <Actions
        onCancel={() => onDone()}
        onDelete={
          initial
            ? () => {
                if (confirm(`Excluir ${initial.nome} e TODO o histórico dele(a)? Isso não pode ser desfeito.`)) {
                  removePatient(initial.id);
                  onDone();
                }
              }
            : undefined
        }
      />
    </form>
  );
}

/* ---------------- Procedimento ---------------- */

export function ProcedureForm({
  patientId,
  initial,
  dente,
  onDone,
}: {
  patientId: string;
  initial?: Procedure;
  dente?: number | null;
  onDone: () => void;
}) {
  const { upsert, remove } = useStore();
  const [f, setF] = useState<Partial<Procedure>>(
    initial ?? { dente: dente ?? null, tipo: 'Restauração', status: 'realizado', data: todayISO(), faces: [] },
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    upsert('procedures', {
      ...f,
      patientId,
      valor: f.valor != null && !Number.isNaN(f.valor) ? f.valor : undefined,
      retorno: f.retorno || undefined,
    } as Procedure);
    onDone();
  };

  const toggleFace = (id: string) => {
    const cur = new Set(f.faces ?? []);
    cur.has(id) ? cur.delete(id) : cur.add(id);
    setF({ ...f, faces: [...cur] });
  };

  return (
    <form className="form-grid" onSubmit={submit}>
      <Field label="Dente">
        <select value={f.dente ?? ''} onChange={(e) => setF({ ...f, dente: e.target.value ? Number(e.target.value) : null })}>
          <option value="">Geral (boca toda)</option>
          <ToothOptions />
        </select>
      </Field>
      <Field label="Procedimento">
        <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
          {PROCEDURE_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </Field>
      {f.dente != null && (
        <Field label="Faces do dente" full>
          <div className="chips">
            {FACES.map((fc) => (
              <button
                type="button"
                key={fc.id}
                className={`chip ${f.faces?.includes(fc.id) ? 'on' : ''}`}
                onClick={() => toggleFace(fc.id)}
                title={fc.nome}
              >
                {fc.id} <small>{fc.nome}</small>
              </button>
            ))}
          </div>
        </Field>
      )}
      <Field label="Situação">
        <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as ProcedureStatus })}>
          {(Object.keys(STATUS_LABEL) as ProcedureStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
      </Field>
      <Field label="Data">
        <input type="date" required value={f.data ?? ''} onChange={(e) => setF({ ...f, data: e.target.value })} />
      </Field>
      <Field label="Valor (R$)">
        <input
          type="number"
          min="0"
          step="0.01"
          value={f.valor ?? ''}
          onChange={(e) => setF({ ...f, valor: e.target.value === '' ? undefined : Number(e.target.value) })}
        />
      </Field>
      <Field label="Data de retorno (opcional)">
        <input type="date" value={f.retorno ?? ''} onChange={(e) => setF({ ...f, retorno: e.target.value })} />
      </Field>
      <Field label="Descrição / anotações" full>
        <textarea rows={3} value={f.descricao ?? ''} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
      </Field>
      <Actions
        onCancel={onDone}
        onDelete={initial ? () => confirm('Excluir este procedimento?') && (remove('procedures', initial.id), onDone()) : undefined}
      />
    </form>
  );
}

/* ---------------- Exame / Raio-X ---------------- */

export function ExamForm({ patientId, initial, dente, onDone }: { patientId: string; initial?: Exam; dente?: number | null; onDone: () => void }) {
  const { upsert, remove } = useStore();
  const [f, setF] = useState<Partial<Exam>>(
    initial ?? { tipo: 'Raio-X periapical', data: todayISO(), dentes: dente != null ? [dente] : [], imagens: [] },
  );
  const [dentesTxt, setDentesTxt] = useState((f.dentes ?? []).join(', '));
  const [busy, setBusy] = useState(false);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const imgs = await Promise.all([...files].map((file) => compressImage(file)));
      setF((cur) => ({ ...cur, imagens: [...(cur.imagens ?? []), ...imgs] }));
    } catch {
      alert('Não foi possível ler a imagem. Use JPG ou PNG.');
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const dentes = dentesTxt
      .split(/[\s,;]+/)
      .map(Number)
      .filter((n) => ALL_TEETH.includes(n));
    upsert('exams', { ...f, dentes, patientId, imagens: f.imagens ?? [] } as Exam);
    onDone();
  };

  return (
    <form className="form-grid" onSubmit={submit}>
      <Field label="Tipo de exame">
        <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
          {EXAM_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Data">
        <input type="date" required value={f.data ?? ''} onChange={(e) => setF({ ...f, data: e.target.value })} />
      </Field>
      <Field label="Dentes envolvidos (ex.: 26, 27 — vazio = boca toda)" full>
        <input value={dentesTxt} onChange={(e) => setDentesTxt(e.target.value)} placeholder="26, 27" />
      </Field>
      <Field label="Imagens (raio-X, foto…)" full>
        <input type="file" accept="image/*" multiple onChange={(e) => addFiles(e.target.files)} />
      </Field>
      {busy && <p className="muted full">Processando imagem…</p>}
      {!!f.imagens?.length && (
        <div className="thumbs full">
          {f.imagens.map((src, i) => (
            <div key={i} className="thumb">
              <img src={src} alt="" />
              <button type="button" className="icon-btn" onClick={() => setF({ ...f, imagens: f.imagens!.filter((_, j) => j !== i) })} aria-label="Remover imagem">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <Field label="Laudo / observações" full>
        <textarea rows={3} value={f.descricao ?? ''} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
      </Field>
      <Actions onCancel={onDone} onDelete={initial ? () => confirm('Excluir este exame?') && (remove('exams', initial.id), onDone()) : undefined} />
    </form>
  );
}

/* ---------------- Consulta ---------------- */

export const APPT_LABEL: Record<AppointmentStatus, string> = {
  agendada: 'Agendada',
  confirmada: 'Confirmada',
  concluida: 'Concluída',
  faltou: 'Faltou',
  cancelada: 'Cancelada',
};

export function AppointmentForm({ initial, patientId, dataHora, onDone }: { initial?: Appointment; patientId?: string; dataHora?: string; onDone: () => void }) {
  const { db, upsert, remove } = useStore();
  const [f, setF] = useState<Partial<Appointment>>(
    initial ?? { patientId, dataHora: dataHora ?? nowLocalInput(), duracaoMin: 30, motivo: '', status: 'agendada' },
  );
  const patients = [...db.patients].sort((a, b) => a.nome.localeCompare(b.nome));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    upsert('appointments', f as Appointment);
    onDone();
  };

  return (
    <form className="form-grid" onSubmit={submit}>
      <Field label="Paciente *" full>
        <select required value={f.patientId ?? ''} onChange={(e) => setF({ ...f, patientId: e.target.value })}>
          <option value="">Selecione…</option>
          {patients.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </Field>
      <Field label="Data e hora *">
        <input type="datetime-local" required value={f.dataHora ?? ''} onChange={(e) => setF({ ...f, dataHora: e.target.value })} />
      </Field>
      <Field label="Duração">
        <select value={f.duracaoMin} onChange={(e) => setF({ ...f, duracaoMin: Number(e.target.value) })}>
          {[15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} min</option>)}
        </select>
      </Field>
      <Field label="Motivo" full>
        <input placeholder="Ex.: Canal 26 — 2ª sessão" value={f.motivo ?? ''} onChange={(e) => setF({ ...f, motivo: e.target.value })} />
      </Field>
      <Field label="Situação">
        <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as AppointmentStatus })}>
          {(Object.keys(APPT_LABEL) as AppointmentStatus[]).map((s) => <option key={s} value={s}>{APPT_LABEL[s]}</option>)}
        </select>
      </Field>
      <Field label="Observações" full>
        <textarea rows={2} value={f.observacoes ?? ''} onChange={(e) => setF({ ...f, observacoes: e.target.value })} />
      </Field>
      <Actions onCancel={onDone} onDelete={initial ? () => confirm('Excluir esta consulta?') && (remove('appointments', initial.id), onDone()) : undefined} />
    </form>
  );
}
