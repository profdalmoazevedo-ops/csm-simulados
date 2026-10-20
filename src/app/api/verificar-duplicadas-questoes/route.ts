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
  if (limpo.length <= 160) return limpo;
  return limpo.slice(0, 157) + "...";
}

interface QuestaoRow {
  id: number;
  enunciado: string | null;
  banca: string | null;
  orgao: string | null;
  cargo: string | null;
  materia: string | null;
  ano: number | null;
}

interface GrupoDuplicado {
  chave: string;
  textoReferencia: string;
  ids: Set<number>;
  questoes: QuestaoRow[];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const limite = body?.limite && typeof body.limite === "number" ? body.limite : 500;

    const { data, error } = await supabase
      .from("questoes")
      .select("id, enunciado, banca, orgao, cargo, materia, ano")
      .order("id", { ascending: true });

    if (error) {
      console.error("Erro ao buscar questões:", error);
      return NextResponse.json({ error: "Erro ao consultar o banco de dados." }, { status: 500 });
    }

    const questoes = (data || []) as QuestaoRow[];
    if (questoes.length === 0) {
      return NextResponse.json({ totalDuplicadasEncontradas: 0, totalQuestoesAnalisadas: 0, duplicadas: [] });
    }

    const gruposMap = new Map<string, GrupoDuplicado>();

    for (const q of questoes) {
      const chave = normalizarEnunciado(q.enunciado);
      if (chave.length === 0) continue;

      if (!gruposMap.has(chave)) {
        gruposMap.set(chave, {
          chave,
          textoReferencia: extrairTextoReferencia(q.enunciado),
          ids: new Set<number>(),
          questoes: [],
        });
      }
      const grupo = gruposMap.get(chave)!;
      grupo.ids.add(q.id);
      grupo.questoes.push(q);
    }

    const duplicadasAgrupadas = Array.from(gruposMap.values())
      .filter((grupo) => grupo.ids.size >= 2)
      .sort((a, b) => {
        if (b.ids.size !== a.ids.size) return b.ids.size - a.ids.size;
        return a.textoReferencia.localeCompare(b.textoReferencia);
      })
      .slice(0, limite);

    const duplicadas = duplicadasAgrupadas.map((grupo) => ({
      textoReferencia: grupo.textoReferencia,
      quantidade: grupo.ids.size,
      ids: Array.from(grupo.ids).sort((x, y) => x - y),
      questoes: grupo.questoes
        .slice()
        .sort((x, y) => x.id - y.id)
        .map((q) => ({
          id: q.id,
          banca: q.banca,
          orgao: q.orgao,
          cargo: q.cargo,
          materia: q.materia,
          ano: q.ano,
        })),
    }));

    return NextResponse.json({
      totalDuplicadasEncontradas: duplicadasAgrupadas.length,
      totalQuestoesAnalisadas: questoes.length,
      duplicadas,
    });
  } catch (error) {
    console.error("Erro na verificação de duplicadas do banco:", error);
    return NextResponse.json({ error: "Erro interno ao processar a solicitação." }, { status: 500 });
  }
}
