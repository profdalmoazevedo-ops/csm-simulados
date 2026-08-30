"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Printer, AlertCircle, ArrowLeft } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation'; 

export default function ImprimirSimulado() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [simulado, setSimulado] = useState<any>(null);
  const [questoes, setQuestoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [erroDetalhado, setErroDetalhado] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    async function buscarDados() {
      try {
        // 1. Busca os dados principais do Simulado
        const { data: dadosSimulado, error: erroSimulado } = await supabase
          .from('simulados')
          .select('*')
          .eq('id', id)
          .single();
          
        if (erroSimulado) throw new Error(`Erro ao buscar simulado: ${erroSimulado.message}`);
        setSimulado(dadosSimulado);

        // 2. Busca apenas as relações (IDs das questões e a ordem)
        const { data: relacoes, error: erroRelacoes } = await supabase
          .from('simulado_questoes')
          .select('questao_id, ordem')
          .eq('simulado_id', id);

        if (erroRelacoes) throw new Error(`Erro ao buscar relação de questões: ${erroRelacoes.message}`);

        if (relacoes && relacoes.length > 0) {
            const idsQuestoes = relacoes.map(r => r.questao_id);

            // 3. Busca as questões com as novas colunas orgao e cargo
            const { data: dadosQuestoes, error: erroQuestoes } = await supabase
              .from('questoes')
              .select('id, ano, banca, orgao, cargo, tipo_questao, enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d, alternativa_e, gabarito')
              .in('id', idsQuestoes);

            if (erroQuestoes) throw new Error(`Erro ao buscar dados das questões: ${erroQuestoes.message}`);

            // 4. Junta a ordem com os dados da questão e ordena
            const questoesMontadas = relacoes.map(rel => {
              const questaoEncontrada = dadosQuestoes?.find(q => q.id === rel.questao_id);
              return {
                ordem: rel.ordem,
                ...questaoEncontrada
              };
            }).sort((a, b) => a.ordem - b.ordem);

            setQuestoes(questoesMontadas);
        } else {
            setQuestoes([]);
        }

      } catch (error: any) {
        console.error("Erro no carregamento:", error);
        setErroDetalhado(error.message || "Erro desconhecido ao carregar dados.");
      } finally {
        setLoading(false);
      }
    }

    buscarDados();
  }, [id]);

  if (loading) {
    return <div className="p-12 text-center font-bold text-zinc-500 uppercase tracking-widest text-xs animate-pulse">Preparando documento...</div>;
  }

  if (erroDetalhado) {
    return (
      <div className="p-10 flex flex-col items-center justify-center text-center mt-20">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-zinc-800 mb-2">Ops! Ocorreu um erro técnico.</h2>
        <p className="text-red-600 font-mono text-sm bg-red-50 p-4 rounded border border-red-200 shadow-sm max-w-2xl">{erroDetalhado}</p>
      </div>
    );
  }

  if (!simulado) {
    return <div className="p-10 text-center font-bold text-red-500">Simulado não encontrado.</div>;
  }

  return (
    <div className="min-h-screen bg-white text-black font-sans pb-20">
      
      {/* Botões de Ação (Escondidos na Impressão) */}
      <div className="print:hidden fixed bottom-8 right-8 flex gap-3 z-50">
        <button 
          onClick={() => router.back()} 
          className="bg-zinc-900 text-white px-5 py-4 rounded-full shadow-2xl hover:bg-zinc-800 transition-all flex items-center justify-center font-bold"
          title="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button 
          onClick={() => window.print()} 
          className="bg-emerald-600 text-white px-6 py-4 rounded-full shadow-2xl hover:bg-emerald-500 transition-all flex items-center gap-3 font-bold uppercase tracking-widest text-sm"
        >
          <Printer className="w-5 h-5" /> Imprimir / Gerar PDF
        </button>
      </div>

      {/* Formato de Folha A4 para visualização/impressão */}
      <div className="max-w-4xl mx-auto px-8 py-12">
        
        {/* Cabeçalho do Documento */}
        <div className="border-b-2 border-black pb-6 mb-10 text-center">
          <h1 className="text-3xl font-black uppercase tracking-tight text-black">{simulado.titulo}</h1>
          {simulado.disciplina_foco && (
            <p className="text-sm font-bold mt-2 text-zinc-600 uppercase tracking-widest">
              {simulado.disciplina_foco}
            </p>
          )}
          <p className="text-xs font-bold mt-4 uppercase tracking-widest text-zinc-500">
            Caderno de Prova • Gabarito Imediato
            {simulado.regra_subtracao && " • (C/E: 1 Erro anula 1 Acerto)"}
          </p>
        </div>

        {/* Lista de Questões */}
        <div className="space-y-12">
          {questoes.length === 0 ? (
             <p className="text-center text-zinc-500 font-bold uppercase tracking-widest text-sm">Este simulado ainda não possui questões.</p>
          ) : (
            questoes.map((questao, index) => {
              
              // Lógica para empacotar as colunas de A a E
              let alternativas = [];
              if (questao.alternativa_a) alternativas.push({ letra: 'A', texto: questao.alternativa_a });
              if (questao.alternativa_b) alternativas.push({ letra: 'B', texto: questao.alternativa_b });
              if (questao.alternativa_c) alternativas.push({ letra: 'C', texto: questao.alternativa_c });
              if (questao.alternativa_d) alternativas.push({ letra: 'D', texto: questao.alternativa_d });
              if (questao.alternativa_e) alternativas.push({ letra: 'E', texto: questao.alternativa_e });

              // Tratativa para questões Certo/Errado (Estilo Cebraspe)
              if (alternativas.length === 0 && (questao.tipo_questao === 'certo_errado' || questao.gabarito === 'C' || questao.gabarito === 'E')) {
                alternativas.push({ letra: 'C', texto: 'Certo' });
                alternativas.push({ letra: 'E', texto: 'Errado' });
              }

              return (
                <div key={questao.id} className="break-inside-avoid border-b border-zinc-200 pb-8 last:border-0">
                  
                  {/* Metadados: Ordem, Ano, Banca, Órgão e Cargo */}
                  <div className="flex flex-wrap items-center gap-2 mb-5 text-xs font-bold text-zinc-600 uppercase tracking-wider">
                    <span className="bg-black text-white px-2.5 py-1 rounded-sm">
                      Questão {questao.ordem || index + 1}
                    </span>
                    {(questao.ano || questao.banca) && (
                      <span>
                        {questao.banca || 'Banca Padrão'} {questao.ano ? `• ${questao.ano}` : ''}
                      </span>
                    )}
                    {(questao.orgao || questao.cargo) && (
                      <>
                        <span>|</span>
                        <span>
                          {questao.orgao} {questao.cargo ? `• ${questao.cargo}` : ''}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Enunciado */}
                  <div 
                    className="text-base text-black mb-6 leading-relaxed text-justify"
                    dangerouslySetInnerHTML={{ __html: questao.enunciado || "" }} 
                  />

                  {/* Alternativas */}
                  <div className="space-y-4 pl-2 mb-6">
                    {alternativas.map((alt) => (
                      <div key={alt.letra} className="flex gap-3 text-base">
                        <span className="font-bold min-w-[24px] text-black pt-0.5">
                          {alt.letra})
                        </span>
                        <div 
                          className="text-black leading-relaxed" 
                          dangerouslySetInnerHTML={{ __html: alt.texto }} 
                        />
                      </div>
                    ))}
                  </div>

                  {/* Gabarito Imediato (Caixa destacada) */}
                  {questao.gabarito && (
                    <div className="inline-block bg-zinc-100 px-4 py-2 rounded border border-zinc-300 text-sm font-black text-black uppercase tracking-widest mt-2">
                      Gabarito: {questao.gabarito}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}