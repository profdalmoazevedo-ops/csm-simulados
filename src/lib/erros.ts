// Extrai uma mensagem legível de um erro desconhecido, sem usar `any`.
// Erros de fetch/Supabase/IA chegam como Error, mas respostas de API
// externas podem ser strings ou objetos soltos.
export function mensagemDeErro(erro: unknown): string {
  if (erro instanceof Error) return erro.message;
  if (typeof erro === 'string') return erro;
  if (erro && typeof erro === 'object' && 'message' in erro) {
    const { message } = erro as { message: unknown };
    if (typeof message === 'string') return message;
  }
  return 'Erro desconhecido.';
}
