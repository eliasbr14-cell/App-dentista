import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { get, set } from 'idb-keyval';
import type { Appointment, Database, Exam, Patient, Procedure, Settings } from './types';
import { uid } from './utils';

const KEY = 'app-dentista-db';

export const DEFAULT_SETTINGS: Settings = {
  nomeClinica: 'Consultório Odontológico',
  nomeDentista: 'Dr.',
  telefoneClinica: '',
  endereco: '',
  templateAniversario:
    'Olá, {nome}! 🎉 A equipe do {clinica} deseja a você um feliz aniversário, muita saúde e muitos sorrisos! 😁🦷\n— {dentista}',
  templateLembrete:
    'Olá, {nome}! Passando para lembrar da sua consulta no {clinica} em {dia_semana}, {data} às {hora}. 🦷\nPode confirmar sua presença respondendo esta mensagem? Obrigado!',
  templateRetorno:
    'Olá, {nome}! Tudo bem? Está chegando a hora do seu retorno no {clinica} ({motivo}). Vamos agendar um horário? 😊',
};

const empty = (): Database => ({
  versao: 1,
  patients: [],
  procedures: [],
  exams: [],
  appointments: [],
  settings: DEFAULT_SETTINGS,
  sent: [],
});

type Collection = 'patients' | 'procedures' | 'exams' | 'appointments';
type ItemOf<C extends Collection> = C extends 'patients'
  ? Patient
  : C extends 'procedures'
    ? Procedure
    : C extends 'exams'
      ? Exam
      : Appointment;

interface Store {
  db: Database;
  loaded: boolean;
  upsert<C extends Collection>(c: C, item: Omit<ItemOf<C>, 'id'> & { id?: string }): ItemOf<C>;
  remove(c: Collection, id: string): void;
  removePatient(id: string): void;
  saveSettings(s: Settings): void;
  markSent(key: string): void;
  isSent(key: string): boolean;
  replaceAll(db: Database): void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database>(empty);
  const [loaded, setLoaded] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    get<Database>(KEY)
      .then((saved) => {
        if (saved) setDb({ ...empty(), ...saved, settings: { ...DEFAULT_SETTINGS, ...saved.settings } });
      })
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (first.current) {
      first.current = false;
      return;
    }
    set(KEY, db).catch((e) => alert('Erro ao salvar os dados: ' + e));
  }, [db, loaded]);

  const upsert = useCallback(<C extends Collection>(c: C, item: Omit<ItemOf<C>, 'id'> & { id?: string }) => {
    const full = { ...item, id: item.id ?? uid() } as ItemOf<C>;
    setDb((d) => {
      const list = d[c] as ItemOf<C>[];
      const exists = list.some((x) => x.id === full.id);
      return { ...d, [c]: exists ? list.map((x) => (x.id === full.id ? full : x)) : [...list, full] };
    });
    return full;
  }, []);

  const remove = useCallback((c: Collection, id: string) => {
    setDb((d) => ({ ...d, [c]: (d[c] as { id: string }[]).filter((x) => x.id !== id) }));
  }, []);

  const removePatient = useCallback((id: string) => {
    setDb((d) => ({
      ...d,
      patients: d.patients.filter((p) => p.id !== id),
      procedures: d.procedures.filter((p) => p.patientId !== id),
      exams: d.exams.filter((p) => p.patientId !== id),
      appointments: d.appointments.filter((p) => p.patientId !== id),
    }));
  }, []);

  const saveSettings = useCallback((s: Settings) => setDb((d) => ({ ...d, settings: s })), []);

  const markSent = useCallback(
    (key: string) =>
      setDb((d) => (d.sent.some((s) => s.key === key) ? d : { ...d, sent: [...d.sent, { key, em: new Date().toISOString() }] })),
    [],
  );

  const sentKeys = useMemo(() => new Set(db.sent.map((s) => s.key)), [db.sent]);
  const isSent = useCallback((key: string) => sentKeys.has(key), [sentKeys]);

  const replaceAll = useCallback((n: Database) => setDb({ ...empty(), ...n, settings: { ...DEFAULT_SETTINGS, ...n.settings } }), []);

  const value: Store = { db, loaded, upsert, remove, removePatient, saveSettings, markSent, isSent, replaceAll };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider ausente');
  return s;
}
