"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  LayoutDashboard, 
  Database, 
  BookOpen, 
  Users, 
  Settings,
  LifeBuoy,
  Bell,
  ShieldAlert
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [verificando, setVerificando] = useState(true);
  const [autorizado, setAutorizado] = useState(false);

  useEffect(() => {
    let ativo = true;
    async function checarAcesso() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          if (ativo) router.replace('/auth');
          return;
        }
        const ok = session.user.email === 'profdalmoazevedo@gmail.com';
        if (ativo) setAutorizado(ok);
      } finally {
        if (ativo) setVerificando(false);
      }
    }
    checarAcesso();
    return () => { ativo = false; };
  }, [router]);

  if (verificando) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 animate-pulse">
          Verificando acesso...
        </p>
      </div>
    );
  }

  if (!autorizado) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-xs">
          <ShieldAlert className="w-10 h-10 text-amber-500" />
          <p className="text-sm font-bold uppercase tracking-widest text-zinc-300">Acesso restrito</p>
          <p className="text-xs text-zinc-500">
            Esta área é exclusiva do professor. Se você chegou aqui por engano, volte para a home.
          </p>
          <button
            onClick={() => router.replace('/')}
            className="mt-2 bg-white/5 border border-white/10 px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest text-white hover:bg-white/10 transition-colors"
          >
            Voltar para a home
          </button>
        </div>
      </div>
    );
  }

  const menuAdmin = [
    { name: 'Visão Geral', href: '/admin', icon: LayoutDashboard },
    { name: 'Banco de Questões', href: '/admin/questoes', icon: Database },
    { name: 'Simulados Temáticos', href: '/admin/simulados', icon: BookOpen },
    { name: 'Gestão de Alunos', href: '/admin/alunos', icon: Users },
    { name: 'Suporte', href: '/admin/suporte', icon: LifeBuoy },
    { name: 'Notificações', href: '/admin/notificacoes', icon: Bell },
    { name: 'Configurações', href: '/admin/configuracoes', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#09090b] flex">
      {/* Sidebar de Gestão */}
      <aside className="w-64 bg-[#131c2f]/50 border-r border-white/5 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-white/5">
          <h2 className="text-sm font-black uppercase tracking-widest text-emerald-500">
            Painel do Professor
          </h2>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {menuAdmin.map((item) => {
            const isActive = item.href === '/admin' 
              ? pathname === '/admin' 
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
              
            const Icon = item.icon;
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors ${
                  isActive 
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Área de Conteúdo Principal */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
