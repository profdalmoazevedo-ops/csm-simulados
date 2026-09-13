function escapeMarkdown(texto: string): string {
  return texto.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

type TipoAlerta = 'novo' | 'resposta' | 'reabertura';

interface AlertaTelegram {
  tipo: TipoAlerta;
  nome?: string;
  email?: string;
  categoria?: string;
  msg: string;
  questaoId?: string | null;
  imagens?: string[];
}

export async function enviarAlertaTelegram({ tipo, nome, email, categoria, msg, questaoId, imagens }: AlertaTelegram) {
  const token = process.env.NEXT_PUBLIC_BOT_SUPORTE_TOKEN;
  const chatId = process.env.NEXT_PUBLIC_CHAT_ADMIN_ID;
  if (!token || !chatId) return;

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
      `_Acesse o painel admin para responder._`;
  } else if (tipo === 'resposta') {
    textoFormatado =
      `*RESPOSTA DO ALUNO \\(ATENDIMENTO EM ANDAMENTO\\)*\n\n` +
      `*Aluno:* ${nomeFmt}\n` +
      `*Categoria:* ${catFmt}\n` +
      `\n*Resposta:* \n"${msgFmt}"\n\n` +
      `_Acesse o painel admin para verificar._`;
  } else if (tipo === 'reabertura') {
    textoFormatado =
      `*CHAMADO REABERTO PELO ALUNO*\n\n` +
      `*Aluno:* ${nomeFmt}\n` +
      `*Categoria:* ${catFmt}\n` +
      `\n*Motivo da Reabertura:* \n"${msgFmt}"\n\n` +
      `_Acesse o painel admin para verificar._`;
  }

  if (imagens && imagens.length > 0) {
    textoFormatado += `\n\n*Imagens:*\n${imagens.map(u => escapeMarkdown(u)).join('\n')}`;
  }

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: textoFormatado, parse_mode: 'MarkdownV2' }),
    });
  } catch (err) {
    console.error('Falha ao enviar push para o Telegram:', err);
  }
}
