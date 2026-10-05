"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Megaphone, ArrowRight, ExternalLink } from "lucide-react";

type Aviso = {
  id: string;
  titulo: string;
  mensagem: string;
  link_url: string | null;
  criado_em: string;
};

const LIMITE_AVISOS = 3;

const formatarData = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });

// Mural de novidades da plataforma. Lê a mesma tabela `notificacoes` que o sino
// da navbar usa, mas restrito a tipo = 'painel_alert', que é o que a Central de
// Notificações (/admin/notificacoes) grava nos avisos do professor.
//
// O filtro é o que separa este mural dos outros tipos que dividem a tabela:
//   - 'suporte'  → resposta de suporte, pessoal (admin/suporte)
//   - 'simulado' → "Novo Simulado Disponível", pessoal
// Nenhum dos dois deve aparecer como novidade pública do site.
//
// Não grava em `notificacoes_lidas` de propósito: é só exibição, e mexer na
// leitura aqui interferiria na contagem de não-lidas do sino.
export default function MuralAvisos() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    (async () => {
      const { data, error } = await supabase
        .from("notificacoes")
        .select("id, titulo, mensagem, link_url, criado_em")
        .eq("tipo", "painel_alert")
        .is("aluno_id", null)
        .order("criado_em", { ascending: false })
        .limit(LIMITE_AVISOS);

      if (!ativo) return;
      if (error) console.error("Erro ao carregar mural de avisos:", error);

      setAvisos(data || []);
      setCarregando(false);
    })();

    return () => { ativo = false; };
  }, []);

  if (carregando || avisos.length === 0) return null;

  const [destaque, ...restantes] = avisos;

  return (
    <div className="mb-16">
      <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6">
        Novidades na Plataforma
      </h2>

      {/* Aviso mais recente, em destaque */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-[#131c2f]/30 p-8 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Megaphone className="w-6 h-6" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md border border-emerald-500/20">
                Novidade
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                {formatarData(destaque.criado_em)}
              </span>
            </div>
            <h3 className="text-white font-bold text-lg leading-snug">{destaque.titulo}</h3>
            <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap mt-2">
              {destaque.mensagem}
            </p>
          </div>

          {destaque.link_url && (
            <Link
              href={destaque.link_url}
              className="shrink-0 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-black font-black uppercase tracking-widest text-xs px-6 py-4 rounded-xl transition-colors"
            >
              Ver Novidade <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Avisos anteriores, em lista compacta */}
      {restantes.length > 0 && (
        <div className="bg-[#131c2f]/30 border border-white/5 rounded-3xl divide-y divide-white/5">
          {restantes.map((aviso) => (
            <div key={aviso.id} className="p-6 flex flex-col md:flex-row md:items-center gap-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 md:w-24 shrink-0">
                {formatarData(aviso.criado_em)}
              </span>

              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white">{aviso.titulo}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap mt-1">
                  {aviso.mensagem}
                </p>
              </div>

              {aviso.link_url && (
                <Link
                  href={aviso.link_url}
                  className="shrink-0 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-500 hover:text-emerald-400 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Acessar
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}