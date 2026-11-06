export type ID = string;

export interface Patient {
  id: ID;
  nome: string;
  telefone: string;
  email?: string;
  dataNascimento?: string; // YYYY-MM-DD
  cpf?: string;
  endereco?: string;
  alergias?: string;
  observacoes?: string;
  criadoEm: string;
}

export type ProcedureStatus = 'planejado' | 'em_andamento' | 'realizado';

export interface Procedure {
  id: ID;
  patientId: ID;
  dente: number | null; // número FDI; null = procedimento geral (ex.: limpeza)
  faces?: string[]; // M, D, O/I, V, L/P
  tipo: string;
  status: ProcedureStatus;
  data: string; // YYYY-MM-DD
  descricao?: string;
  valor?: number;
  retorno?: string; // YYYY-MM-DD
}

export interface Exam {
  id: ID;
  patientId: ID;
  dentes: number[];
  tipo: string;
  data: string;
  descricao?: string;
  imagens: string[]; // data URLs
}

export type AppointmentStatus = 'agendada' | 'confirmada' | 'concluida' | 'faltou' | 'cancelada';

export interface Appointment {
  id: ID;
  patientId: ID;
  dataHora: string; // YYYY-MM-DDTHH:mm
  duracaoMin: number;
  motivo: string;
  status: AppointmentStatus;
  observacoes?: string;
}

export interface Settings {
  nomeClinica: string;
  nomeDentista: string;
  telefoneClinica: string;
  endereco: string;
  templateAniversario: string;
  templateLembrete: string;
  templateRetorno: string;
}

export interface SentMessage {
  key: string; // ex.: aniv:<patientId>:<ano> | lembrete:<appointmentId> | retorno:<procedureId>
  em: string;
}

export interface Database {
  versao: number;
  patients: Patient[];
  procedures: Procedure[];
  exams: Exam[];
  appointments: Appointment[];
  settings: Settings;
  sent: SentMessage[];
}
