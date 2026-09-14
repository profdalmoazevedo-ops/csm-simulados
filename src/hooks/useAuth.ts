"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";

interface EstadoAuth {
  session: Session | null;
  user: User | null;
  carregando: boolean;
}

export function useAuth(): EstadoAuth {
  const [session, setSession] = useState<Session | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    supabase.auth.getSession().then(({ data: { session: sessao } }) => {
      if (!ativo) return;
      setSession(sessao);
      setCarregando(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      if (!ativo) return;
      setSession(sessao);
      setCarregando(false);
    });

    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, carregando };
}