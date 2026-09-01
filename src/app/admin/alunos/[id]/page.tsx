"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams } from 'next/navigation';
import { ArrowLeft, Target, Activity, Calendar, Eye, Award, Loader2, BookOpen } from 'lucide-react';
import Link from 'next/link';

export default function DetalhesAluno() {
  const params = useParams();
  const id = params?.id as string;
  
  const [aluno, setAluno] = useState<any>(null);
  const [historico, setHistorico] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Trava de segurança: só busca se o ID já estiver disponível na URL
    if (!id) return;

    async function carregarDetalhes() {
      try {
        setLoading(true);

        // 1. Busca perfil do aluno
        const { data: perfil, error: errPerfil } = await supabase
          .from('usuarios')
          .select('*')
          .eq('id', id)
          .single();

        if (errPerfil) throw errPerfil;
        
        // 2. Busca gamificação
        const { data: stats } = await supabase
          .from('estatisticas_alunos')
          .select('*')
          .eq('aluno_id', id)
          .maybeSingle();

        const precisao = (stats && stats.questoes_resolvidas > 0)
          ? Math.round((stats.acertos_totais / stats.questoes_resolvidas) * 100)
          : 0;

        setAluno({
          ...perfil,
          nome: perfil?.nome || perfil?.full_name || 'Aluno Sem Nome',
          nivel: stats?.nivel_atual || 'Iniciante',
          questoes_resolvidas: stats?.questoes_resolvidas || 0,
          precisao: precisao
        });

        // 3. Busca histórico de simulados realizados
        const { data: tentativas } = await supabase
          .from('historico_tentativas')
          .select('*, simulados(titulo)')
          .eq('aluno_id', id)
          .order('data_conclusao', { ascending: false });

        setHistorico(tentativas || []);
      } catch (err) {
        console.error("Erro ao carregar aluno:", err);
      } finally {
        setLoading(false);
      }
    }
    
    carregarDetalhes();
  }, [id]);

  const formatarData = (dataIso: string) => {
    const data = new Date(dataIso);
    return `${data.toLocaleDateString('pt-BR')} às ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-4" />
        <span className="text-xs font-bold uppercase tracking-widest">Carregando dossiê do aluno...</span>
      </div>
    );
  }

  if (!aluno) {
    return (
      <div className="text-center py-20 bg-[#131c2f]/30 border border-red-500/10 rounded-3xl">
        <span className="text-sm font-bold text-red-400 uppercase tracking-widest">Aluno não encontrado.</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      
      {/* Cabeçalho */}
      <div className="flex items-center gap-5 border-b border-white/5 pb-6">
        <Link 
          href="/admin/alunos" 
          className="p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition-colors text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase">{aluno.nome}</h1>
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">
            {aluno.email || 'Sem e-mail cadastrado'}
          </p>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <div className="bg-[#131c2f]/30 p-6 sm:p-8 rounded-3xl border border-white/5 flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 shrink-0">
            <Award className="w-7 h-7" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Nível Atual</p>
            <p className={`text-xl font-black uppercase tracking-widest ${
              aluno.nivel === 'Aprovado' ? 'text-amber-400' :
              aluno.nivel === 'Elite' ? 'text-blue-400' :
              aluno.nivel === 'Competitivo' ? 'text-emerald-400' :
              'text-white'
            }`}>
              {aluno.nivel}
            </p>
          </div>
        </div>

        <div className="bg-[#131c2f]/30 p-6 sm:p-8 rounded-3xl border border-white/5 flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 shrink-0">
            <Target className="w-7 h-7" />
          </div>
          <div className="w-full">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Precisão Geral</p>
            <div className="flex items-center gap-3">
              <p className="text-2xl font-black text-white">{aluno.precisao}%</p>
              <div className="w-full h-1.5 bg-[#09090b] rounded-full overflow-hidden border border-white/5">
                <div 
                  className={`h-full rounded-full transition-all ${
                    aluno.precisao >= 70 ? 'bg-emerald-500' : aluno.precisao >= 50 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${aluno.precisao}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#131c2f]/30 p-6 sm:p-8 rounded-3xl border border-white/5 flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 shrink-0">
            <Activity className="w-7 h-7" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Questões Resolvidas</p>
            <p className="text-2xl font-black text-white">{aluno.questoes_resolvidas}</p>
          </div>
        </div>

      </div>

      {/* Tabela de Histórico */}
      <div className="pt-4">
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-6 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-emerald-500" /> Histórico de Simulados
        </h2>
        
        <div className="bg-[#131c2f]/30 border border-white/5 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto custom-scrollbar">
            {historico.length === 0 ? (
              <div className="p-12 text-center text-zinc-500">
                <Calendar className="w-8 h-8 opacity-20 mx-auto mb-3" />
                <span className="text-xs font-bold uppercase tracking-widest">Este aluno ainda não realizou simulados.</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 border-b border-white/5 text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                    <th className="p-5 pl-8">Simulado</th>
                    <th className="p-5 text-center">Data de Conclusão</th>
                    <th className="p-5 text-center">Nota</th>
                    <th className="p-5 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {historico.map((tentativa) => {
                    const nota = Math.round((tentativa.total_acertos / tentativa.total_questoes) * 100) || 0;
                    return (
                      <tr key={tentativa.id} className="hover:bg-white/5 transition-colors group">
                        <td className="p-5 pl-8 font-bold text-white text-sm">
                          {tentativa.simulados?.titulo || 'Simulado Excluído'}
                        </td>
                        <td className="p-5 text-center text-xs font-bold text-zinc-500 uppercase tracking-widest">
                          {formatarData(tentativa.data_conclusao)}
                        </td>
                        <td className="p-5 text-center">
                          <span className={`inline-flex items-center px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest border ${
                            nota >= 70 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                            nota >= 50 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
                            'bg-red-500/10 text-red-400 border-red-500/20'
                          }`}>
                            {nota}%
                          </span>
                        </td>
                        <td className="p-5 text-center">
                          <Link 
                            href={`/desafio/raio-x/${tentativa.id}`} 
                            target="_blank"
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 text-zinc-300 hover:bg-emerald-500 hover:text-black border border-white/10 hover:border-emerald-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                          >
                            <Eye className="w-3.5 h-3.5" /> Ver Correção
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}