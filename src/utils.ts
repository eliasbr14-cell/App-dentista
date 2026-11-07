import type { Patient, Procedure, ProcedureStatus, Settings } from './types';

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const pad = (n: number) => String(n).padStart(2, '0');

export const todayISO = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const nowLocalInput = (d = new Date()) =>
  `${todayISO(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** "2026-11-06" -> Date local (sem problema de fuso). */
export const parseDate = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const fmtDate = (s?: string) => {
  if (!s) return '—';
  const d = parseDate(s);
  return d.toLocaleDateString('pt-BR');
};

export const fmtDateTime = (s: string) => {
  const d = new Date(s);
  return `${d.toLocaleDateString('pt-BR')} às ${fmtTime(s)}`;
};

export const fmtTime = (s: string) => {
  const d = new Date(s);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const fmtWeekday = (s: string) =>
  new Date(s).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

export const fmtMoney = (v?: number) =>
  v == null ? '' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function age(nasc?: string): number | null {
  if (!nasc) return null;
  const b = parseDate(nasc);
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return a;
}

/** Dias até o próximo aniversário (0 = hoje). */
export function daysToBirthday(nasc?: string): number | null {
  if (!nasc) return null;
  const b = parseDate(nasc);
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  let next = new Date(t.getFullYear(), b.getMonth(), b.getDate());
  if (next < t) next = new Date(t.getFullYear() + 1, b.getMonth(), b.getDate());
  return Math.round((next.getTime() - t.getTime()) / 86400000);
}

export const daysBetween = (a: string, b: string) =>
  Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);

export const firstName = (nome: string) => nome.trim().split(/\s+/)[0] ?? nome;

export function onlyDigits(s: string) {
  return s.replace(/\D/g, '');
}

export function fmtPhone(s: string) {
  const d = onlyDigits(s).replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return s;
}

/** Link do WhatsApp com mensagem pronta. Números BR sem DDI recebem 55. */
export function whatsappLink(telefone: string, mensagem: string) {
  let d = onlyDigits(telefone);
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(mensagem)}`;
}

export function fillTemplate(
  tpl: string,
  vars: { patient: Patient; settings: Settings; dataHora?: string; data?: string; motivo?: string },
) {
  const { patient, settings } = vars;
  const map: Record<string, string> = {
    nome: firstName(patient.nome),
    nome_completo: patient.nome,
    clinica: settings.nomeClinica,
    dentista: settings.nomeDentista,
    telefone_clinica: settings.telefoneClinica,
    endereco: settings.endereco,
    data: vars.dataHora ? new Date(vars.dataHora).toLocaleDateString('pt-BR') : vars.data ? fmtDate(vars.data) : '',
    hora: vars.dataHora ? fmtTime(vars.dataHora) : '',
    dia_semana: vars.dataHora ? new Date(vars.dataHora).toLocaleDateString('pt-BR', { weekday: 'long' }) : '',
    motivo: vars.motivo ?? '',
  };
  return tpl.replace(/\{(\w+)\}/g, (m, k) => (k in map ? map[k] : m));
}

/** Situação de um dente a partir dos procedimentos (o mais recente "vence"). */
export type ToothState = 'saudavel' | 'planejado' | 'em_andamento' | 'realizado' | 'ausente';

export function toothState(procs: Procedure[]): ToothState {
  if (procs.length === 0) return 'saudavel';
  if (procs.some((p) => p.tipo === 'Extração' && p.status === 'realizado')) {
    // implante realizado depois da extração "repõe" o dente
    const ext = procs.filter((p) => p.tipo === 'Extração' && p.status === 'realizado').map((p) => p.data).sort().pop()!;
    const reposto = procs.some((p) => (p.tipo === 'Implante' || p.tipo === 'Coroa / Prótese') && p.status === 'realizado' && p.data >= ext);
    if (!reposto) return 'ausente';
  }
  const pending = procs.filter((p) => p.status !== 'realizado');
  if (pending.some((p) => p.status === 'em_andamento')) return 'em_andamento';
  if (pending.length) return 'planejado';
  return 'realizado';
}

export const STATE_LABEL: Record<ToothState, string> = {
  saudavel: 'Sem registro',
  planejado: 'A tratar',
  em_andamento: 'Em tratamento',
  realizado: 'Tratado',
  ausente: 'Ausente',
};

export const STATUS_LABEL: Record<ProcedureStatus, string> = {
  planejado: 'A fazer',
  em_andamento: 'Em andamento',
  realizado: 'Realizado',
};

/** Reduz imagem para caber bem no armazenamento do navegador. */
export function compressImage(file: File, max = 1600, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
