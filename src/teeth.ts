// Numeração FDI (padrão no Brasil).
// 1º dígito = quadrante: 1 sup. direito, 2 sup. esquerdo, 3 inf. esquerdo, 4 inf. direito
// (decíduos: 5, 6, 7, 8). 2º dígito = posição a partir do meio (1 = incisivo central).

export type ToothKind = 'incisivo-central' | 'incisivo-lateral' | 'canino' | 'pre-molar' | 'molar';

const PERM_NAMES: Record<number, [ToothKind, string]> = {
  1: ['incisivo-central', 'Incisivo central'],
  2: ['incisivo-lateral', 'Incisivo lateral'],
  3: ['canino', 'Canino'],
  4: ['pre-molar', '1º pré-molar'],
  5: ['pre-molar', '2º pré-molar'],
  6: ['molar', '1º molar'],
  7: ['molar', '2º molar'],
  8: ['molar', '3º molar (siso)'],
};

const DEC_NAMES: Record<number, [ToothKind, string]> = {
  1: ['incisivo-central', 'Incisivo central decíduo'],
  2: ['incisivo-lateral', 'Incisivo lateral decíduo'],
  3: ['canino', 'Canino decíduo'],
  4: ['molar', '1º molar decíduo'],
  5: ['molar', '2º molar decíduo'],
};

const QUADRANT: Record<number, string> = {
  1: 'superior direito',
  2: 'superior esquerdo',
  3: 'inferior esquerdo',
  4: 'inferior direito',
  5: 'superior direito',
  6: 'superior esquerdo',
  7: 'inferior esquerdo',
  8: 'inferior direito',
};

export function toothInfo(n: number): { kind: ToothKind; nome: string; completo: string } {
  const q = Math.floor(n / 10);
  const p = n % 10;
  const table = q >= 5 ? DEC_NAMES : PERM_NAMES;
  const [kind, nome] = table[p] ?? ['molar', 'Dente'];
  return { kind, nome, completo: `${nome} ${QUADRANT[q] ?? ''}`.trim() };
}

/** Dentes na ordem da tela (visão do dentista: lado direito do paciente à esquerda). */
export function archTeeth(decidua: boolean): { superior: number[]; inferior: number[] } {
  if (decidua) {
    return {
      superior: [55, 54, 53, 52, 51, 61, 62, 63, 64, 65],
      inferior: [85, 84, 83, 82, 81, 71, 72, 73, 74, 75],
    };
  }
  return {
    superior: [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
    inferior: [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
  };
}

export const ALL_TEETH = [
  ...archTeeth(false).superior,
  ...archTeeth(false).inferior,
  ...archTeeth(true).superior,
  ...archTeeth(true).inferior,
];

export const FACES = [
  { id: 'M', nome: 'Mesial' },
  { id: 'D', nome: 'Distal' },
  { id: 'O', nome: 'Oclusal/Incisal' },
  { id: 'V', nome: 'Vestibular' },
  { id: 'L', nome: 'Lingual/Palatina' },
];

export const PROCEDURE_TYPES = [
  'Avaliação',
  'Restauração',
  'Tratamento de canal',
  'Extração',
  'Coroa / Prótese',
  'Implante',
  'Selante',
  'Clareamento',
  'Limpeza / Profilaxia',
  'Raspagem',
  'Cárie (diagnóstico)',
  'Fratura',
  'Aparelho / Ortodontia',
  'Outro',
];

export const EXAM_TYPES = [
  'Raio-X periapical',
  'Raio-X interproximal (bite-wing)',
  'Radiografia panorâmica',
  'Tomografia',
  'Foto intraoral',
  'Outro',
];
