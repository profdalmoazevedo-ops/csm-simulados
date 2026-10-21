// Tipos do acervo. Derivados do schema real do Supabase (OpenAPI), nao de
// suposicoes: questoes.id e UUID, e varias colunas sao nulaveis.
export type TentativaResumo = {
  id?: number;
  aluno_id: string;
  simulado_id: string;
  numero_tentativa: number | null;
  total_acertos: number;
  total_questoes: number;
  data_conclusao: string;
  simulados: { titulo: string } | null;
};

export type EstatisticasAluno = {
  aluno_id: string;
  questoes_resolvidas: number;
  acertos_totais: number;
  sequencia_dias: number;
  ultima_atividade: string | null;
  nivel_atual: string | null;
};

// Projecao da tela de alunos: dados de usuarios mesclados com
// estatisticas_alunos.
export type AlunoAdmin = {
  id: string;
  nome: string;
  email: string;
  nivel: string;
  questoes_resolvidas: number;
  precisao: number;
  ultima_atividade: string | null;
};

export type Notificacao = {
  id: string;
  criado_em: string;
  titulo: string;
  mensagem: string;
  link_url: string;
  aluno_id: string;
  tipo: string;
  publico_alvo: string;
};

// Publico de uma notificacao (coluna texto no banco, dominio fechado na UI).
export type PublicoAlvo = 'todos' | 'assinantes';

export type Questao = {
  id: string;
  banca: string;
  tipo_questao: string;
  materia: string;
  enunciado: string;
  alternativa_a: string | null;
  alternativa_b: string | null;
  alternativa_c: string | null;
  alternativa_d: string | null;
  alternativa_e: string | null;
  gabarito: string;
  comentario_gabarito: string | null;
  criado_em: string;
  ano: number | null;
  orgao: string | null;
  topico: string | null;
  dificuldade: number | null;
  cargo: string | null;
};

export type Simulado = {
  id: string;
  titulo: string;
  data_liberacao: string;
  tipo: string;
  regra_subtracao: boolean;
  criado_por: string | null;
  criado_em: string;
  pdf_url: string | null;
  e_gratis: boolean;
  visivel: boolean;
  numero_semana: number | null;
  disciplina_foco: string | null;
  url_mentoria_cirurgica: string | null;
  url_caderno_sobrevivencia: string | null;
  data_liberacao_mentoria: string | null;
  data_liberacao_caderno: string | null;
  conteudo_caderno: string | null;
  ciclo_numero: number | null;
  notificado_simulado: boolean;
  notificado_mentoria: boolean;
  notificado_caderno: boolean;
  url_slides: string | null;
  ciclo_nome: string | null;
};

// Projecao de simulados usada na listagem.
// descricao nao existe na tabela (a busca por ela nunca casou), mas o campo e
// lido no filtro: fica opcional para nao mudar o comportamento em runtime.
export type SimuladoLista = Omit<Simulado, 'descricao'> & {
  descricao?: string | null;
};

// Simulado com o status calculado a partir das tentativas do aluno.
export type SimuladoComStatus = Simulado & {
  status: string;
  tentativas: TentativaResumo[];
  simulado_questoes: { count: number }[];
};

// Simulados com o status, na projecao enxuta usada no historico do gerador.
export type SimuladoHistorico = Pick<Simulado, 'id' | 'titulo' | 'criado_em'> & {
  status: string;
  tentativas: TentativaResumo[];
  simulado_questoes: { count: number }[];
};

export type ChamadoSuporte = {
  id: string;
  criado_em: string;
  aluno_id: string;
  nome: string;
  email: string;
  categoria: string;
  mensagem: string;
  questao_id: string | null;
  status: string;
  resposta_admin: string | null;
};

export type RespostaAluno = {
  id: string;
  aluno_id: string;
  simulado_id: string;
  questao_id: string;
  alternativa_marcada: string | null;
  foi_correta: boolean;
  respondido_em: string;
  tentativa_id: number | null;
};

export type VinculoSimuladoQuestao = {
  id: string;
  simulado_id: string;
  questao_id: string;
  ordem: number;
};

// Chave dinamica das alternativas (alternativa_a .. alternativa_e).
export type AlternativaKey = 'alternativa_a' | 'alternativa_b' | 'alternativa_c' | 'alternativa_d' | 'alternativa_e';

// Projecao resumida de questao, usada nas listas e buscas.
export type QuestaoResumoTabela = {
  id: string;
  banca: string | null;
  orgao: string | null;
  cargo: string | null;
  ano: number | null;
  materia: string | null;
  topico: string | null;
  enunciado: string | null;
  tipo_questao: string | null;
};

// Projecao parcial: queries que selecionam apenas algumas colunas.
export type QuestaoResumida = Pick<
  Questao,
  'id' | 'enunciado' | 'banca' | 'ano' | 'materia' | 'orgao' | 'cargo'
>;

export type QuestaoComOrdem = Partial<Questao> & { ordem: number };

// Vinculo de questao com simulado, ja com a questao embutida (embed 1:1 do
// Supabase devolve um objeto unico, mas o tipo gerado infere array).
// `questoes` aceita o array porque e assim que o cliente do Supabase tipa o
// embed; use normalizarVinculos() para normalizar.
export type VinculoComQuestao = {
  id: string;
  ordem: number;
  questao_id: string;
  questoes: QuestaoResumoTabela | QuestaoResumoTabela[] | null;
};

// Versao ja normalizada (objeto unico), para uso no JSX.
export type VinculoNormalizado = {
  id: string;
  ordem: number;
  questao_id: string;
  questoes: QuestaoResumoTabela | null;
};

// O cliente do Supabase infere o embed 1:1 como array; o banco devolve objeto.
export function comoVinculo<T>(dados: unknown): T | null {
  if (!dados) return null;
  const lista = Array.isArray(dados) ? dados : [dados];
  return (lista[0] as T) ?? null;
}

export function comoVinculos<T>(dados: unknown): T[] {
  if (!dados) return [];
  return (Array.isArray(dados) ? dados : [dados]) as T[];
}

// Normaliza os vinculos de simulado: o embed "questoes" volta como array no
// tipo inferido, mas o banco devolve o objeto.
export function normalizarVinculos(vinculos: VinculoComQuestao[]): VinculoNormalizado[] {
  return vinculos.map((v) => ({
    id: v.id,
    ordem: v.ordem,
    questao_id: v.questao_id,
    questoes: comoVinculo<QuestaoResumoTabela>(v.questoes),
  }));
}
