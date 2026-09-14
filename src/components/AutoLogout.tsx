"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Timer } from "lucide-react";

const INATIVIDADE_MS = 15 * 60 * 1000;
const AVISO_MS = 30 * 1000;
const EVENTOS = ["mousedown", "keydown", "touchstart", "scroll"] as const;

export default function AutoLogout() {
  const { session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const ultimaAtividade = useRef<number>(Date.now());
  const avisoInicio = useRef<number | null>(null);
  const deslogando = useRef(false);
  const [avisoAtivo, setAvisoAtivo] = useState(false);
  const [segundosRestantes, setSegundosRestantes] = useState(Math.ceil(AVISO_MS / 1000));

  useEffect(() => {
    if (!session) return;

    const registrarAtividade = () => {
      ultimaAtividade.current = Date.now();
      if (avisoInicio.current !== null) {
        avisoInicio.current = null;
        setAvisoAtivo(false);
      }
    };

    let ultimoMove = 0;
    const aoMover = () => {
      const agora = Date.now();
      if (agora - ultimoMove > 30_000) {
        ultimoMove = agora;
        registrarAtividade();
      }
    };

    window.addEventListener("mousemove", aoMover, { passive: true });
    EVENTOS.forEach(ev => window.addEventListener(ev, registrarAtividade, { passive: true }));

    const finalizarSessao = async () => {
      if (deslogando.current) return;
      deslogando.current = true;
      setAvisoAtivo(false);
      await supabase.auth.signOut();
      router.push("/auth");
    };

    const intervalo = setInterval(() => {
      if (pathname.startsWith("/auth")) return;

      const agora = Date.now();
      const inativos = agora - ultimaAtividade.current >= INATIVIDADE_MS;

      if (!inativos) {
        if (avisoInicio.current !== null) {
          avisoInicio.current = null;
          setAvisoAtivo(false);
        }
        return;
      }

      if (avisoInicio.current === null) {
        avisoInicio.current = agora;
        setAvisoAtivo(true);
        setSegundosRestantes(Math.ceil(AVISO_MS / 1000));
        return;
      }

      const restantes = Math.max(0, Math.ceil((AVISO_MS - (agora - avisoInicio.current)) / 1000));
      setSegundosRestantes(restantes);

      if (agora - avisoInicio.current >= AVISO_MS) {
        finalizarSessao();
      }
    }, 1000);

    return () => {
      window.removeEventListener("mousemove", aoMover);
      EVENTOS.forEach(ev => window.removeEventListener(ev, registrarAtividade));
      clearInterval(intervalo);
    };
  }, [session, pathname]);

  if (!session || !avisoAtivo) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-[#131c2f] border border-white/10 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto mb-5">
          <Timer className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-white uppercase tracking-widest mb-2">
          Você ficou inativo
        </h2>
        <p className="text-sm text-zinc-400 leading-relaxed mb-6">
          Por segurança, sua sessão será encerrada em{" "}
          <span className="text-amber-400 font-black">{segundosRestantes}s</span>{" "}
          se não houver atividade.
        </p>
        <button
          onClick={() => {
            ultimaAtividade.current = Date.now();
            avisoInicio.current = null;
            setAvisoAtivo(false);
          }}
          className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 px-6 py-4 text-xs font-black uppercase tracking-widest text-black transition-colors"
        >
          Continuar conectado
        </button>
      </div>
    </div>
  );
}