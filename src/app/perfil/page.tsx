"use client";

import { useState, useEffect } from 'react';
import { supabase } from "@/lib/supabase";
import { useRouter } from 'next/navigation';
import { User, Mail, Lock, Save, AlertCircle, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function PerfilAlunoPage() {
  const router = useRouter();
  
  // Estados de Dados do Usuário
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [emailOriginal, setEmailOriginal] = useState('');
  
  // Estados de Senha
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');

  // Estados de UI (Carregamento e Mensagens)
  const [loadingDados, setLoadingDados] = useState(false);
  const [loadingSenha, setLoadingSenha] = useState(false);
  const [mensagemDados, setMensagemDados] = useState<{ tipo: 'sucesso' | 'erro' | 'info', texto: string } | null>(null);
  const [mensagemSenha, setMensagemSenha] = useState<{ tipo: 'sucesso' | 'erro', texto: string } | null>(null);

  useEffect(() => {
    carregarPerfil();
  }, []);

  async function carregarPerfil() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      router.push('/login');
      return;
    }

    setEmail(user.email || '');
    setEmailOriginal(user.email || '');
    setNome(user.user_metadata?.full_name || user.user_metadata?.nome || '');
  }

  // ========================== ATUALIZAR DADOS (NOME E E-MAIL) ==========================
  async function handleAtualizarDados(e: React.FormEvent) {
    e.preventDefault();
    setLoadingDados(true);
    setMensagemDados(null);

    try {
      const updates: any = {
        data: { full_name: nome } 
      };

      const emailAlterado = email !== emailOriginal;
      if (emailAlterado) {
        updates.email = email;
      }

      const { error } = await supabase.auth.updateUser(updates);

      if (error) throw error;

      if (emailAlterado) {
        setMensagemDados({ 
          tipo: 'info', 
          texto: 'Nome atualizado! Enviamos um link de confirmação para o novo e-mail para validar a troca.' 
        });
      } else {
        setMensagemDados({ tipo: 'sucesso', texto: 'Dados atualizados com sucesso!' });
      }

    } catch (error: any) {
      setMensagemDados({ tipo: 'erro', texto: error.message || 'Erro ao atualizar dados.' });
    } finally {
      setLoadingDados(false);
    }
  }

  // ========================== ATUALIZAR SENHA ==========================
  async function handleAtualizarSenha(e: React.FormEvent) {
    e.preventDefault();
    setLoadingSenha(true);
    setMensagemSenha(null);

    if (novaSenha !== confirmarSenha) {
      setMensagemSenha({ tipo: 'erro', texto: 'As senhas não coincidem. Tente novamente.' });
      setLoadingSenha(false);
      return;
    }

    if (novaSenha.length < 6) {
      setMensagemSenha({ tipo: 'erro', texto: 'A nova senha deve ter pelo menos 6 caracteres.' });
      setLoadingSenha(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: novaSenha
      });

      if (error) throw error;

      setMensagemSenha({ tipo: 'sucesso', texto: 'Sua senha foi alterada com sucesso!' });
      setNovaSenha('');
      setConfirmarSenha('');

    } catch (error: any) {
      setMensagemSenha({ tipo: 'erro', texto: error.message || 'Erro ao alterar a senha.' });
    } finally {
      setLoadingSenha(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-[#e4e4e7] font-sans pb-20">
      <div className="max-w-4xl mx-auto px-6 pt-12 space-y-8 animate-in fade-in duration-500">
        
        {/* CABEÇALHO */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-5">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-3 bg-white/5 hover:bg-white/10 text-zinc-400 rounded-xl transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white uppercase tracking-widest flex items-center gap-2">
                <User className="w-6 h-6 text-blue-500" /> Meu Perfil
              </h1>
              <p className="text-xs text-zinc-500 mt-1 uppercase tracking-widest">
                Gerencie suas informações pessoais e credenciais
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* COLUNA 1: DADOS PESSOAIS */}
          <div className="bg-[#131c2f]/30 border border-white/5 p-8 rounded-3xl shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-6 border-b border-white/5 pb-3">
              Dados Pessoais
            </h2>

            <form onSubmit={handleAtualizarDados} className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-1.5">
                  <User className="w-3 h-3" /> Nome Completo
                </label>
                <input 
                  type="text" 
                  value={nome} 
                  onChange={e => setNome(e.target.value)} 
                  placeholder="Seu nome" 
                  className="w-full text-sm font-medium p-3 bg-[#09090b] border border-white/10 text-zinc-200 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-zinc-600" 
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-1.5">
                  <Mail className="w-3 h-3" /> E-mail de Acesso
                </label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  className="w-full text-sm font-medium p-3 bg-[#09090b] border border-white/10 text-zinc-200 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" 
                  required
                />
              </div>

              {/* Mensagens de Feedback - Dados */}
              {mensagemDados && (
                <div className={`p-4 rounded-xl text-xs font-bold uppercase tracking-widest leading-relaxed flex items-start gap-3 mt-4 border ${
                  mensagemDados.tipo === 'sucesso' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                  mensagemDados.tipo === 'info' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                  'bg-red-500/10 text-red-400 border-red-500/20'
                }`}>
                  {mensagemDados.tipo === 'erro' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                  <span>{mensagemDados.texto}</span>
                </div>
              )}

              <button 
                type="submit" 
                disabled={loadingDados}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white text-xs font-black uppercase tracking-widest py-4 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all mt-6"
              >
                {loadingDados ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {loadingDados ? 'Salvando...' : 'Salvar Informações'}
              </button>
            </form>
          </div>

          {/* COLUNA 2: SEGURANÇA E SENHA */}
          <div className="bg-[#131c2f]/30 border border-white/5 p-8 rounded-3xl shadow-sm h-fit">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-6 border-b border-white/5 pb-3">
              Segurança
            </h2>

            <form onSubmit={handleAtualizarSenha} className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-1.5">
                  <Lock className="w-3 h-3" /> Nova Senha
                </label>
                <input 
                  type="password" 
                  value={novaSenha} 
                  onChange={e => setNovaSenha(e.target.value)} 
                  placeholder="Mínimo de 6 caracteres" 
                  className="w-full text-sm font-medium p-3 bg-[#09090b] border border-white/10 text-zinc-200 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-zinc-600" 
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-1.5">
                  <Lock className="w-3 h-3" /> Confirmar Nova Senha
                </label>
                <input 
                  type="password" 
                  value={confirmarSenha} 
                  onChange={e => setConfirmarSenha(e.target.value)} 
                  placeholder="Digite a senha novamente" 
                  className="w-full text-sm font-medium p-3 bg-[#09090b] border border-white/10 text-zinc-200 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-zinc-600" 
                  required
                />
              </div>

              {/* Mensagens de Feedback - Senha */}
              {mensagemSenha && (
                <div className={`p-4 rounded-xl text-xs font-bold uppercase tracking-widest leading-relaxed flex items-start gap-3 mt-4 border ${
                  mensagemSenha.tipo === 'sucesso' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                }`}>
                  {mensagemSenha.tipo === 'erro' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                  <span>{mensagemSenha.texto}</span>
                </div>
              )}

              <button 
                type="submit" 
                disabled={loadingSenha || !novaSenha || !confirmarSenha}
                className="w-full bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-600 disabled:border-white/5 border border-white/10 text-white text-xs font-black uppercase tracking-widest py-4 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all mt-6"
              >
                {loadingSenha ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                {loadingSenha ? 'Atualizando...' : 'Atualizar Senha'}
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}