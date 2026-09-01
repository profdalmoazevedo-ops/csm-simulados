"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  LifeBuoy, Clock, CheckCircle2, AlertCircle, 
  Trash2, Play, Check, Search, Mail, User
} from 'lucide-react';

export default function GestaoSuporteAdmin() {
  const [chamados, setChamados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Controle de Modal Unificado
  const [modalAcao, setModalAcao] = useState<{tipo: 'iniciar' | 'resolver' | null, chamado: any}>({ tipo: null, chamado: null });
  const [respostaTexto, setRespostaTexto] = useState("");
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    carregarChamados();
  }, []);

  async function carregarChamados() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('chamados_suporte')
        .select('*')
        .order('criado_em', { ascending: false });

      if (error) throw error;

      if (data) {
        // Ordenação: Pendentes primeiro, seguidos por em atendimento e, por fim, os resolvidos
        const ordem = { 'pendente': 1, 'em_atendimento': 2, 'resolvido': 3 };
        const chamadosOrdenados = data.sort((a, b) => 
          ordem[a.status as keyof typeof ordem] - ordem[b.status as keyof typeof ordem]
        );
        setChamados(chamadosOrdenados);
      }
    } catch (err) {
      console.error("Erro ao carregar chamados:", err);
    } finally {
      setLoading(false);
    }
  }

  // Envia notificação clicável para o painel do aluno
  const dispararNotificacaoAluno = async (alunoId: string, titulo: string, mensagem: string) => {
    try {
      await supabase.from('notificacoes').insert({ 
        aluno_id: alunoId, 
        titulo, 
        mensagem, 
        tipo: 'suporte',
        link_url: '/suporte' 
      });
    } catch (err) {
      console.error("Erro ao notificar aluno:", err);
    }
  };

  const apagarChamado = async (id: string) => {
    if (!confirm("Tem certeza que deseja apagar este chamado permanentemente?")) return;
    
    try {
      await supabase.from('chamados_suporte').delete().eq('id', id);
      setChamados(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      alert("Erro ao apagar chamado.");
    }
  };

  const processarAcao = async () => {
    setProcessando(true);
    const { chamado, tipo } = modalAcao;

    try {
      if (tipo === 'iniciar') {
        await supabase
          .from('chamados_suporte')
          .update({ status: 'em_atendimento', resposta_admin: respostaTexto || null })
          .eq('id', chamado.id);
        
        await dispararNotificacaoAluno(
          chamado.aluno_id, 
          'Chamado em Análise 🔎', 
          'O professor começou a analisar a sua solicitação. Acompanhe na aba histórico.'
        );
      } else {
        await supabase
          .from('chamados_suporte')
          .update({ status: 'resolvido', resposta_admin: respostaTexto || 'Chamado resolvido pela equipe técnica.' })
          .eq('id', chamado.id);
        
        await dispararNotificacaoAluno(
          chamado.aluno_id, 
          'Suporte Concluído ✅', 
          'A sua solicitação foi respondida e resolvida. Clique para ler os detalhes.'
        );
      }

      setModalAcao({ tipo: null, chamado: null });
      setRespostaTexto("");
      await carregarChamados();
    } catch (err) {
      alert("Erro ao processar a ação do chamado.");
    } finally {
      setProcessando(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'resolvido') return (
      <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest">
        <CheckCircle2 className="w-3.5 h-3.5"/> Resolvido
      </span>
    );
    if (status === 'em_atendimento') return (
      <span className="flex items-center gap-1.5 text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest">
        <Clock className="w-3.5 h-3.5"/> Em Análise
      </span>
    );
    return (
      <span className="flex items-center gap-1.5 text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest">
        <AlertCircle className="w-3.5 h-3.5"/> Pendente
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-5">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20">
            <LifeBuoy className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white uppercase tracking-widest">
              Gestão de Suporte
            </h1>
            <p className="text-xs text-zinc-500 mt-1 uppercase tracking-widest">
              Atenda as dúvidas e problemas dos alunos.
            </p>
          </div>
        </div>
      </div>

      {/* LISTAGEM DE CHAMADOS */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12 text-zinc-500 text-xs font-bold uppercase tracking-widest animate-pulse">
            Carregando caixa de entrada...
          </div>
        ) : chamados.length === 0 ? (
          <div className="text-center py-16 text-zinc-500 bg-[#131c2f]/30 rounded-2xl border border-dashed border-white/10">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-bold uppercase tracking-widest">Caixa Limpa!</p>
            <p className="text-xs mt-1">Não há chamados de suporte pendentes no momento.</p>
          </div>
        ) : (
          chamados.map(chamado => (
            <div key={chamado.id} className="bg-[#131c2f]/30 border border-white/5 rounded-2xl p-6 transition-colors hover:border-white/10">
              
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5">
                <div className="flex flex-wrap items-center gap-3">
                  {getStatusBadge(chamado.status)} 
                  <span className="text-xs font-bold text-white uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-md border border-white/5">
                    {chamado.categoria}
                  </span>
                  {chamado.questao_id && (
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 px-2.5 py-1.5 rounded-md border border-amber-500/20 flex items-center gap-1">
                      <Search className="w-3 h-3" /> ID: {chamado.questao_id}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                    {new Date(chamado.criado_em).toLocaleDateString('pt-BR')} às {new Date(chamado.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div className="w-px h-4 bg-white/10"></div>
                  <button 
                    onClick={() => apagarChamado(chamado.id)} 
                    className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Apagar Chamado"
                  >
                    <Trash2 className="w-4 h-4"/>
                  </button>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-4 text-xs text-zinc-400 mb-4 font-medium bg-white/5 p-3 rounded-xl border border-white/5 w-fit">
                <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-zinc-500"/> {chamado.nome || 'Aluno não identificado'}</span>
                <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-zinc-500"/> {chamado.email || 'Sem e-mail'}</span>
              </div>

              <div className="bg-[#09090b] p-5 rounded-xl border border-white/5 mb-5">
                <p className="text-xs text-zinc-500 uppercase font-bold tracking-widest mb-2">Mensagem do Aluno:</p>
                <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{chamado.mensagem}</p>
              </div>

              {chamado.resposta_admin && chamado.status === 'resolvido' && (
                <div className="bg-emerald-500/5 p-5 rounded-xl border border-emerald-500/10 mb-5">
                  <p className="text-xs text-emerald-500 uppercase font-bold tracking-widest mb-2">Sua Resposta Final:</p>
                  <p className="text-sm text-emerald-100/80 leading-relaxed whitespace-pre-wrap">{chamado.resposta_admin}</p>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                {chamado.status === 'pendente' && (
                  <button 
                    onClick={() => setModalAcao({tipo: 'iniciar', chamado})} 
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-colors shadow-lg shadow-blue-900/20"
                  >
                    <Play className="w-4 h-4"/> Iniciar Atendimento
                  </button>
                )}
                {chamado.status !== 'resolvido' && (
                  <button 
                    onClick={() => setModalAcao({tipo: 'resolver', chamado})} 
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-black transition-colors shadow-lg shadow-emerald-900/20"
                  >
                    <Check className="w-4 h-4"/> Responder e Resolver
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL DE ATENDIMENTO */}
      {modalAcao.tipo && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#131c2f] w-full max-w-lg p-8 rounded-3xl border border-white/10 shadow-2xl animate-in zoom-in-95 duration-300">
            <h2 className="text-lg font-bold text-white mb-6 uppercase tracking-widest flex items-center gap-2">
              {modalAcao.tipo === 'iniciar' ? <Play className="w-5 h-5 text-blue-500" /> : <Check className="w-5 h-5 text-emerald-500" />}
              {modalAcao.tipo === 'iniciar' ? 'Iniciar Análise' : 'Resolver Chamado'}
            </h2>
            
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">
              Mensagem para o aluno (Opcional)
            </label>
            <textarea 
              rows={5}
              placeholder={modalAcao.tipo === 'iniciar' ? "Ex: Oi! Já estou verificando essa questão..." : "Ex: Correção efetuada. O gabarito correto agora é a letra B."}
              value={respostaTexto}
              onChange={e => setRespostaTexto(e.target.value)}
              className="w-full bg-[#09090b] border border-white/10 rounded-xl p-4 text-sm text-white mb-6 outline-none focus:border-emerald-500 transition-colors resize-none placeholder:text-zinc-600 custom-scrollbar"
            />
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={() => {setModalAcao({tipo: null, chamado: null}); setRespostaTexto("")}} 
                className="px-6 py-4 bg-white/5 hover:bg-white/10 rounded-xl text-zinc-400 font-bold text-[10px] uppercase tracking-widest transition-colors w-full sm:w-auto"
              >
                Cancelar
              </button>
              <button 
                onClick={processarAcao} 
                disabled={processando} 
                className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors ${
                  modalAcao.tipo === 'iniciar' ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-black'
                } disabled:opacity-50`}
              >
                {processando ? 'A Processar...' : 'Confirmar e Enviar Notificação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
