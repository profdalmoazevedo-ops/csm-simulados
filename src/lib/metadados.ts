const VALORES_FALTANTES = new Set([
  'sem cargo definido',
  'sem banca definida',
  'sem órgão definido',
  'sem matéria definida',
  'sem tópico definido',
  'nd',
  'n/d',
  'não identificado',
  'nao identificado',
  'não informado',
  'nao informado',
  'acervo geral',
  'diversos',
  ''
]);

export function ehCampoFaltante(valor: string | null | undefined): boolean {
  if (valor === null || valor === undefined) return true;
  return VALORES_FALTANTES.has(String(valor).trim().toLowerCase());
}