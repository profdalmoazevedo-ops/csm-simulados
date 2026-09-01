"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Bell, Send, Trash2, Edit3, Link2, Users, CreditCard, CheckCircle, X } from 'lucide-react';

export default function CentralNotificacoesGestao() {
  const [notificacoes, setNotificacoes] = useState<any[]>([]);
  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [publicoAlvo, setPublicoAlvo] = useState<'todos' | 'assinantes'>('todos');
  
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [notificacaoSucesso, setNotificacaoSucesso] = useState(false);

  // Carregar histórico de notificações
  const carregarNotificacoes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notificacoes')
        .select('*')
        .order('criado_em', { ascending: false });

      if (error) throw error;
      setNotificacoes(data || []);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarNotificacoes();
  }, []);

  // Enviar ou Atualizar Notificação
  const handleSalvarNotificacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !mensagem.trim()) return;

    setEnviando(true);
    try {
      const dadosNotificacao = {
        titulo: titulo.trim(),
        mensagem: mensagem.trim(),
        link_url: linkUrl.trim() || null,
        publico_alvo: publicoAlvo,
        tipo: 'painel_alert', 
        criado_em: new Date().toISOString()
      };

      if (editandoId) {
        // Modo Edição
        const { error } = await supabase
          .from('notificacoes')
          .update({
            titulo: dadosNotificacao.titulo,
            mensagem: dadosNotificacao.mensagem,
            link_url: dadosNotificacao.link_url,
            publico_alvo: dadosNotificacao.publico_alvo
          })
          .eq('id', editandoId);

        if (error) throw error;
        setEditandoId(null);
      } else {
        // Modo Novo Envio
        const { error } = await supabase
          .from('notificacoes')
          .insert([dadosNotificacao]);

        if (error) throw error;
      }

      setTitulo('');
      setMensagem('');
      setLinkUrl('');
      setPublicoAlvo('todos');
      setNotificacaoSucesso(true);
      carregarNotificacoes();

      setTimeout(() => setNotificacaoSucesso(false), 4000);
    } catch (error) {
      console.error('Erro ao salvar notificação:', error);
      alert('Erro operacional ao salvar aviso.');
    } finally {
      setEnviando(false);
    }
  };

  // Preparar para editar
  const handleIniciarEdicao = (notif: any) => {
    setEditandoId(notif.id);
    setTitulo(notif.titulo || '');
    setMensagem(notif.mensagem || '');
    setLinkUrl(notif.link_url || '');
    setPublicoAlvo(notif.publico_alvo || 'todos');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Cancelar Edição
  const cancelarEdicao = () => {
    setEditandoId(null);
    setTitulo('');
    setMensagem('');
    setLinkUrl('');
    setPublicoAlvo('todos');
  };

  // Apagar Notificação
  const handleDeletarNotificacao = async (id: string) => {
    if (!confirm('Deseja realmente apagar esta notificação? Ela sumirá do painel dos alunos.')) return;

    try {
      // 1. Remove os registros de leitura para não dar erro de chave estrangeira
      await supabase.from('notificacoes_lidas').delete().eq('notificacao_id', id);
      
      // 2. Apaga a notificação principal
      const { error } = await supabase
        .from('notificacoes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      carregarNotificacoes();
    } catch (error) {
      console.error('Erro ao deletar notificação:', error);
      alert('Erro ao apagar notificação.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-5">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white uppercase tracking-widest">
              Central de Notificações
            </h1>
            <p className="text-xs text-zinc-500 mt-1 uppercase tracking-widest">
              Gerencie os avisos enviados aos alunos.
            </p>
          </div>
        </div>
      </div>

      {/* Alerta de Sucesso */}
      {notificacaoSucesso && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex items-center gap-3 text-emerald-400 text-xs font-bold uppercase tracking-widest animate-in slide-in-from-top-2">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span>Notificação processada e publicada com sucesso no sistema!</span>
        </div>
      )}

      {/* Layout em Grade */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* COLUNA 1: Formulário (Criar / Editar) */}
        <div className="lg:col-span-5 bg-[#131c2f]/30 p-6 sm:p-8 rounded-3xl border border-white/5 space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
              {editandoId ? 'Editar Aviso' : 'Novo Disparo'}
            </h2>
            {editandoId && (
              <button onClick={cancelarEdicao} className="text-zinc-500 hover:text-white transition-colors p-1 bg-white/5 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <form onSubmit={handleSalvarNotificacao} className="space-y-6">
            
            {/* Seleção de Público Alvo */}
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Público-Alvo</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPublicoAlvo('todos')}
                  className={`p-3 rounded-xl border text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                    publicoAlvo === 'todos'
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                      : 'bg-[#09090b] border-white/5 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Users className="w-4 h-4" /> Todos
                </button>
                <button
                  type="button"
                  onClick={() => setPublicoAlvo('assinantes')}
                  className={`p-3 rounded-xl border text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                    publicoAlvo === 'assinantes'
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                      : 'bg-[#09090b] border-white/5 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <CreditCard className="w-4 h-4" /> Assinantes
                </button>
              </div>
            </div>

            {/* Título */}
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Título do Aviso</label>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Novo Simulado Liberado!"
                required
                className="w-full bg-[#09090b] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Corpo da Mensagem */}
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Mensagem</label>
              <textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Escreva o comunicado interno que aparecerá no sino do aluno..."
                rows={5}
                required
                className="w-full bg-[#09090b] border border-white/10 rounded-xl p-4 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 resize-none transition-colors custom-scrollbar"
              />
            </div>

            {/* Link Adicional */}
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                Link de Redirecionamento <span className="text-zinc-600">(Opcional)</span>
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <Link2 className="w-4 h-4 text-zinc-600" />
                </div>
                <input
                  type="text"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="Ex: /central ou https://..."
                  className="w-full bg-[#09090b] border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            {/* Botão de Submissão */}
            <button
              type="submit"
              disabled={enviando}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-black text-[10px] font-black uppercase tracking-widest py-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {enviando ? (
                'A Processar...'
              ) : (
                <><Send className="w-4 h-4" /> {editandoId ? 'Atualizar Notificação' : 'Disparar Notificação'}</>
              )}
            </button>
          </form>
        </div>

        {/* COLUNA 2 e 3: Histórico e Gerenciamento */}
        <div className="lg:col-span-7 bg-[#131c2f]/30 p-6 sm:p-8 rounded-3xl border border-white/5 space-y-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400 border-b border-white/5 pb-4">
            Histórico de Avisos Enviados
          </h2>

          {loading ? (
            <div className="text-center py-12 text-zinc-500 text-xs font-bold uppercase tracking-widest animate-pulse">
              Carregando arquivo de notificações...
            </div>
          ) : notificacoes.length === 0 ? (
            <div className="text-center py-16 bg-[#09090b] rounded-2xl border border-dashed border-white/10 text-zinc-500">
              <Bell className="w-6 h-6 mx-auto mb-3 opacity-30" />
              <p className="text-xs font-bold uppercase tracking-widest">Nenhum comunicado</p>
              <p className="text-xs mt-1">Os disparos realizados aparecerão aqui.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {notificacoes.map((notif) => (
                <div 
                  key={notif.id} 
                  className={`p-6 rounded-2xl border bg-[#09090b] flex flex-col md:flex-row justify-between items-start gap-6 transition-all ${
                    editandoId === notif.id ? 'border-amber-500/50 shadow-lg shadow-amber-500/5' : 'border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="space-y-3 flex-1 w-full">
                    
                    <div className="flex flex-wrap items-center gap-3">
                      {notif.publico_alvo === 'assinantes' ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md border border-emerald-500/20">
                          Assinantes
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-zinc-400 bg-white/5 px-2 py-1 rounded-md border border-white/10">
                          Todos os Alunos
                        </span>
                      )}
                      
                      {notif.tipo === 'suporte' && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-blue-400 bg-blue-400/10 px-2 py-1 rounded-md border border-blue-500/20">
                          Automático (Suporte)
                        </span>
                      )}

                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                        {new Date(notif.criado_em).toLocaleDateString('pt-BR')} às {new Date(notif.criado_em).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-bold text-white mb-1">{notif.titulo}</h3>
                      <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">{notif.mensagem}</p>
                    </div>
                    
                    {notif.link_url && (
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-500 mt-2">
                        <Link2 className="w-3.5 h-3.5" />
                        <span className="truncate max-w-md">{notif.link_url}</span>
                      </div>
                    )}
                  </div>

                  {/* Ações: Editar e Apagar */}
                  <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end border-t md:border-t-0 border-white/5 pt-4 md:pt-0">
                    <button
                      onClick={() => handleIniciarEdicao(notif)}
                      className="p-3 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                      title="Editar aviso"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeletarNotificacao(notif.id)}
                      className="p-3 rounded-xl border border-red-500/10 bg-red-500/5 hover:bg-red-500/10 text-red-500 hover:text-red-400 transition-colors"
                      title="Apagar aviso definitivamente"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}