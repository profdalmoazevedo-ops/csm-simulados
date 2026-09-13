"use client";

interface ParteMensagem {
  tipo: 'texto' | 'imagem';
  conteudo: string;
}

function quebrarMensagem(texto: string): ParteMensagem[] {
  const partes = texto.split(/(\[IMAGEM\]\s*\n+https?:\/\/\S+)/g);
  const resultado: ParteMensagem[] = [];
  for (const parte of partes) {
    if (!parte) continue;
    const match = parte.match(/^\[IMAGEM\]\s*\n+(https?:\/\/\S+)$/);
    if (match) {
      resultado.push({ tipo: 'imagem', conteudo: match[1] });
    } else {
      resultado.push({ tipo: 'texto', conteudo: parte });
    }
  }
  return resultado;
}

export default function MensagemComImagens({ texto }: { texto: string }) {
  const partes = quebrarMensagem(texto);
  if (partes.length === 0) return null;

  return (
    <div className="space-y-3">
      {partes.map((p, i) =>
        p.tipo === 'imagem' ? (
          <a key={`img-${i}`} href={p.conteudo} target="_blank" rel="noreferrer" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.conteudo}
              alt="Anexo do chamado"
              loading="lazy"
              className="max-w-full max-h-72 rounded-xl border border-white/10"
            />
          </a>
        ) : (
          p.conteudo && (
            <p key={`txt-${i}`} className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
              {p.conteudo}
            </p>
          )
        )
      )}
    </div>
  );
}