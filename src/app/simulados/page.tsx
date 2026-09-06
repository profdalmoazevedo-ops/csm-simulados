"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { BookOpen, Loader2, Calendar, FileQuestion, AlertCircle, Search, Filter } from 'lucide-react';
import Link from 'next/link';

export default function SimuladosTematicos() {
  const [simulados, setSimulados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Novos estados para os filtros
  const [busca, setBusca] = useState("");
  const [mesSelecionado, setMesSelecionado] = useState("todos");

  useEffect(() => {
    async function fetchSimulados() {
      try {
        const { data, error } = await supabase
          .from('simulados')
          .select(`
            id,
            titulo,
            data_liberacao,
            regra_subtracao,
            simulado_questoes (count)
          `)
          .eq('tipo', 'tematico_professor')
          .eq('visivel', true)
          .order('data_liberacao', { ascending: false });

        if (error) throw error;
        setSimulados(data || []);
      } catch (error) {
        console.error("Erro ao buscar simulados:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchSimulados();
  }, []);

  // 1. Extrai dinamicamente os meses/anos únicos das datas de liberação (Ex: "2026-09")
  const mesesDisponiveis = Array.from(
    new Set(
      simulados.map((s) => {
        const data = new Date(s.data_liberacao);
        return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
      })
    )
  ).sort().reverse(); // Ordena do mais recente para o mais antigo

  // 2. Formata a chave "2026-09" para algo amigável "Setembro 2026"
  const formatarMesAno = (chave: string) => {
    const [ano, mes] = chave.split('-');
    const data = new Date(parseInt(ano), parseInt(mes) - 1, 1);
    const nomeMes = data.toLocaleDateString('pt-BR', { month: 'long' });
    return `${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)} ${ano}`;
  };

  // 3. Aplica os filtros cruzados (Pesquisa + Mês)
  const simuladosFiltrados = simulados.filter((s) => {
    const data = new Date(s.data_liberacao);
    const chaveMes = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
    
    const matchBusca = s.titulo.toLowerCase().includes(busca.toLowerCase());
    const matchMes = mesSelecionado === "todos" || chaveMes === mesSelecionado;
    
    return matchBusca && matchMes;
  });

  return (
    <div className="min-h-screen bg-[#09090b] text-[#e4e4e7] font-sans pb-20">
      <div className="max-w-7xl mx-auto px-6 pt-12">
        
        {/* CABEÇALHO */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="w-10 h-10 text-purple-500" />
            <h1 className="text-3xl font-serif text-white italic uppercase">Simulados Temáticos</h1>
          </div>
          <p className="text-zinc-400 max-w-2xl">
            Provas elaboradas e selecionadas pelo professor com foco em temas específicos ou retas finais. 
            Teste seus conhecimentos em um ambiente controlado.
          </p>
        </div>

        {/* BARRA DE CONTROLE (FILTROS E BUSCA) */}
        {!loading && simulados.length > 0 && (
          <div className="bg-[#131c2f]/30 border border-white/5 rounded-2xl p-4 mb-10 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm">
            
            {/* Pílulas de Mês */}
            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-hide">
              <Filter className="w-4 h-4 text-zinc-500 mr-1 shrink-0" />
              <button 
                onClick={() => setMesSelecionado("todos")}
                className={`shrink-0 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${mesSelecionado === "todos" ? "bg-purple-600 text-white shadow-md" : "bg-white/5 text-zinc-400 hover:bg-white/10"}`}
              >
                Todos
              </button>
              
              {mesesDisponiveis.map(chave => (
                <button 
                  key={chave}
                  onClick={() => setMesSelecionado(chave)}
                  className={`shrink-0 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${mesSelecionado === chave ? "bg-purple-600 text-white shadow-md" : "bg-white/5 text-zinc-400 hover:bg-white/10"}`}
                >
                  {formatarMesAno(chave)}
                </button>
              ))}
            </div>

            {/* Barra de Pesquisa */}
            <div className="relative w-full md:w-80 shrink-0">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Buscar por tema ou título..." 
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full bg-[#09090b] border border-white/10 text-white rounded-xl pl-10 pr-4 py-2.5 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all placeholder:text-zinc-600"
              />
            </div>
            
          </div>
        )}

        {/* ÁREA DOS CARDS */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : simuladosFiltrados.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {simuladosFiltrados.map((simulado) => {
              const qtdQuestoes = simulado.simulado_questoes[0]?.count || 0;
              const dataFormatada = new Date(simulado.data_liberacao).toLocaleDateString('pt-BR');

              return (
                <div key={simulado.id} className="bg-[#131c2f]/30 border border-purple-500/20 hover:border-purple-500/50 p-6 md:p-8 rounded-3xl flex flex-col justify-between transition-all group shadow-sm hover:shadow-purple-900/10 hover:-translate-y-1">
                  
                  <div>
                    <div className="flex items-start justify-between mb-4 gap-2 flex-wrap">
                      <span className="bg-purple-500/10 text-purple-400 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-md flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" /> {dataFormatada}
                      </span>
                      {simulado.regra_subtracao && (
                        <span className="bg-red-500/10 text-red-400 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-md" title="Uma errada anula uma certa">
                          Regra Cebraspe
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-xl font-bold text-white mb-2 leading-snug group-hover:text-purple-400 transition-colors line-clamp-3">
                      {simulado.titulo}
                    </h3>
                    
                    <div className="flex items-center gap-2 text-sm text-zinc-500 font-medium mt-4">
                      <FileQuestion className="w-4 h-4" />
                      {qtdQuestoes} Questões
                    </div>
                  </div>

                  <Link 
                    href={`/simulado/${simulado.id}`}
                    className="mt-8 block w-full py-4 bg-purple-600 hover:bg-purple-500 text-white text-center font-black uppercase text-[10px] tracking-widest rounded-xl transition-colors shadow-sm"
                  >
                    Iniciar Prova
                  </Link>
                  
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 bg-[#131c2f]/10 border border-white/5 rounded-3xl max-w-3xl mx-auto animate-in fade-in">
            <AlertCircle className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-zinc-300">Nenhum simulado encontrado</h3>
            <p className="text-sm text-zinc-500 mt-2">
              {busca !== "" ? "Tente alterar os termos da sua pesquisa." : "No momento não há simulados temáticos disponíveis para este período."}
            </p>
          </div>
        )}

      </div>
    </div>
  );
}