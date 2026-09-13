export type TentativaResumo = {
  simulado_id: string;
  numero_tentativa: number | null;
  total_acertos: number;
  total_questoes: number;
  data_conclusao: string;
};