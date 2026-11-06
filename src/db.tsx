import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Appointment, Database, Exam, Patient, Procedure, Profile, SentMessage, Settings } from './types';
import { fetchAll, fromRow, supabase, toRow } from './supabase';
import { useAuth } from './auth';

export const DEFAULT_SETTINGS: Settings = {
  nomeClinica: 'Imperium Odonto',
  nomeDentista: '',
  telefoneClinica: '',
  endereco: '',
  templateAniversario:
    'Olá, {nome}! 🎉 A equipe da {clinica} deseja a você um feliz aniversário, muita saúde e muitos sorrisos! 😁🦷\n{dentista}',
  templateLembrete:
    'Olá, {nome}! Passando para lembrar da sua consulta na {clinica} em {dia_semana}, {data} às {hora}. 🦷\nPode confirmar sua presença respondendo esta mensagem? Obrigado!',
  templateRetorno:
    'Olá, {nome}! Tudo bem? Está chegando a hora do seu retorno na {clinica} ({motivo}). Vamos agendar um horário? 😊',
};

type Collection = 'patients' | 'procedures' | 'exams' | 'appointments';
type ItemOf<C extends Collection> = C extends 'patients'
  ? Patient
  : C extends 'procedures'
    ? Procedure
    : C extends 'exams'
      ? Exam
      : Appointment;

const empty = (settings: Settings): Database => ({
  profiles: [],
  patients: [],
  procedures: [],
  exams: [],
  appointments: [],
  settings,
  sent: [],
});

interface Store {
  db: Database;
  clinicId: string;
  loaded: boolean;
  saving: boolean;
  upsert<C extends Collection>(c: C, item: Omit<ItemOf<C>, 'id'> & { id?: string }): ItemOf<C>;
  remove(c: Collection, id: string): void;
  removePatient(id: string): void;
  saveSettings(s: Settings): Promise<void>;
  markSent(key: string): void;
  isSent(key: string): boolean;
  reload(): Promise<void>;
}

const Ctx = createContext<Store | null>(null);

const replaceById = <T extends { id: string }>(list: T[], item: T) =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];

