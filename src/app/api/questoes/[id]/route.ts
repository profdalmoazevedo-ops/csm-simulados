import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
  try {
    let idStr: string;
    if (context.params instanceof Promise) {
      const p = await context.params;
      idStr = p.id;
    } else {
      idStr = (context.params as any).id;
    }
    const id = Number(idStr);

    if (!Number.isFinite(id) || isNaN(id)) {
      return NextResponse.json(
        { error: "ID da questão inválido.", details: idStr, hint: null },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("questoes").delete().eq("id", id);

    if (error) {
      console.error("Erro ao excluir questão:", error);

      const mensagemBase =
        "Não foi possível excluir a questão. Provavelmente existem registros vinculados (simulados, respostas de alunos, histórico ou outras tabelas).";

      const detalhes = error.details || null;
      const dica = error.hint || null;

      const mensagemCompleta = [mensagemBase, detalhes ? `Detalhes: ${detalhes}` : null, dica ? `Dica: ${dica}` : null]
        .filter(Boolean)
        .join("\n");

      const isFk = error.code === "23503" || /foreign key/i.test(error.message || "");

      return NextResponse.json(
        {
          error: mensagemCompleta,
          details: detalhes,
          hint: dica,
          code: error.code || null,
          rawMessage: error.message || null,
        },
        { status: isFk ? 409 : 500 }
      );
    }

    return NextResponse.json({ ok: true, id }, { status: 200 });
  } catch (err: any) {
    console.error("Erro inesperado ao excluir questão:", err);
    return NextResponse.json(
      {
        error: "Erro interno ao excluir a questão.",
        details: err?.message || String(err),
        hint: null,
        rawMessage: err?.message || String(err),
      },
      { status: 500 }
    );
  }
}