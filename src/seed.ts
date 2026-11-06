import type { Database } from './types';
import { DEFAULT_SETTINGS } from './db';
import { nowLocalInput, todayISO, uid } from './utils';

/** Imagem fictícia que imita um raio-X periapical, só para demonstração. */
function fakeXray(label: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
  <defs>
    <radialGradient id="g" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#3a3a3a"/><stop offset="1" stop-color="#0b0b0b"/></radialGradient>
    <linearGradient id="t" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#f2f2f2"/><stop offset="0.45" stop-color="#cfcfcf"/><stop offset="1" stop-color="#6d6d6d"/></linearGradient>
  </defs>
  <rect width="600" height="800" fill="url(#g)"/>
  <path d="M140 120 q60-40 120 0 q10 120 -10 240 q-10 160 -40 300 q-15 20 -25 -5 q-30 -150 -40 -300 q-15 -120 -5 -235z" fill="url(#t)" opacity=".9"/>
  <path d="M340 120 q60-40 120 0 q10 120 -10 240 q-20 140 -25 290 q-15 20 -25 -5 q-10 -140 -20 -285 q-50 140 -35 270 q-15 20 -25 -5 q-15 -130 -10 -270 q-10 -120 30 -235z" fill="url(#t)" opacity=".9"/>
  <path d="M370 150 q40 -20 70 0 q5 40 -10 70 q-25 15 -50 0 q-15 -30 -10 -70z" fill="#fff"/>
  <text x="300" y="770" fill="#9a9a9a" font-family="sans-serif" font-size="26" text-anchor="middle">${label}</text>
</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

const birthdayIn = (days: number, years: number) => {
  const d = addDays(days);
  d.setFullYear(d.getFullYear() - years);
  return todayISO(d);
};

const at = (days: number, h: number, m = 0) => {
  const d = addDays(days);
  d.setHours(h, m, 0, 0);
  return nowLocalInput(d);
};

export function demoData(): Database {
  const ana = uid(), bruno = uid(), carla = uid(), diego = uid(), elisa = uid();
  const p = (id: string, nome: string, tel: string, nasc: string, extra = {}) => ({
    id, nome, telefone: tel, dataNascimento: nasc, criadoEm: new Date().toISOString(), ...extra,
  });
  const d = (n: number) => todayISO(addDays(n));

  return {
    versao: 1,
    settings: { ...DEFAULT_SETTINGS, nomeClinica: 'Clínica Sorriso', nomeDentista: 'Dr. Silva' },
    sent: [],
    patients: [
      p(ana, 'Ana Paula Souza', '(11) 98765-4321', birthdayIn(0, 34), { email: 'ana@email.com', alergias: 'Penicilina' }),
      p(bruno, 'Bruno Oliveira', '(11) 99876-1234', birthdayIn(3, 41)),
      p(carla, 'Carla Mendes', '(21) 97654-3210', birthdayIn(45, 27), { observacoes: 'Ansiosa — preferir horários pela manhã.' }),
      p(diego, 'Diego Santos', '(31) 98888-7777', birthdayIn(120, 52)),
      p(elisa, 'Elisa Ramos', '(41) 99999-0000', birthdayIn(200, 8), { observacoes: 'Paciente infantil — responsável: mãe (Juliana).' }),
    ],
    procedures: [
      { id: uid(), patientId: ana, dente: 16, faces: ['O'], tipo: 'Restauração', status: 'realizado', data: d(-60), descricao: 'Resina composta A2.', valor: 250 },
      { id: uid(), patientId: ana, dente: 26, tipo: 'Tratamento de canal', status: 'em_andamento', data: d(-7), descricao: '1ª sessão: abertura e instrumentação. Curativo de demora.', valor: 900 },
      { id: uid(), patientId: ana, dente: 36, faces: ['M', 'O'], tipo: 'Cárie (diagnóstico)', status: 'planejado', data: d(-7), descricao: 'Cárie interproximal vista no bite-wing. Restaurar.' },
      { id: uid(), patientId: ana, dente: 48, tipo: 'Extração', status: 'realizado', data: d(-200), descricao: 'Siso incluso.' },
      { id: uid(), patientId: ana, dente: null, tipo: 'Limpeza / Profilaxia', status: 'realizado', data: d(-170), retorno: d(10), valor: 180 },
      { id: uid(), patientId: ana, dente: 11, faces: ['V'], tipo: 'Restauração', status: 'realizado', data: d(-30), descricao: 'Fechamento de diastema.' },
      { id: uid(), patientId: bruno, dente: 46, tipo: 'Implante', status: 'realizado', data: d(-90), valor: 3500, retorno: d(-2) },
      { id: uid(), patientId: bruno, dente: 21, tipo: 'Coroa / Prótese', status: 'planejado', data: d(0) },
      { id: uid(), patientId: carla, dente: null, tipo: 'Aparelho / Ortodontia', status: 'em_andamento', data: d(-120), descricao: 'Manutenção mensal.', retorno: d(5) },
      { id: uid(), patientId: elisa, dente: 74, tipo: 'Selante', status: 'realizado', data: d(-40), retorno: d(4), descricao: 'Retorno para avaliar o 84.' },
      { id: uid(), patientId: elisa, dente: 84, tipo: 'Cárie (diagnóstico)', status: 'planejado', data: d(-40) },
    ],
    exams: [
      { id: uid(), patientId: ana, dentes: [26], tipo: 'Raio-X periapical', data: d(-7), descricao: 'Lesão periapical no 26.', imagens: [fakeXray('Periapical — dente 26 (exemplo)')] },
      { id: uid(), patientId: ana, dentes: [36, 37], tipo: 'Raio-X interproximal (bite-wing)', data: d(-7), descricao: 'Cárie mesial no 36.', imagens: [fakeXray('Bite-wing — 36/37 (exemplo)')] },
      { id: uid(), patientId: bruno, dentes: [46], tipo: 'Raio-X periapical', data: d(-90), descricao: 'Controle pós-implante.', imagens: [fakeXray('Implante 46 (exemplo)')] },
    ],
    appointments: [
      { id: uid(), patientId: ana, dataHora: at(0, 9), duracaoMin: 60, motivo: 'Canal 26 — 2ª sessão', status: 'confirmada' },
      { id: uid(), patientId: bruno, dataHora: at(0, 14, 30), duracaoMin: 45, motivo: 'Moldagem coroa 21', status: 'agendada' },
      { id: uid(), patientId: carla, dataHora: at(1, 10), duracaoMin: 30, motivo: 'Manutenção aparelho', status: 'agendada' },
      { id: uid(), patientId: diego, dataHora: at(2, 16), duracaoMin: 60, motivo: 'Avaliação', status: 'agendada' },
      { id: uid(), patientId: elisa, dataHora: at(-3, 8), duracaoMin: 30, motivo: 'Selante', status: 'concluida' },
    ],
  };
}
