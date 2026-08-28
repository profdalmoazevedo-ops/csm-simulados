"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Target, TrendingUp, Award, Database, BookOpen, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [nomeAluno, setNomeAluno] = useState('');
  
  const [statsPlataforma, setStatsPlataforma] = useState({
    totalQuestoes: 0,
    totalSimulados: 0
  });

  const [statsAluno, setStatsAluno] = useState({
    resolvidas: 0,
    acertos: 0,
    aproveitamento: 0
  });

  useEffect(() => {
    async function carregarDashboard() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Extrai o primeiro nome do email ou dos metadados caso existam
          const nome = user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'Aluno';
          setNomeAluno(nome.charAt(0).toUpperCase() + nome.slice(1));

          // Busca histórico do aluno
          const { data: respostas } = await supabase
            .from('respostas_alunos')
            .select('foi_correta')
            .eq('aluno_id', user.id);

          if (respostas && respostas.length > 0) {
            const totalResolvidas = respostas.length;
            const totalAcertos = respostas.filter(r => r.foi_correta).length;
            const percentual = Math.round((totalAcertos / totalResolvidas) * 100);

            setStatsAluno({
              resolvidas: totalResolvidas,
              acertos: totalAcertos,
              aproveitamento: percentual
            });
          }
        }

        // Busca dados gerais da plataforma (usando head: true para não baixar os dados, apenas contar)
        const { count: countQuestoes } = await supabase
          .from('questoes')
          .select('*', { count: 'exact', head: true });

        const { count: countSimulados } = await supabase
          .from('simulados')
          .select('*', { count: 'exact', head: true })
          .eq('tipo', 'tematico_professor')
          .eq('visivel', true);

        setStatsPlataforma({
          totalQuestoes: countQuestoes || 0,
          totalSimulados: countSimulados || 0
        });

      } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
      } finally {
        setLoading(false);
      }
    }

    carregarDashboard();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex justify-center items-center">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-[#e4e4e7] font-sans pb-20">
      <div className="max-w-7xl mx-auto px-6 pt-12">
        
        {/* Saudação */}
        <div className="mb-12">
          <h1 className="text-4xl font-serif text-white italic mb-2">Bem-vindo(a) de volta, {nomeAluno}.</h1>
          <p className="text-zinc-400">Acompanhe sua evolução e continue sua jornada rumo à aprovação.</p>
        </div>

        {/* Painel de Desempenho do Aluno */}
        <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6">Seu Desempenho</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          
          <div className="bg-[#131c2f]/30 border border-emerald-500/20 p-8 rounded-3xl relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-emerald-500/5 rounded-full group-hover:scale-110 transition-transform blur-2xl"></div>
            <Target className="w-8 h-8 text-emerald-500 mb-6" />
            <span className="block text-4xl font-black text-white mb-2">{statsAluno.resolvidas}</span>
            <span className="text-xs uppercase tracking-widest text-zinc-400 font-bold">Questões Resolvidas</span>
          </div>

          <div className="bg-[#131c2f]/30 border border-blue-500/20 p-8 rounded-3xl relative overflow-hidden group hover:border-blue-500/50 transition-colors">
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-blue-500/5 rounded-full group-hover:scale-110 transition-transform blur-2xl"></div>
            <Award className="w-8 h-8 text-blue-500 mb-6" />
            <span className="block text-4xl font-black text-white mb-2">{statsAluno.acertos}</span>
            <span className="text-xs uppercase tracking-widest text-zinc-400 font-bold">Respostas Certas</span>
          </div>

          <div className="bg-[#131c2f]/30 border border-purple-500/20 p-8 rounded-3xl relative overflow-hidden group hover:border-purple-500/50 transition-colors">
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-purple-500/5 rounded-full group-hover:scale-110 transition-transform blur-2xl"></div>
            <TrendingUp className="w-8 h-8 text-purple-500 mb-6" />
            <div className="flex items-baseline gap-1 mb-2">
              <span className="block text-4xl font-black text-white">{statsAluno.aproveitamento}</span>
              <span className="text-xl text-zinc-500 font-bold">%</span>
            </div>
            <span className="text-xs uppercase tracking-widest text-zinc-400 font-bold">Taxa de Acerto</span>
          </div>
          {/* Gráfico Visual (Barra de Progresso) */}
            <div className="mt-6">
              <div className="flex justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
                <span>Aproveitamento</span>
                <span className="text-purple-400">{statsAluno.aproveitamento}%</span>
              </div>
              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-purple-500 h-full rounded-full transition-all duration-1000 ease-out relative" 
                  style={{ width: `${statsAluno.aproveitamento}%` }}
                >
                  <div className="absolute top-0 right-0 bottom-0 left-0 bg-gradient-to-r from-transparent to-white/20"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Informações da Plataforma & CTA */}
        <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6">Raio-X da Plataforma</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="bg-[#09090b] border border-white/5 p-6 rounded-3xl flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                <Database className="w-6 h-6 text-zinc-400" />
              </div>
              <div>
                <span className="block text-2xl font-black text-white">{statsPlataforma.totalQuestoes.toLocaleString('pt-BR')}</span>
                <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Questões no Acervo</span>
              </div>
            </div>
          </div>

          <div className="bg-[#09090b] border border-white/5 p-6 rounded-3xl flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-zinc-400" />
              </div>
              <div>
                <span className="block text-2xl font-black text-white">{statsPlataforma.totalSimulados}</span>
                <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Simulados Inéditos</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <Link 
            href="/central"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black hover:bg-zinc-200 font-black uppercase text-xs tracking-widest rounded-xl transition-colors"
          >
            Ir para Central do Aluno
          </Link>
        </div>

      </div>
  );
}