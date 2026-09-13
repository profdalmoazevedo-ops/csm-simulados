"use client";

import { useRef } from "react";
import { Paperclip, X } from "lucide-react";

const LIMITE_IMAGENS = 3;
const LIMITE_MB = 5;

interface AnexadorImagemProps {
  imagens: File[];
  onChange: (imagens: File[]) => void;
}

export default function AnexadorImagem({ imagens, onChange }: AnexadorImagemProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function adicionarArquivos(arquivos: FileList | null) {
    if (!arquivos) return;
    const aceitos = Array.from(arquivos).filter(a => a.type.startsWith("image/"));
    const semDuplicados = aceitos.filter(a => !imagens.some(i => i.name === a.name && i.size === a.size));
    const restantes = imagens.length + semDuplicados.length > LIMITE_IMAGENS
      ? semDuplicados.slice(0, LIMITE_IMAGENS - imagens.length)
      : semDuplicados;
    if (restantes.length === 0) return;
    const validos = restantes.filter(a => a.size <= LIMITE_MB * 1024 * 1024);
    if (validos.length > 0) onChange([...imagens, ...validos]);
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { adicionarArquivos(e.target.files); e.target.value = ""; }}
      />
      {imagens.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {imagens.map((img, i) => (
            <div key={`${img.name}-${i}`} className="relative w-20 h-20 rounded-lg overflow-hidden border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={URL.createObjectURL(img)} alt={img.name} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(imagens.filter((_, j) => j !== i))}
                className="absolute top-0.5 right-0.5 p-1 bg-black/70 text-white rounded-full hover:bg-red-500/80 transition-colors"
                title="Remover imagem"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5"
      >
        <Paperclip className="w-3.5 h-3.5" /> Anexar imagem (opcional)
        <span className="text-zinc-600 normal-case font-medium">· até {LIMITE_IMAGENS}, máx {LIMITE_MB}MB</span>
      </button>
    </div>
  );
}