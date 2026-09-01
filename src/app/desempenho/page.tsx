"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, BarChart2, Star, AlertTriangle, TrendingUp, Target, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface DesempenhoTopico {
  nome: string;
  total: number;
  acertos: number;
  aproveitamento: number;
}

interface DadosEvolucao {
  dataLabel: string;
  aproveitamento: number;
}

export default function AnaliseDesempenho() {
  const [loading, setLoading] = useState(true);
  
  const [evolucaoDiaria, setEvolucaoDiaria] = useState<DadosEvolucao[]>([]);
  const [pontosFortes, setPontosFortes] = useState<DesempenhoTopico[]>([]);
  const [pontosAtencao, setPontosAtencao] = useState<DesempenhoTopico[]>([]);
  
  const [geral, setGeral] = useState({ resolvidas: 0, acertos: 0 });

  useEffect(() => {
    async function carregarDados() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Puxa as respostas juntamente com os dados da questão (tópico)
        const { data: respostas, error } = await supabase
          .from('respostas_alunos')
          .select(`
            foi_correta,
            criado_em,
            questoes ( topico )
          `)
          .eq('aluno_id', user.id)
          .order('criado_em', { ascending: true });

        if (error) throw error;
        if (!respostas || respostas.length === 0) {
          setLoading(false);
          return;
        }

        // 1. Processar Visão Geral
        const totalResolvidas = respostas.length;
        const totalAcertos = respostas.filter(r => r.foi_correta).length;
        setGeral({ resolvidas: totalResolvidas, acertos: totalAcertos });

        // 2. Processar Tópicos (Mapeamento de desempenho)
        const topicosMap: Record<string, { total: number; acertos: number }> = {};
        
        respostas.forEach(r => {
          // O retorno do join pode vir como array ou objeto dependendo do tipo da relação. 
          // Ajustado para capturar de qualquer forma.
          const qData = Array.isArray(r.questoes) ? r.questoes[0] : r.questoes;
          const nomeTopico = qData?.topico || 'Outros Tópicos';

          if (!topicosMap[nomeTopico]) {
            topicosMap[nomeTopico] = { total: 0, acertos: 0 };
          }
          topicosMap[nomeTopico].total += 1;
          if (r.foi_correta) topicosMap[nomeTopico].acertos += 1;
        });

        const topicosArray: DesempenhoTopico[] = Object.keys(topicosMap).map(key => {
          const t = topicosMap[key];
          return {
            nome: key,
            total: t.total,
            acertos: t.acertos,
            aproveitamento: Math.round((t.acertos / t.total) * 100)
          };
        });

        // Tópicos com volume mínimo para ser estatisticamente válido (ex: >= 3 questões)
        const topicosRelevantes = topicosArray.filter(t => t.total >= 3);
        
        // Ordena por aproveitamento (maior para menor)
        topicosRelevantes.sort((a, b) => b.aproveitamento - a.aproveitamento);
        
        setPontosFortes(topicosRelevantes.slice(0, 3)); // Top 3
        setPontosAtencao(topicosRelevantes.slice().reverse().slice(0, 4)); // Piores 4

        // 3. Processar Gráfico de Evolução (Últimos 7 dias)
        // Geramos os últimos 7 dias dinamicamente para garantir que o gráfico tenha base mesmo sem dados
        const ultimos7Dias = [...Array(7)].map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return d.toISOString().split('T')[0]; // "YYYY-MM-DD"
        });

        const evolucaoMap: Record<string, { total: number; acertos: number }> = {};
        ultimos7Dias.forEach(d => evolucaoMap[d] = { total: 0, acertos: 0 });

        respostas.forEach(r => {
          const dataApenas = r.criado_em.split('T')[0];
          if (evolucaoMap[dataApenas] !== undefined) {
            evolucaoMap[dataApenas].total += 1;
            if (r.foi_correta) evolucaoMap[dataApenas].acertos += 1;
          }
        });

        const dadosGrafico: DadosEvolucao[] = ultimos7Dias.map(dataLabel => {
          const dayData = evolucaoMap[dataLabel];
          const ptBrDate = dataLabel.split('-').reverse().slice(0, 2).join('/'); // DD/MM
          return {
            dataLabel: ptBrDate,
            aproveitamento: dayData.total > 0 ? Math.round((dayData.acertos / dayData.total) * 100) : 0
          };
        });

        setEvolucaoDiaria(dadosGrafico);

      } catch (error) {
        console.error("Erro ao gerar análise:", error);
      } finally {
        setLoading(false);
      }
    }

    carregarDados();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex justify-center items-center">
        <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
      </div>
    );
  }

  const overallPercent = geral.resolvidas > 0 ? Math.round((geral.acertos / geral.resolvidas) * 100) : 0;

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
                Estatísticas avançadas do seu progresso
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 bg-[#131c2f]/30 px-6 py-3 rounded-2xl border border-white/5">
            <div className="text-right">
              <span className="block text-xs font-bold text-zinc-500 uppercase tracking-widest">Taxa Geral</span>
              <span className="text-2xl font-black text-purple-400">{overallPercent}%</span>
            </div>
          </div>
        </div>

        {geral.resolvidas === 0 ? (
          <div className="text-center py-20 bg-[#131c2f]/30 border border-white/5 rounded-3xl">
            <Target className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-white uppercase tracking-widest mb-2">Sem histórico suficiente</h2>
            <p className="text-sm text-zinc-500">Resolva simulados para gerar o seu relatório de desempenho.</p>
          </div>
        ) : (
          <>
            {/* GRID SUPERIOR: Gráfico e Pontos Fortes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Gráfico de Evolução Nativo (CSS Flexbox) */}
              <div className="bg-[#131c2f]/30 p-8 rounded-3xl border border-white/5">
                <div className="flex items-center gap-2 mb-8">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Evolução (Últimos 7 dias)</h2>
                </div>
                
                <div className="h-48 flex items-end justify-between gap-2 border-b border-white/5 pb-2 relative">
                  {/* Linhas de grade sutis ao fundo */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                    <div className="w-full h-px bg-white/5"></div>
                    <div className="w-full h-px bg-white/5"></div>
                    <div className="w-full h-px bg-white/5"></div>
                  </div>

                  {evolucaoDiaria.map((dia, index) => (
                    <div key={index} className="flex flex-col items-center gap-3 relative w-full group">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 text-[10px] font-black text-white bg-black px-2 py-1 rounded">
                        {dia.aproveitamento}%
                      </div>
                      <div 
                        className="w-full max-w-[2.5rem] bg-blue-500/20 hover:bg-blue-500/40 rounded-t-sm transition-all border-t border-blue-500/50"
                        style={{ height: `${Math.max(dia.aproveitamento, 2)}%` }} // Mínimo de 2% só para a barra ser visível
                      />
                      <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{dia.dataLabel}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tópicos Mais Acertados */}
              <div className="bg-[#131c2f]/30 p-8 rounded-3xl border border-white/5">
                <div className="flex items-center gap-2 mb-6">
                  <Star className="w-5 h-5 text-emerald-500" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Tópicos Dominados</h2>
                </div>
                
                <div className="space-y-5">
                  {pontosFortes.length > 0 ? pontosFortes.map((topico, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between text-xs font-bold mb-2">
                        <span className="text-white truncate pr-4">{topico.nome}</span>
                        <span className="text-emerald-400">{topico.aproveitamento}%</span>
                      </div>
                      <div className="w-full bg-[#09090b] h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${topico.aproveitamento}%` }} />
                      </div>
                    </div>
                  )) : (
                    <p className="text-xs text-zinc-500 uppercase tracking-widest text-center py-6">Estatísticas em formação</p>
                  )}
                </div>
              </div>
            </div>

            {/* PONTOS DE ATENÇÃO (Lista detalhada) */}
            <div className="bg-[#131c2f]/30 p-8 rounded-3xl border border-white/5">
              <div className="flex items-center gap-2 mb-8">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Pontos de Atenção (Maior Índice de Erros)</h2>
              </div>

              {pontosAtencao.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pontosAtencao.map((topico, idx) => (
                    <div key={idx} className="bg-[#09090b] border border-red-500/10 p-5 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="block text-xs font-black text-white mb-1 uppercase tracking-widest">{topico.nome}</span>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest">
                          {topico.acertos} certas de {topico.total} resolvidas
                        </span>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                        <span className="text-xs font-black text-red-400">{topico.aproveitamento}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-xs text-zinc-500 uppercase tracking-widest">Nenhum ponto crítico detectado ainda.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}