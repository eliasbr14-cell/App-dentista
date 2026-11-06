export type ID = string;

export type Role = 'master' | 'admin' | 'dentista' | 'recepcao';

export interface Profile {
  id: ID;
  clinicId?: ID;
  nome: string;
  email?: string;
  role: Role;
  cro?: string;
  ativo: boolean;
  criadoEm: string;
}

export interface Clinic {
  id: ID;
  nome: string;
  ativo: boolean;
  plano: string;
  mensalidade?: number;
  vencimento?: string;
  settings: Partial<Settings>;
  criadoEm: string;
}

export interface Patient {
  id: ID;
  clinicId?: ID;
  dentistaId?: ID;
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
  clinicId?: ID;
  dentistaId?: ID;
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
  clinicId?: ID;
  patientId: ID;
  dentes: number[];
  tipo: string;
  data: string;
  descricao?: string;
  imagens: string[]; // caminhos no storage (ou data URLs antigas)
}

export type AppointmentStatus = 'agendada' | 'confirmada' | 'concluida' | 'faltou' | 'cancelada';

export interface Appointment {
  id: ID;
  clinicId?: ID;
  dentistaId?: ID;
  patientId: ID;
  dataHora: string; // YYYY-MM-DDTHH:mm(:ss) horário local
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
  profiles: Profile[];
  patients: Patient[];
  procedures: Procedure[];
  exams: Exam[];
  appointments: Appointment[];
  settings: Settings;
  sent: SentMessage[];
}
