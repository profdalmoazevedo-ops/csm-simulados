import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function normalizarEnunciado(texto: string | null | undefined): string {
  if (!texto) return "";
  const semTags = texto
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?p>/gi, " ")
    .replace(/<\/?div>/gi, " ")
    .replace(/<\/?strong>/gi, " ")
    .replace(/<\/?b>/gi, " ")
    .replace(/<\/?i>/gi, " ")
    .replace(/<\/?u>/gi, " ")
    .replace(/<\/?span[^>]*>/gi, " ")
    .replace(/<\/span>/gi, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
  return semTags.replace(/\s+/g, " ").trim().toLowerCase();
}

function extrairTextoReferencia(texto: string | null | undefined): string {
  if (!texto) return "";
  const limpo = texto
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (limpo.length <= 140) return limpo;
  return limpo.slice(0, 137) + "...";
}

interface QuestaoVinculada {
  simulado_id: string;
  questao_id: string;
  questoes: {
    id: string;
    enunciado: string | null;
    banca: string | null;
    ano: number | null;
  } | null;
}

interface GrupoDuplicado {
  chave: string;
  textoReferencia: string;
  banca: string | null;
  ano: number | null;
  ids: Set<string>;
  simulados: Set<string>;
  questoes: Array<{ id: string; simulado_id: string }>;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const simuladosIds = body?.simuladosIds;
    if (!Array.isArray(simuladosIds) || simuladosIds.length < 2) {
      return NextResponse.json({ error: "Selecione pelo menos 2 simulados para comparar." }, { status: 400 });
    }
    const { data, error } = await supabase
      .from("simulado_questoes")
      .select(`simulado_id, questao_id, questoes (id, enunciado, banca, ano)`)
      .in("simulado_id", simuladosIds);
    if (error) {
      console.error("Erro ao buscar questões dos simulados:", error);
      return NextResponse.json({ error: "Erro ao consultar o banco de dados." }, { status: 500 });
    }
    const raw = (data || []) as any[];
    const registros: QuestaoVinculada[] = raw.map((r) => ({
      simulado_id: r.simulado_id,
      questao_id: r.questao_id,
      questoes: Array.isArray(r.questoes) ? r.questoes[0] ?? null : r.questoes,
    }));
    if (registros.length === 0) {
      return NextResponse.json({ totalDuplicadasEncontradas: 0, duplicadas: [] });
    }
    const gruposMap = new Map<string, GrupoDuplicado>();
    for (const registro of registros) {
      const questao = registro.questoes;
      if (!questao) continue;
      const chave = normalizarEnunciado(questao.enunciado);
      if (chave.length === 0) continue;
      if (!gruposMap.has(chave)) {
        gruposMap.set(chave, {
          chave,
          textoReferencia: extrairTextoReferencia(questao.enunciado),
          banca: questao.banca,
          ano: questao.ano,
          ids: new Set<string>(),
          simulados: new Set<string>(),
          questoes: [],
        });
      }
      const grupo = gruposMap.get(chave)!;
      if (!grupo.banca && questao.banca) grupo.banca = questao.banca;
      if (grupo.ano === null && questao.ano !== null) grupo.ano = questao.ano;
      grupo.ids.add(questao.id);
      grupo.simulados.add(registro.simulado_id);
      grupo.questoes.push({ id: questao.id, simulado_id: registro.simulado_id });
    }
    const duplicadasAgrupadas = Array.from(gruposMap.values()).filter((grupo) => {
      if (grupo.ids.size >= 2) return true;
      if (grupo.simulados.size >= 2) return true;
      if (grupo.questoes.length >= 2) return true;
      return false;
    });
    duplicadasAgrupadas.sort((a, b) => {
      if (b.simulados.size !== a.simulados.size) return b.simulados.size - a.simulados.size;
      if (b.ids.size !== a.ids.size) return b.ids.size - a.ids.size;
      return a.textoReferencia.localeCompare(b.textoReferencia);
    });
    const duplicadas = duplicadasAgrupadas.map((grupo) => ({
      textoReferencia: grupo.textoReferencia,
      banca: grupo.banca,
      ano: grupo.ano,
      ids: Array.from(grupo.ids).sort(),
      simulados: Array.from(grupo.simulados).sort(),
    }));
    return NextResponse.json({ totalDuplicadasEncontradas: duplicadas.length, duplicadas });
  } catch (error) {
    console.error("Erro na verificação de duplicadas:", error);
    return NextResponse.json({ error: "Erro interno ao processar a solicitação." }, { status: 500 });
  }
}
