"use function";
"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Database, BookOpen, Users, Settings } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const menuAdmin = [
    { name: 'Visão Geral', href: '/admin', icon: LayoutDashboard },
    { name: 'Banco de Questões', href: '/admin/questoes', icon: Database },
    { name: 'Simulados Temáticos', href: '/admin/simulados', icon: BookOpen },
    { name: 'Gestão de Alunos', href: '/admin/alunos', icon: Users },
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
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
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