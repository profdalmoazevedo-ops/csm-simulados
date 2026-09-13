function escapeMarkdown(texto: string): string {
  return texto.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

type TipoAlerta = 'novo' | 'resposta' | 'reabertura';

export interface AlertaTelegram {
  tipo: TipoAlerta;
  nome?: string;
  email?: string;
  categoria?: string;
  msg: string;
  questaoId?: string | null;
  imagens?: string[];
}

interface ResultadoTelegram {
  ok: boolean;
  status?: number;
  description?: string;
  messageId?: number;
}

function montarTexto({ tipo, nome, email, categoria, msg, questaoId, imagens }: AlertaTelegram): string {
  const nomeFmt = nome ? escapeMarkdown(nome) : '';
  const emailFmt = email ? escapeMarkdown(email) : '';
  const catFmt = categoria ? escapeMarkdown(categoria) : '';
  const msgFmt = escapeMarkdown(msg);
  const qIdFmt = questaoId ? escapeMarkdown(questaoId) : '';

  let textoFormatado = '';

  if (tipo === 'novo') {
    textoFormatado =
      `*NOVO CHAMADO DE SUPORTE*\n\n` +
      `*Aluno:* ${nomeFmt}\n` +
      `*E\\-mail:* ${emailFmt}\n` +
      `*Categoria:* ${catFmt}\n` +
      (qIdFmt ? `*ID da Questao:* ${qIdFmt}\n` : '') +
      `\n*Mensagem:* \n"${msgFmt}"\n\n` +
      `_Acesse o painel admin para responder_\\.`;
  } else if (tipo === 'resposta') {
    textoFormatado =
      `*RESPOSTA DO ALUNO \\(ATENDIMENTO EM ANDAMENTO\\)*\n\n` +
      `*Aluno:* ${nomeFmt}\n` +
      `*Categoria:* ${catFmt}\n` +
      `\n*Resposta:* \n"${msgFmt}"\n\n` +
      `_Acesse o painel admin para verificar_\\.`;
  } else if (tipo === 'reabertura') {
    textoFormatado =
      `*CHAMADO REABERTO PELO ALUNO*\n\n` +
      `*Aluno:* ${nomeFmt}\n` +
      `*Categoria:* ${catFmt}\n` +
      `\n*Motivo da Reabertura:* \n"${msgFmt}"\n\n` +
      `_Acesse o painel admin para verificar_\\.`;
  }

  if (imagens && imagens.length > 0) {
    textoFormatado += `\n\n*Imagens:*\n${imagens.map(u => escapeMarkdown(u)).join('\n')}`;
  }

  return textoFormatado;
}

export async function enviarAlertaTelegram(alerta: AlertaTelegram): Promise<ResultadoTelegram> {
  const token = process.env.NEXT_PUBLIC_BOT_SUPORTE_TOKEN;
  const chatId = process.env.NEXT_PUBLIC_CHAT_ADMIN_ID;
  if (!token || !chatId) {
    console.error('Alerta Telegram ignorado: variáveis NEXT_PUBLIC_BOT_SUPORTE_TOKEN / NEXT_PUBLIC_CHAT_ADMIN_ID ausentes.');
    return { ok: false, description: 'variáveis de ambiente ausentes' };
  }

  const textoFormatado = montarTexto(alerta);
  const resultado: ResultadoTelegram = { ok: false };

  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: textoFormatado, parse_mode: 'MarkdownV2' }),
    });

    const json = await resp.json().catch(() => null);
    resultado.status = resp.status;
    resultado.description = json?.description;
    resultado.messageId = json?.result?.message_id;
    resultado.ok = !!json?.ok;

    if (!resultado.ok) {
      console.error(`Alerta Telegram retornou ${resp.status}:`, json?.description);
    }
  } catch (err) {
    console.error('Falha ao enviar push para o Telegram:', err);
  }

  return resultado;
}

export async function dispararAlertaSuporte(alerta: AlertaTelegram): Promise<boolean> {
  try {
    const resp = await fetch('/api/telegram-alerta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alerta),
    });
    if (!resp.ok) {
      const detalhe = await resp.json().catch(() => null);
      console.error('Alerta Telegram falhou:', resp.status, detalhe?.status || '' );
      return false;
    }
    return true;
  } catch (err) {
    console.error('Alerta Telegram falhou:', err);
    return false;
  }
}