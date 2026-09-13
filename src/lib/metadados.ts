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

export function extrairTrechoBusca(enunciado: string | null | undefined, maxLen = 100): string {
  const limpo = (enunciado || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (limpo.length <= maxLen) return limpo;
  const corte = limpo.lastIndexOf(' ', maxLen);
  return corte > 40 ? limpo.slice(0, corte) : limpo.slice(0, maxLen);
}

export function limparLinksMarkdown(texto: string): string {
  return texto.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
}

export function dividirProvaParaOrgaoCargo(prova: string): { orgao: string; cargo: string } {
  const semAno = prova.replace(/\s*[-–]\s*\d{4}\s*$/i, '').trim();
  const partes = semAno.split(/\s*[-–]\s*/).map(p => p.trim()).filter(Boolean);
  if (partes.length === 0) return { orgao: '', cargo: '' };
  const orgao = partes.length > 1 ? partes[1] : '';
  const cargo = partes.length > 2 ? partes.slice(2).join(' - ') : '';
  return { orgao, cargo };
}