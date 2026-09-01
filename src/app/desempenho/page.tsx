"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, BarChart2, TrendingUp, Target, Award, Loader2, BookOpen, Calendar } from 'lucide-react';
import Link from 'next/link';

interface TentativaHistorico {
  id: number;
  data_conclusao: string;
  total_acertos: number;
  total_questoes: number;
  simulados: {
    titulo: string;
    disciplina_foco: string | null;
  } | null;
}

export default function AnaliseDesempenho() {
  const [loading, setLoading] = useState(true);
  const [tentativas, setTentativas] = useState<TentativaHistorico[]>([]);
  const [geral, setGeral] = useState({
    simuladosRealizados: 0,
    totalQuestoesRespondidas: 0,
    totalAcertos: 0,
    mediaAproveitamento: 0
  });

  useEffect(() => {
    async function carregarDadosDesempenho() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Busca o histórico de tentativas do aluno vinculando com o título do simulado
        const { data, error } = await supabase
          .from('historico_tentativas')
          .select(`
            id,
            data_conclusao,
            total_acertos,
            total_questoes,
            simulados (
              titulo,
              disciplina_foco
            )
          `)
          .eq('aluno_id', user.id)
          .order('data_conclusao', { ascending: true });

        if (error) throw error;

        if (data && data.length > 0) {
          setTentativas(data);

          let questoesTotais = 0;
          let acertosTotais = 0;

          data.forEach(t => {
            questoesTotais += t.total_questoes || 0;
            acertosTotais += t.total_acertos || 0;
          });

          const media = questoesTotais > 0 ? Math.round((acertosTotais / questoesTotais) * 100) : 0;

          setGeral({
            simuladosRealizados: data.length,
            totalQuestoesRespondidas: questoesTotais,
            totalAcertos: acertosTotais,
            mediaAproveitamento: media
          });
        }
      } catch (err) {
        console.error("Erro ao carregar desempenho:", err);
      } finally {
        setLoading(false);
      }
    }

    carregarDadosDesempenho();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex justify-center items-center">
        <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-[#e4e4e7] font-sans pb-20">
      <div className="max-w-6xl mx-auto px-6 pt-8 space-y-12">
        
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-white/5 pb-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-3 bg-white/5 hover:bg-white/10 text-zinc-400 rounded-xl transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white uppercase tracking-widest flex items-center gap-2">
                <BarChart2 className="w-6 h-6 text-purple-500" /> Relatório de Desempenho
              </h1>
              <p className="text-xs text-zinc-500 mt-1 uppercase tracking-widest">
                Estatísticas avançadas do seu progresso em simulados
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 bg-[#131c2f]/30 px-6 py-3 rounded-2xl border border-white/5">
            <div className="text-right">
              <span className="block text-xs font-bold text-zinc-500 uppercase tracking-widest">Aproveitamento Médio</span>
              <span className="text-2xl font-black text-purple-400">{geral.mediaAproveitamento}%</span>
            </div>
          </div>
        </div>

        {tentativas.length === 0 ? (
          <div className="text-center py-20 bg-[#131c2f]/30 border border-white/5 rounded-3xl">
            <Target className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-white uppercase tracking-widest mb-2">Sem histórico suficiente</h2>
            <p className="text-sm text-zinc-500">Conclua pelo menos um simulado para gerar o seu relatório de desempenho.</p>
          </div>
        ) : (
          <>
            {/* CARDS DE RESUMO */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="bg-[#131c2f]/30 border border-white/5 p-6 rounded-3xl flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Simulados Realizados</span>
                  <span className="text-2xl font-black text-white">{geral.simuladosRealizados}</span>
                </div>
              </div>

              <div className="bg-[#131c2f]/30 border border-white/5 p-6 rounded-3xl flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Target className="w-6 h-6" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Questões Respondidas</span>
                  <span className="text-2xl font-black text-white">{geral.totalQuestoesRespondidas}</span>
                </div>
              </div>

              <div className="bg-[#131c2f]/30 border border-white/5 p-6 rounded-3xl flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Acertos Totais</span>
                  <span className="text-2xl font-black text-white">{geral.totalAcertos}</span>
                </div>
              </div>

            </div>

            {/* GRÁFICO DE EVOLUÇÃO POR SIMULADO */}
            <div className="bg-[#131c2f]/30 p-8 rounded-3xl border border-white/5 space-y-6">
              <div className="flex items-center gap-2 border-b border-white/5 pb-4">
                <TrendingUp className="w-5 h-5 text-purple-500" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Evolução Histórica por Prova</h2>
              </div>
              
              <div className="h-56 flex items-end justify-between gap-3 pt-6 border-b border-white/5 pb-2 relative overflow-x-auto custom-scrollbar">
                {/* Linhas de grade de fundo */}
                <div className="absolute inset-x-0 inset-y-6 flex flex-col justify-between pointer-events-none">
                  <div className="w-full h-px bg-white/5"></div>
                  <div className="w-full h-px bg-white/5"></div>
                  <div className="w-full h-px bg-white/5"></div>
                </div>

                {tentativas.map((t, index) => {
                  const percentualNota = t.total_questoes > 0 ? Math.round((t.total_acertos / t.total_questoes) * 100) : 0;
                  const dataFormatada = new Date(t.data_conclusao).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                  
                  return (
                    <div key={t.id} className="flex flex-col items-center gap-3 relative min-w-[50px] group flex-1">
                      {/* Tooltip ao passar o mouse */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-10 bg-black border border-white/10 px-3 py-1.5 rounded-lg text-center z-20 shadow-xl whitespace-nowrap">
                        <p className="text-[10px] font-bold text-white">{t.simulados?.titulo || 'Simulado'}</p>
                        <p className="text-[10px] text-purple-400 font-black">{percentualNota}% de acertos</p>
                      </div>

                      <div 
                        className="w-full max-w-[3rem] bg-purple-500/20 hover:bg-purple-500/40 rounded-t-lg transition-all border-t-2 border-purple-500"
                        style={{ height: `${Math.max(percentualNota, 5)}%` }} 
                      />
                      <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest text-center truncate w-full">
                        #{index + 1}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* TABELA DETALHADA DE TENTATIVAS */}
            <div className="bg-[#131c2f]/30 p-8 rounded-3xl border border-white/5 space-y-6">
              <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400 border-b border-white/5 pb-4">
                Detalhamento dos Simulados Realizados
              </h2>

              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/5 text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                      <th className="p-4 pl-6">Simulado</th>
                      <th className="p-4 text-center">Data</th>
                      <th className="p-4 text-center">Acertos</th>
                      <th className="p-4 text-center">Desempenho</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {tentativas.map((t) => {
                      const nota = t.total_questoes > 0 ? Math.round((t.total_acertos / t.total_questoes) * 100) : 0;
                      return (
                        <tr key={t.id} className="hover:bg-white/5 transition-colors">
                          <td className="p-4 pl-6 font-bold text-white text-sm">
                            {t.simulados?.titulo || 'Simulado Excluído'}
                            {t.simulados?.disciplina_foco && (
                              <span className="block text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">
                                {t.simulados.disciplina_foco}
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-center text-xs font-bold text-zinc-500 uppercase tracking-widest">
                            <span className="inline-flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(t.data_conclusao).toLocaleDateString('pt-BR')}
                            </span>
                          </td>
                          <td className="p-4 text-center font-bold text-zinc-300 text-sm">
                            {t.total_acertos} / {t.total_questoes}
                          </td>
                          <td className="p-4 text-center">
                            <span className={`inline-flex items-center px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border ${
                              nota >= 70 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                              nota >= 50 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
                              'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}>
                              {nota}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}