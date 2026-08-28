"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { BookOpen, Loader2, Calendar, FileQuestion, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function SimuladosTematicos() {
  const [simulados, setSimulados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSimulados() {
      try {
        // Busca simulados do tipo 'tematico_professor' e conta as questões vinculadas
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

  return (
    <div className="min-h-screen bg-[#09090b] text-[#e4e4e7] font-sans pb-20">
      <div className="max-w-7xl mx-auto px-6 pt-12">
        
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="w-10 h-10 text-purple-500" />
            <h1 className="text-3xl font-serif text-white italic uppercase">Simulados Temáticos</h1>
          </div>
          <p className="text-zinc-400 max-w-2xl">
            Provas elaboradas e selecionadas pelo professor com foco em temas específicos ou retas finais. 
            Teste seus conhecimentos em um ambiente controlado.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : simulados.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {simulados.map((simulado) => {
              // O Supabase retorna um array com a contagem. Ex: [{ count: 50 }]
              const qtdQuestoes = simulado.simulado_questoes[0]?.count || 0;
              const dataFormatada = new Date(simulado.data_liberacao).toLocaleDateString('pt-BR');

              return (
                <div key={simulado.id} className="bg-[#131c2f]/30 border border-purple-500/20 hover:border-purple-500/50 p-6 md:p-8 rounded-3xl flex flex-col justify-between transition-all group">
                  
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
                    
                    <h3 className="text-xl font-bold text-white mb-2 leading-snug group-hover:text-purple-400 transition-colors">
                      {simulado.titulo}
                    </h3>
                    
                    <div className="flex items-center gap-2 text-sm text-zinc-500 font-medium mt-4">
                      <FileQuestion className="w-4 h-4" />
                      {qtdQuestoes} Questões
                    </div>
                  </div>

                  <Link 
                    href={`/simulado/${simulado.id}`}
                    className="mt-8 block w-full py-4 bg-purple-600 hover:bg-purple-500 text-white text-center font-black uppercase text-[10px] tracking-widest rounded-xl transition-colors"
                  >
                    Iniciar Prova
                  </Link>
                  
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 bg-[#131c2f]/10 border border-white/5 rounded-3xl max-w-3xl mx-auto">
            <AlertCircle className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-zinc-300">Nenhum simulado disponível</h3>
            <p className="text-sm text-zinc-500 mt-2">No momento não há simulados temáticos abertos. Aguarde as próximas liberações do professor.</p>
          </div>
        )}

      </div>
    </div>
  );
}