"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Home, 
  Database, 
  Sliders, 
  BookOpen, 
  Headset, 
  Bell, 
  Settings, 
  LogOut, 
  Menu, 
  LayoutDashboard,
  User,
  X 
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Simulação de notificações não lidas
  const temNotificacao = true; 

  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email ?? null);
        // Substitua pelo seu e-mail de administrador real
        if (user.email === 'profdalmoazevedo@gmail.com') {
          setIsAdmin(true);
        }
      }
    }
    checkUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
  };

  // Oculta a Navbar na tela de Login ou na resolução do simulado para não atrapalhar a prova
  if (pathname.includes('/auth') || pathname.includes('/simulado/')) {
    return null;
  }

 const menuItems = [
  { name: 'Início', href: '/', icon: Home },
  { name: 'Central do Aluno', href: '/central', icon: LayoutDashboard },
  { name: 'Suporte', href: '/suporte', icon: Headset },
  { name: 'Perfil', href: '/perfil', icon: User },
];

  return (
    <nav className="sticky top-0 z-50 bg-[#09090b]/90 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo e Links Desktop */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-serif font-black text-black italic">
                D
              </div>
              <span className="font-serif italic font-bold text-white hidden sm:block uppercase tracking-widest text-sm">
                Simulados
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {menuItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${
                      isActive 
                        ? 'bg-white/10 text-white' 
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Ícones da Direita Desktop */}
          <div className="hidden md:flex items-center gap-4">
            
            <button className="relative p-2 text-zinc-400 hover:text-white transition-colors">
              <Bell className="w-5 h-5" />
              {temNotificacao && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
              )}
            </button>

            {isAdmin && (
              <Link 
                href="/admin"
                className="p-2 text-zinc-400 hover:text-emerald-500 transition-colors"
                title="Gestão da Plataforma"
              >
                <Settings className="w-5 h-5" />
              </Link>
            )}

            <div className="w-px h-6 bg-white/10 mx-2"></div>

            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-red-400 uppercase tracking-widest transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>

          {/* Menu Mobile Toggle */}
          <div className="md:hidden flex items-center gap-4">
            <button className="relative p-2 text-zinc-400">
              <Bell className="w-5 h-5" />
              {temNotificacao && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full"></span>}
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-zinc-400 hover:text-white p-2"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Menu Mobile Aberto */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-white/10 bg-[#09090b]">
          <div className="px-4 pt-2 pb-6 space-y-1">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-widest ${
                    isActive ? 'bg-white/10 text-white' : 'text-zinc-400'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
            
            {isAdmin && (
              <Link 
                href="/admin"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-widest text-emerald-500"
              >
                <Settings className="w-5 h-5" />
                Gestão
              </Link>
            )}

            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 mt-4 rounded-xl text-sm font-bold uppercase tracking-widest text-red-500 bg-red-500/10"
            >
              <LogOut className="w-5 h-5" />
              Sair da Conta
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}