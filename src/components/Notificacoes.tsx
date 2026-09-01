"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Bell, ExternalLink } from "lucide-react";
import Link from "next/link";

interface Notificacao {
  id: string;
  criado_em: string;
  titulo: string;
  mensagem: string;
  link_url: string | null;
  aluno_id: string | null;
  tipo: string | null;
  publico_alvo: string | null;
}

export default function ComponenteNotificacoes() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [naoLidasCount, setNaoLidasCount] = useState(0);
  const [menuAberto, setMenuAberto] = useState(false);
  const [alunoId, setAlunoId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inicializarNotificacoes();

    function cliqueFora(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setMenuAberto(false);
      }
    }
    document.addEventListener("mousedown", cliqueFora);
    return () => document.removeEventListener("mousedown", cliqueFora);
  }, []);

  async function inicializarNotificacoes() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      
      const userId = session.user.id;
      const userEmail = session.user.email;
      setAlunoId(userId);
      
      const emailAdmin = "profdalmoazevedo@gmail.com";
      const isAdmin = userEmail === emailAdmin;

      // 1. Puxa as notificações
      const { data: todasNotif } = await supabase
        .from("notificacoes")
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(50); // Limite de segurança para não pesar o client-side

      if (!todasNotif) return;

      // 2. Filtro de Exibição Baseado no Banco de Dados
      const notificacoesFiltradas = todasNotif.filter(n => {
        if (isAdmin) {
          // Admin vê avisos do sistema, alertas administrativos ou chamados
          return n.tipo === 'admin_alert' || n.titulo.includes("NOVO SUPORTE") || !n.aluno_id;
        } else {
          // Aluno vê notificações direcionadas a ele (aluno_id) ou globais (aluno_id null / publico_alvo 'todos')
          return n.aluno_id === userId || !n.aluno_id || n.publico_alvo === 'todos';
        }
      });

      // 3. Verifica quais notificações já foram lidas por este usuário
      const { data: lidasNotif } = await supabase
        .from("notificacoes_lidas")
        .select("notificacao_id")
        .eq("aluno_id", userId);

      const idsLidas = new Set(lidasNotif?.map(l => l.notificacao_id) || []);

      setNotificacoes(notificacoesFiltradas);
      setNaoLidasCount(notificacoesFiltradas.filter(n => !idsLidas.has(n.id)).length);

    } catch (err) {
      console.error("Erro ao carregar notificações:", err);
    }
  }

  async function abrirMenuEMarcarComoLidas() {
    setMenuAberto(!menuAberto);

    if (!menuAberto && naoLidasCount > 0 && alunoId) {
      // 1. Busca novamente o que já foi lido para evitar duplicação
      const { data: lidasAgora } = await supabase
        .from("notificacoes_lidas")
        .select("notificacao_id")
        .eq("aluno_id", alunoId);

      const idsLidas = new Set(lidasAgora?.map(l => l.notificacao_id) || []);
      const naoLidas = notificacoes.filter(n => !idsLidas.has(n.id));

      const registrosLeitura = naoLidas.map(n => ({
        notificacao_id: n.id,
        aluno_id: alunoId
      }));

      if (registrosLeitura.length > 0) {
        const { error } = await supabase.from("notificacoes_lidas").insert(registrosLeitura);
        if (!error) {
          setNaoLidasCount(0); // Zera a notificação imediatamente
        }
      }
    }
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      
      {/* BOTÃO DO SINO */}
      <button
        onClick={abrirMenuEMarcarComoLidas}
        className="relative p-2.5 text-zinc-400 hover:text-white rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-pointer focus:outline-none"
        title="Notificações"
      >
        <Bell className="w-5 h-5" />

        {/* BOLINHA VERMELHA INDICADORA */}
        {naoLidasCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white shadow-lg ring-2 ring-[#09090b] animate-bounce">
            {naoLidasCount > 99 ? '99+' : naoLidasCount}
          </span>
        )}
      </button>

      {/* DROP-DOWN FLUTUANTE DE AVISOS */}
      {menuAberto && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl border border-white/10 bg-[#131c2f] p-2 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          
          <div className="px-4 py-3 border-b border-white/5 flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
              Central de Avisos
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-md">
              Plataforma
            </span>
          </div>

          <div className="mt-1 max-h-[350px] overflow-y-auto divide-y divide-white/5 custom-scrollbar">
            {notificacoes.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center gap-2">
                <Bell className="w-6 h-6 text-zinc-600 opacity-50" />
                <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">
                  Nenhum aviso no momento
                </p>
              </div>
            ) : (
              notificacoes.map((notif) => (
                <div key={notif.id} className="p-4 hover:bg-white/5 transition-colors space-y-2 group">
                  <div className="flex justify-between items-start gap-3">
                    <h4 className="text-xs font-bold text-white leading-tight">
                      {notif.titulo}
                    </h4>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 shrink-0 mt-0.5">
                      {new Date(notif.criado_em).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                  
                  <p className="text-[11px] text-zinc-400 leading-relaxed whitespace-pre-wrap">
                    {notif.mensagem}
                  </p>
                  
                  {notif.link_url && (
                    <div className="pt-2">
                      <Link
                        href={notif.link_url}
                        onClick={() => setMenuAberto(false)}
                        className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-500 hover:text-emerald-400 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" /> Acessar Link
                      </Link>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

        </div>
      )}
    </div>
  );
}