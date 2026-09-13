import { NextResponse } from "next/server";
import { enviarAlertaTelegram, type AlertaTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: AlertaTelegram;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  if (!payload || typeof payload.msg !== "string") {
    return NextResponse.json({ ok: false, error: "Payload inválido" }, { status: 400 });
  }

  const resultado = await enviarAlertaTelegram(payload);
  if (!resultado.ok) {
    console.error(
      "Falha ao enviar alerta Telegram:",
      resultado.status,
      resultado.description,
    );
    return NextResponse.json({ ok: false, status: resultado.status, error: resultado.description }, { status: 502 });
  }

  return NextResponse.json({ ok: true, messageId: resultado.messageId });
}