export function StoreProvider({ clinicId, children }: { clinicId: string; children: ReactNode }) {
  const { clinic, can, reload: reloadAuth } = useAuth();
  const settings = useMemo<Settings>(
    () => ({ ...DEFAULT_SETTINGS, ...(clinic?.settings ?? {}), nomeClinica: clinic?.nome ?? DEFAULT_SETTINGS.nomeClinica }),
    [clinic],
  );
  const [data, setData] = useState<Omit<Database, 'settings'>>(() => empty(settings));
  const [loaded, setLoaded] = useState(false);
  const clinical = can.clinical;
  const alive = useRef(true);
  const [pending, setPending] = useState(0);

  // avisa se tentar fechar a página com algo ainda sendo salvo
  useEffect(() => {
    if (!pending) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [pending]);

  /**
   * Gravações vão em fila, na ordem em que foram feitas (ex.: o paciente é salvo antes do
   * procedimento dele). As consultas do supabase só disparam quando a fila chega nelas.
   */
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const track = useCallback((op: PromiseLike<{ error: { message: string } | null }>, errMsg: string, onError: (m: string) => void) => {
    setPending((n) => n + 1);
    queue.current = queue.current
      .then(() => op)
      .then(({ error }) => error && onError(errMsg + error.message), (e: Error) => onError(errMsg + e.message))
      .finally(() => setPending((n) => n - 1));
  }, []);

  const reload = useCallback(async () => {
    try {
      const [profiles, patients, procedures, exams, appointments, sent] = await Promise.all([
        fetchAll<Profile>('profiles', clinicId),
        fetchAll<Patient>('patients', clinicId),
        clinical ? fetchAll<Procedure>('procedures', clinicId) : Promise.resolve([]),
        clinical ? fetchAll<Exam>('exams', clinicId) : Promise.resolve([]),
        fetchAll<Appointment>('appointments', clinicId),
        fetchAll<SentMessage>('sent_messages', clinicId, 'key'),
      ]);
      if (!alive.current) return;
      setData({ profiles, patients, procedures, exams, appointments, sent });
    } catch (e) {
      alert('Erro ao carregar os dados: ' + (e as Error).message);
    } finally {
      setLoaded(true);
    }
  }, [clinicId, clinical]);

  useEffect(() => {
    alive.current = true;
    setLoaded(false);
    reload();
    return () => {
      alive.current = false;
    };
  }, [reload]);

  // tempo real: o que outra pessoa altera aparece aqui na hora
  useEffect(() => {
    const tables: [string, keyof Omit<Database, 'settings'>][] = [
      ['patients', 'patients'],
      ['appointments', 'appointments'],
      ['sent_messages', 'sent'],
    ];
    if (clinical) tables.push(['procedures', 'procedures'], ['exams', 'exams']);
    const ch = supabase.channel(`clinic-${clinicId}`);
    for (const [table, key] of tables) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table, filter: `clinic_id=eq.${clinicId}` }, (payload) => {
        setData((d) => {
          const list = d[key] as unknown as { id?: string; key?: string }[];
          if (payload.eventType === 'DELETE') {
            const old = payload.old as { id?: string; key?: string };
            return { ...d, [key]: list.filter((x) => (old.id ? x.id !== old.id : x.key !== old.key)) };
          }
          const item = fromRow<{ id?: string; key?: string }>(payload.new as Record<string, unknown>);
          if (key === 'sent') return list.some((x) => x.key === item.key) ? d : { ...d, sent: [...d.sent, item as SentMessage] };
          return { ...d, [key]: replaceById(list as { id: string }[], item as { id: string }) };
        });
      });
    }
    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [clinicId, clinical]);

  const fail = useCallback(
    (msg: string) => {
      alert(msg);
      reload();
    },
    [reload],
  );

  const upsert = useCallback(
    <C extends Collection>(c: C, item: Omit<ItemOf<C>, 'id'> & { id?: string }) => {
      const full = { ...item, id: item.id ?? crypto.randomUUID(), clinicId } as ItemOf<C>;
      setData((d) => ({ ...d, [c]: replaceById(d[c] as ItemOf<C>[], full) }));
      track(supabase.from(c).upsert(toRow(full)), 'Não foi possível salvar: ', fail);
      return full;
    },
    [clinicId, fail, track],
  );

  const remove = useCallback(
    (c: Collection, id: string) => {
      if (c === 'exams') {
        const ex = data.exams.find((e) => e.id === id);
        const paths = ex?.imagens.filter((p) => !p.startsWith('data:')) ?? [];
        if (paths.length) supabase.storage.from('exames').remove(paths);
      }
      setData((d) => ({ ...d, [c]: (d[c] as { id: string }[]).filter((x) => x.id !== id) }));
      track(supabase.from(c).delete().eq('id', id), 'Não foi possível excluir: ', fail);
    },
    [data.exams, fail, track],
  );

  const removePatient = useCallback(
    (id: string) => {
      const paths = data.exams.filter((e) => e.patientId === id).flatMap((e) => e.imagens.filter((p) => !p.startsWith('data:')));
      if (paths.length) supabase.storage.from('exames').remove(paths);
      setData((d) => ({
        ...d,
        patients: d.patients.filter((p) => p.id !== id),
        procedures: d.procedures.filter((p) => p.patientId !== id),
        exams: d.exams.filter((p) => p.patientId !== id),
        appointments: d.appointments.filter((p) => p.patientId !== id),
      }));
      track(supabase.from('patients').delete().eq('id', id), 'Não foi possível excluir: ', fail);
    },
    [data.exams, fail, track],
  );

  const saveSettings = useCallback(
    async (s: Settings) => {
      const { nomeClinica, ...rest } = s;
      const { error } = await supabase.from('clinics').update({ nome: nomeClinica, settings: rest }).eq('id', clinicId);
      if (error) throw error;
      await reloadAuth();
    },
    [clinicId, reloadAuth],
  );

  const markSent = useCallback(
    (key: string) => {
      setData((d) => (d.sent.some((s) => s.key === key) ? d : { ...d, sent: [...d.sent, { key, em: new Date().toISOString() }] }));
      track(supabase.from('sent_messages').upsert({ clinic_id: clinicId, key }, { ignoreDuplicates: true }), '', (m) => console.warn(m));
    },
    [clinicId, track],
  );

  const sentKeys = useMemo(() => new Set(data.sent.map((s) => s.key)), [data.sent]);
  const isSent = useCallback((key: string) => sentKeys.has(key), [sentKeys]);

  const db = useMemo<Database>(() => ({ ...data, settings }), [data, settings]);
  const value: Store = { db, clinicId, loaded, saving: pending > 0, upsert, remove, removePatient, saveSettings, markSent, isSent, reload };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider ausente');
  return s;
}
