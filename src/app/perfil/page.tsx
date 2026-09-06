"use client";

import { useState, useEffect } from 'react';
import { supabase } from "@/lib/supabase";
import { useRouter } from 'next/navigation';
import { User, Mail, Lock, Save, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

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
    // O Supabase permite guardar o nome dentro de user_metadata
    setNome(user.user_metadata?.full_name || user.user_metadata?.nome || '');
  }

  // ========================== ATUALIZAR DADOS (NOME E E-MAIL) ==========================
  async function handleAtualizarDados(e: React.FormEvent) {
    e.preventDefault();
    setLoadingDados(true);
    setMensagemDados(null);

    try {
      const updates: any = {
        data: { full_name: nome } // Atualiza o nome nos metadados
      };

      // Só envia o e-mail para atualização se ele foi alterado
      const emailAlterado = email !== emailOriginal;
      if (emailAlterado) {
        updates.email = email;
      }

      const { error } = await supabase.auth.updateUser(updates);

      if (error) throw error;

      if (emailAlterado) {
        setMensagemDados({ 
          tipo: 'info', 
          texto: 'Nome atualizado! Como você alterou seu e-mail, enviamos um link de confirmação para o novo endereço. Acesse sua caixa de entrada para validar a troca.' 
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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      <div className="max-w-4xl mx-auto px-6 pt-12 space-y-8 animate-in fade-in duration-500">
        
        {/* CABEÇALHO */}
        <div className="border-b border-gray-200 pb-5">
          <h1 className="text-3xl font-extrabold flex items-center gap-3 uppercase tracking-wide text-slate-800">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <User className="w-6 h-6" />
            </div>
            Meu Perfil
          </h1>
          <p className="text-slate-500 mt-2 text-sm font-medium">
            Gerencie suas informações pessoais e credenciais de acesso à plataforma de simulados.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* COLUNA 1: DADOS PESSOAIS */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-extrabold uppercase tracking-widest text-slate-800 mb-6 border-b border-gray-100 pb-2">
              Dados Pessoais
            </h2>

            <form onSubmit={handleAtualizarDados} className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5 flex items-center gap-1">
                  <User className="w-3 h-3" /> Nome Completo
                </label>
                <input 
                  type="text" 
                  value={nome} 
                  onChange={e => setNome(e.target.value)} 
                  placeholder="Seu nome" 
                  className="w-full text-sm font-medium p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition-colors" 
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5 flex items-center gap-1">
                  <Mail className="w-3 h-3" /> E-mail de Acesso
                </label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  className="w-full text-sm font-medium p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition-colors" 
                  required
                />
              </div>

              {/* Mensagens de Feedback - Dados */}
              {mensagemDados && (
                <div className={`p-4 rounded-xl text-xs font-medium flex items-start gap-2 ${
                  mensagemDados.tipo === 'sucesso' ? 'bg-green-50 text-green-700 border border-green-100' : 
                  mensagemDados.tipo === 'info' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 
                  'bg-red-50 text-red-700 border border-red-100'
                }`}>
                  {mensagemDados.tipo === 'erro' ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
                  <span>{mensagemDados.texto}</span>
                </div>
              )}

              <button 
                type="submit" 
                disabled={loadingDados}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-70 text-white text-xs font-bold uppercase tracking-widest py-3.5 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all mt-2"
              >
                {loadingDados ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {loadingDados ? 'Salvando...' : 'Salvar Informações'}
              </button>
            </form>
          </div>

          {/* COLUNA 2: SEGURANÇA E SENHA */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 h-fit">
            <h2 className="text-lg font-extrabold uppercase tracking-widest text-slate-800 mb-6 border-b border-gray-100 pb-2">
              Segurança
            </h2>

            <form onSubmit={handleAtualizarSenha} className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Nova Senha
                </label>
                <input 
                  type="password" 
                  value={novaSenha} 
                  onChange={e => setNovaSenha(e.target.value)} 
                  placeholder="Mínimo de 6 caracteres" 
                  className="w-full text-sm font-medium p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition-colors" 
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Confirmar Nova Senha
                </label>
                <input 
                  type="password" 
                  value={confirmarSenha} 
                  onChange={e => setConfirmarSenha(e.target.value)} 
                  placeholder="Digite a senha novamente" 
                  className="w-full text-sm font-medium p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition-colors" 
                  required
                />
              </div>

              {/* Mensagens de Feedback - Senha */}
              {mensagemSenha && (
                <div className={`p-4 rounded-xl text-xs font-medium flex items-start gap-2 ${
                  mensagemSenha.tipo === 'sucesso' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
                }`}>
                  {mensagemSenha.tipo === 'erro' ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
                  <span>{mensagemSenha.texto}</span>
                </div>
              )}

              <button 
                type="submit" 
                disabled={loadingSenha || !novaSenha || !confirmarSenha}
                className="w-full bg-slate-800 hover:bg-slate-900 disabled:opacity-70 text-white text-xs font-bold uppercase tracking-widest py-3.5 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all mt-2"
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