"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

const ROTAS_PUBLICAS = ["/auth", "/suporte"];

export default function ProtegerRota({ children }: { children: React.ReactNode }) {
  const { session, carregando } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const ePublica = ROTAS_PUBLICAS.some(p => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    if (carregando) return;
    if (!session && !ePublica) {
      router.replace("/auth");
    }
  }, [carregando, session, ePublica, router]);

  if (carregando) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!session && !ePublica) return null;

  return <>{children}</>;
}