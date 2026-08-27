"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Filter, Search, Loader2, BookOpen, CheckCircle2, XCircle, MessageSquare } from 'lucide-react';

export default function BancoDeQuestoes() {
  const [questoes, setQuestoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [opcoes, setOpcoes] = useState({ bancas: [] as string[], materias: [] as string[], anos: [] as number[] });
  const [bancaSelecionada, setBancaSelecionada] = useState('');
  const [materiaSelecionada, setMateriaSelecionada] = useState('');
  const [anoSelecionado, setAnoSelecionado] = useState('');

  // Novo estado para controlar as questões já respondidas nesta sessão
  const [respostas, setRespostas] = useState<Record<string, { marcada: string; correta: boolean }>>({});

  useEffect(() => {
    async function carregarOpcoesFiltro() {
      const { data, error } = await supabase.from('questoes').select('banca, materia, ano');
      if (data && !error) {
        setOpcoes({ 
          bancas: [...new Set(data.map(q => q.banca).filter(Boolean))].sort() as string[], 
          materias: [...new Set(data.map(q => q.materia).filter(Boolean))].sort() as string[], 
          anos: [...new Set(data.map(q => q.ano).filter(Boolean))].sort((a, b) => b - a) as number[] 
        });
      }
    }
    carregarOpcoesFiltro();
  }, []);

  const buscarQuestoes = async () => {
    setLoading(true);
    try {
      let query = supabase.from('questoes').select('*').limit(10);
      if (bancaSelecionada) query = query.eq('banca', bancaSelecionada);
      if (materiaSelecionada) query = query.eq('materia', materiaSelecionada);
      if (anoSelecionado) query = query.eq('ano', parseInt(anoSelecionado));

      const { data, error } = await query;
      if (error) throw error;
      
      if (data) setQuestoes(data);
    } catch (error) {
      console.error("Erro ao buscar questões:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    buscarQuestoes();
  }, []);

  // Lógica de resolução
  const responderQuestao = async (questao: any, alternativaMarcada: string) => {
    if (respostas[questao.id]) return; // Impede responder duas vezes a mesma questão

    const gabaritoReal = questao.gabarito.toLowerCase();
    const acertou = alternativaMarcada === gabaritoReal;

    // 1. Atualiza a interface imediatamente (Feedback visual)
    setRespostas(prev => ({
      ...prev,
      [questao.id]: { marcada: alternativaMarcada, correta: acertou }
    }));

    // 2. Salva no banco de dados em background (sem travar a tela)
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      await supabase.from('respostas_alunos').insert({
        aluno_id: user.id,
        questao_id: questao.id,
        alternativa_marcada: alternativaMarcada.toUpperCase(),
        foi_correta: acertou
        // simulado_id e tentativa_id ficam nulos automaticamente
      });
    } else {
      console.warn("Usuário não autenticado. A resposta não foi salva no banco, mas o teste visual funciona.");
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-[#e4e4e7] font-sans pb-20">
      <div className="max-w-7xl mx-auto px-6 pt-12">
        
        <div className="mb-8">
          <h1 className="text-3xl font-serif text-white italic mb-2 uppercase">Banco de Questões</h1>
          <p className="text-zinc-400">Filtre, resolva e acompanhe seu desempenho em tempo real.</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Painel de Filtros mantido exatamente igual */}
          <div className="w-full lg:w-1/4">
            <div className="bg-[#131c2f]/30 border border-white/5 p-6 rounded-2xl sticky top-6">
              <div className="flex items-center gap-2 mb-6 text-white">
                <Filter className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold">Filtros</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Banca</label>
                  <select value={bancaSelecionada} onChange={(e) => setBancaSelecionada(e.target.value)} className="w-full bg-[#09090b] border border-white/10 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none transition-colors appearance-none cursor-pointer">
                    <option value="">Todas as Bancas</option>
                    {opcoes.bancas.map(banca => <option key={banca} value={banca}>{banca}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Matéria</label>
                  <select value={materiaSelecionada} onChange={(e) => setMateriaSelecionada(e.target.value)} className="w-full bg-[#09090b] border border-white/10 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none transition-colors appearance-none cursor-pointer">
                    <option value="">Todas as Matérias</option>
                    {opcoes.materias.map(materia => <option key={materia} value={materia}>{materia}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Ano</label>
                  <select value={anoSelecionado} onChange={(e) => setAnoSelecionado(e.target.value)} className="w-full bg-[#09090b] border border-white/10 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none transition-colors appearance-none cursor-pointer">
                    <option value="">Todos os Anos</option>
                    {opcoes.anos.map(ano => <option key={ano} value={ano}>{ano}</option>)}
                  </select>
                </div>
                <button onClick={buscarQuestoes} className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 text-black font-black uppercase text-[10px] tracking-widest py-4 rounded-xl flex items-center justify-center gap-2 transition-colors">
                  <Search className="w-4 h-4" /> Aplicar Filtros
                </button>
              </div>
            </div>
          </div>

          {/* Feed de Questões com Interatividade */}
          <div className="w-full lg:w-3/4 space-y-6">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              </div>
            ) : questoes.length > 0 ? (
              questoes.map((questao) => {
                const statusResposta = respostas[questao.id];
                const jaRespondida = !!statusResposta;
                const gabaritoCorreto = questao.gabarito.toLowerCase();

                return (
                  <div key={questao.id} className="bg-[#131c2f]/20 border border-white/5 p-6 md:p-8 rounded-3xl">
                    
                    <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-6">
                      {questao.ano && <span className="bg-white/5 px-3 py-1 rounded-md">{questao.ano}</span>}
                      {questao.banca && <span className="bg-white/5 px-3 py-1 rounded-md">{questao.banca}</span>}
                      {questao.orgao && <span className="bg-white/5 px-3 py-1 rounded-md">{questao.orgao}</span>}
                      {questao.cargo && <span className="bg-white/5 px-3 py-1 rounded-md">{questao.cargo}</span>}
                      {questao.materia && <span className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-md">{questao.materia}</span>}
                    </div>

                    <div className="text-zinc-200 leading-relaxed mb-8 text-sm md:text-base whitespace-pre-wrap">
                      {questao.enunciado}
                    </div>

                    <div className="space-y-3">
                      {['a', 'b', 'c', 'd', 'e'].map((letra) => {
                        const alternativaTexto = questao[`alternativa_${letra}`];
                        if (!alternativaTexto) return null;

                        // Lógica de cores baseada no estado da resposta
                        let estiloBotao = "border-white/5 bg-[#09090b] hover:border-emerald-500/50 hover:bg-[#131c2f]/50 text-zinc-400";
                        let estiloLetra = "border-white/10 text-zinc-400 group-hover:border-emerald-500 group-hover:text-emerald-500";
                        
                        if (jaRespondida) {
                          if (letra === gabaritoCorreto) {
                            // A alternativa correta sempre fica verde, independente do que o aluno marcou
                            estiloBotao = "border-emerald-500/50 bg-emerald-500/10 text-emerald-500";
                            estiloLetra = "border-emerald-500 bg-emerald-500 text-black";
                          } else if (letra === statusResposta.marcada && !statusResposta.correta) {
                            // Se o aluno marcou essa e estava errada, fica vermelha
                            estiloBotao = "border-red-500/50 bg-red-500/10 text-red-500";
                            estiloLetra = "border-red-500 bg-red-500 text-black";
                          } else {
                            // As outras alternativas ficam opacas
                            estiloBotao = "border-white/5 bg-[#09090b] opacity-50 cursor-default text-zinc-500";
                            estiloLetra = "border-white/5 text-zinc-600";
                          }
                        }

                        return (
                          <button 
                            key={letra}
                            onClick={() => responderQuestao(questao, letra)}
                            disabled={jaRespondida}
                            className={`w-full text-left p-4 rounded-xl border transition-all group flex items-start gap-4 ${estiloBotao}`}
                          >
                            <span className={`flex-shrink-0 w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold uppercase transition-colors ${estiloLetra}`}>
                              {jaRespondida && letra === statusResposta.marcada ? (
                                statusResposta.correta ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />
                              ) : (
                                letra
                              )}
                            </span>
                            <span className="text-sm mt-1.5">{alternativaTexto}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Comentário do Professor revelado após resposta */}
                    {jaRespondida && questao.comentario_gabarito && (
                      <div className="mt-8 p-6 bg-blue-500/5 border border-blue-500/20 rounded-2xl">
                        <div className="flex items-center gap-2 text-blue-500 font-bold mb-3">
                          <MessageSquare className="w-5 h-5" />
                          <h4>Comentário do Professor</h4>
                        </div>
                        <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                          {questao.comentario_gabarito}
                        </div>
                      </div>
                    )}
                    
                  </div>
                );
              })
            ) : (
              <div className="text-center py-20 bg-[#131c2f]/10 border border-white/5 rounded-3xl">
                <BookOpen className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-zinc-300">Nenhuma questão encontrada</h3>
                <p className="text-sm text-zinc-500 mt-2">Ajuste os filtros para ver mais resultados.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}