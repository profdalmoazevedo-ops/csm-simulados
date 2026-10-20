import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ids = Array.isArray(body?.ids) ? body.ids : [];

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma questão selecionada para exclusão.", sucesso: [], falhas: [] },
        { status: 400 }
      );
    }

    const idsNumericos = ids
      .map((v: any) => Number(v))
      .filter((v: number) => Number.isFinite(v));

    if (idsNumericos.length === 0) {
      return NextResponse.json(
        { error: "IDs inválidos para exclusão.", sucesso: [], falhas: [] },
        { status: 400 }
      );
    }

    const sucesso: Array<{ id: number }> = [];
    const falhas: Array<{ id: number; motivo: string; raw?: any }> = [];

    // Processa um por um para identificar exatamente qual ID falhou e o motivo detalhado
    for (const id of idsNumericos) {
      try {
        const { error } = await supabase.from("questoes").delete().eq("id", id);

        if (error) {
          console.error(`Erro ao excluir questão #${id}:`, error);

          const mensagemBase =
            "Não foi possível excluir a questão. Provavelmente existem registros vinculados (simulados, respostas de alunos, histórico ou outras tabelas).";

          const detalhes = error.details || null;
          const dica = error.hint || null;

          const motivo = [mensagemBase, detalhes ? `Detalhes: ${detalhes}` : null, dica ? `Dica: ${dica}` : null]
            .filter(Boolean)
            .join("\n");

          falhas.push({
            id,
            motivo,
            raw: {
              code: error.code || null,
              message: error.message || null,
              details: detalhes,
              hint: dica,
            },
          });
          continue;
        }

        sucesso.push({ id });
      } catch (err: any) {
        console.error(`Erro inesperado ao excluir questão #${id}:`, err);
        falhas.push({
          id,
          motivo: `Erro interno ao excluir a questão.\nDetalhes: ${err?.message || String(err)}`,
          raw: {
            message: err?.message || String(err),
            details: err?.message || String(err),
            hint: null,
          },
        });
      }
    }

    const response = {
      total: idsNumericos.length,
      sucesso,
      falhas,
      ok: falhas.length === 0,
    };

    // 207 Multi-Status quando há mistura de sucesso e falha
    if (sucesso.length > 0 && falhas.length > 0) {
      return NextResponse.json(response, { status: 207 });
    }
    if (falhas.length > 0 && sucesso.length === 0) {
      return NextResponse.json(response, { status: 409 });
    }
    return NextResponse.json(response, { status: 200 });
  } catch (err: any) {
    console.error("Erro inesperado na exclusão em lote:", err);
    return NextResponse.json(
      {
        error: "Erro interno ao processar exclusão em lote.",
        sucesso: [],
        falhas: [],
        details: err?.message || String(err),
      },
      { status: 500 }
    );
  }
}