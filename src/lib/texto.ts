// Utilitários de texto das questões.
//
// Convenção do projeto: enunciado, alternativas e comentário são gravados como
// TEXTO PURO, com quebras de linha reais ("\n"), e as telas renderizam com
// "whitespace-pre-wrap". Nunca gravar HTML (<br/>) nesses campos.
//
// As funções abaixo existem para (a) tolerar registros antigos que ainda tenham
// <br/> e (b) gerar prévias de uma linha nas listagens.

/**
 * Converte quebras de HTML legado (<br>, <br/>, <BR />) em quebras reais e
 * uniformiza CRLF/CR. Idempotente: texto já normalizado passa intacto.
 */
export function normalizarQuebras(texto: string | null | undefined): string {
  if (!texto) return '';
  return String(texto).replace(/<br\s*\/?>/gi, '\n').replace(/\r\n?/g, '\n');
}

/**
 * Prévia compacta para listagens: sem tags, quebras viram espaço e espaços
 * repetidos são colapsados. Usada onde a quebra de linha não cabe (ex.: lista
 * do acervo), evitando o efeito de palavras coladas.
 */
export function previaTexto(texto: string | null | undefined): string {
  if (!texto) return '';
  return normalizarQuebras(texto)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
