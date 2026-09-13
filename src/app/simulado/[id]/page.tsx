"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, XCircle, ArrowLeft, MessageSquare, Clock, Hash, Copy, Check, RotateCcw } from 'lucide-react';

type Tentativa = {
  numero_tentativa: number | null;
  total_acertos: number;
  total_questoes: number;
  data_conclusao: string;
};

export default function ResolucaoSimulado() {
  const params = useParams();
  const router = useRouter();
  const simuladoId = params.id as string;

  const [simulado, setSimulado] = useState<any>(null);
  const [questoes, setQuestoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  
  const [finalizando, setFinalizando] = useState(false);
  const [finalizado, setFinalizado] = useState(false);
  const [resultado, setResultado] = useState({ acertos: 0, erros: 0, brancos: 0, notaFinal: 0 });
  const [idCopiado, setIdCopiado] = useState('');
  const [tentativas, setTentativas] = useState<Tentativa[]>([]);
  const [refazendo, setRefazendo] = useState(false);

  const formatarDataTentativa = (dataIso: string) => {
    const d = new Date(dataIso);
    return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const refazerSimulado = async () => {
    if (!confirm("Refazer a prova descarta suas respostas atuais e inicia uma nova tentativa. Deseja continuar?")) return;
    setRefazendo(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from('respostas_alunos')
          .delete()
          .eq('simulado_id', simuladoId)
          .eq('aluno_id', user.id);
        if (error) throw error;
      }
      localStorage.removeItem(`simulado_progresso_${simuladoId}`);
      setRespostas({});
      setResultado({ acertos: 0, erros: 0, brancos: 0, notaFinal: 0 });
      setTentativas([]);
      setFinalizado(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error("Erro ao refazer simulado:", error);
      alert("Não foi possível iniciar uma nova tentativa. Tente novamente.");
    } finally {
      setRefazendo(false);
    }
  };

  const copiarQuestaoId = async (questaoId: string) => {
    try {
      await navigator.clipboard.writeText(questaoId);
      setIdCopiado(questaoId);
      setTimeout(() => setIdCopiado(''), 2000);
    } catch (error) {
      console.error("Erro ao copiar ID:", error);
    }
  };

  useEffect(() => {
    async function carregarSimulado() {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        const { data: dadosSimulado, error: erroSimulado } = await supabase
          .from('simulados')
          .select('*')
          .eq('id', simuladoId)
          .single();

        if (erroSimulado) throw erroSimulado;
        setSimulado(dadosSimulado);

        const { data: relacoes, error: erroRelacoes } = await supabase
          .from('simulado_questoes')
          .select('ordem, questoes(*)')
          .eq('simulado_id', simuladoId)
          .order('ordem', { ascending: true });

        if (erroRelacoes) throw erroRelacoes;

        const listaQuestoes = relacoes.map((item: any) => item.questoes);
        setQuestoes(listaQuestoes);

        if (user) {
          const { data: respostasSalvas } = await supabase
            .from('respostas_alunos')
            .select('*')
            .eq('simulado_id', simuladoId)
            .eq('aluno_id', user.id);

          if (respostasSalvas && respostasSalvas.length > 0) {
            const respostasFormatadas: Record<string, string> = {};
            let acertos = 0;
            let erros = 0;
            let brancos = 0;

            respostasSalvas.forEach((r: any) => {
              if (r.alternativa_marcada) {
                respostasFormatadas[r.questao_id] = r.alternativa_marcada.toLowerCase();
                if (r.foi_correta) acertos++;
                else erros++;
              } else {
                brancos++;
              }
            });

            let notaFinal = acertos;
            if (dadosSimulado.regra_subtracao) {
              notaFinal = acertos - erros;
              if (notaFinal < 0) notaFinal = 0;
            }

            const { data: tentativasSalvas } = await supabase
              .from('historico_tentativas')
              .select('numero_tentativa, total_acertos, total_questoes, data_conclusao')
              .eq('simulado_id', simuladoId)
              .eq('aluno_id', user.id)
              .order('data_conclusao', { ascending: true });

            setRespostas(respostasFormatadas);
            setResultado({ acertos, erros, brancos, notaFinal });
            setTentativas((tentativasSalvas || []) as Tentativa[]);
            setFinalizado(true);
            setLoading(false);
            return;
          }
        }

        const progressoSalvo = localStorage.getItem(`simulado_progresso_${simuladoId}`);
        if (progressoSalvo) {
          setRespostas(JSON.parse(progressoSalvo));
        }

      } catch (error) {
        console.error("Erro ao carregar simulado:", error);
        alert("Não foi possível carregar a prova. Ela pode ter sido excluída.");
        router.push('/');
      } finally {
        setLoading(false);
      }
    }

    if (simuladoId) {
      carregarSimulado();
    }
  }, [simuladoId, router]);

  const marcarAlternativa = (questaoId: string, letra: string) => {
    if (finalizado) return; 
    
    setRespostas(prev => {
      const novasRespostas = { ...prev, [questaoId]: letra };
      localStorage.setItem(`simulado_progresso_${simuladoId}`, JSON.stringify(novasRespostas));
      return novasRespostas;
    });
  };

  const finalizarSimulado = async () => {
    if (!confirm("Tem certeza que deseja finalizar a prova? Questões não respondidas serão consideradas em branco.")) return;
    
    setFinalizando(true);

    let acertos = 0;
    let erros = 0;
    let brancos = 0;

    const { data: { user } } = await supabase.auth.getUser();

    const respostasParaSalvar = questoes.map(questao => {
      const marcada = respostas[questao.id];
      const gabarito = (questao.gabarito || '').toLowerCase();
      
      let foiCorreta = false;

      if (!marcada) {
        brancos++;
      } else if (marcada === gabarito) {
        acertos++;
        foiCorreta = true;
      } else {
        erros++;
      }

      return {
        aluno_id: user?.id,
        questao_id: questao.id,
        simulado_id: simuladoId,
        alternativa_marcada: marcada ? marcada.toUpperCase() : null,
        foi_correta: foiCorreta
      };
    });

    let notaFinal = acertos;
    if (simulado.regra_subtracao) {
      notaFinal = acertos - erros;
      if (notaFinal < 0) notaFinal = 0;
    }

    setResultado({ acertos, erros, brancos, notaFinal });

    let entregaSalva = true;
    if (user) {
      try {
        const { count: tentativasExistentes } = await supabase
          .from('historico_tentativas')
          .select('id', { count: 'exact', head: true })
          .eq('aluno_id', user.id)
          .eq('simulado_id', simuladoId);

        const { error: erroRespostas } = await supabase.from('respostas_alunos').insert(respostasParaSalvar);
        if (erroRespostas) throw erroRespostas;

        const { error: erroTentativa } = await supabase.from('historico_tentativas').insert({
          aluno_id: user.id,
          simulado_id: simuladoId,
          numero_tentativa: (tentativasExistentes || 0) + 1,
          total_questoes: questoes.length,
          total_acertos: acertos,
          data_conclusao: new Date().toISOString()
        });
        if (erroTentativa) throw erroTentativa;

        localStorage.removeItem(`simulado_progresso_${simuladoId}`);
      } catch (error) {
        entregaSalva = false;
        console.error("Erro ao salvar entrega:", error);
      }
    }

    setFinalizando(false);

    if (entregaSalva) {
      setFinalizado(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      alert("Não foi possível registrar sua entrega. Tente novamente.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center text-emerald-500">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        <p className="font-bold tracking-widest text-sm uppercase">Preparando Caderno de Prova...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-[#e4e4e7] font-sans pb-20">
      
      <div className="sticky top-0 z-50 bg-[#09090b]/90 backdrop-blur-md border-b border-white/10 px-4 md:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4">
            <button onClick={() => router.push('/')} className="p-2 hover:bg-white/5 rounded-full transition-colors shrink-0">
              <ArrowLeft className="w-5 h-5 text-zinc-400" />
            </button>
            <div className="hidden sm:block">
              <h1 className="font-bold text-white truncate max-w-[200px] md:max-w-md">{simulado?.titulo}</h1>
              <p className="text-xs text-zinc-500">{questoes.length} Questões {simulado?.regra_subtracao && '• Regra Cebraspe'}</p>
            </div>
          </div>
          
          {!finalizado && (
            <div className="flex items-center gap-3 md:gap-6">
              
              <div className="flex flex-col items-end text-right">
                <span className="text-sm font-bold text-zinc-300">
                  {Object.keys(respostas).length} / {questoes.length}
                </span>
                <span className="hidden md:flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-emerald-500 mt-0.5">
                  <CheckCircle2 className="w-3 h-3" /> Salvo
                </span>
              </div>

              <div className="flex items-center gap-2 md:gap-3">
                <button 
                  onClick={() => router.push('/gerador?aba=historico')}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 md:px-6 py-2 md:py-2.5 rounded-xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-colors flex items-center gap-2 border border-white/5"
                >
                  <Clock className="w-4 h-4" /> <span className="hidden sm:inline">Pausar</span>
                </button>

                <button 
                  onClick={finalizarSimulado}
                  disabled={finalizando}
                  className="bg-emerald-600 hover:bg-emerald-500 text-black px-4 md:px-6 py-2 md:py-2.5 rounded-xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {finalizando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Entregar'}
                </button>
              </div>

            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pt-8">
        
        {finalizado && (
          <div className="bg-[#131c2f]/40 border border-blue-500/30 p-8 rounded-3xl mb-12 text-center animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-2xl font-serif text-white italic mb-8">Desempenho no Simulado</h2>
            
            <div className="flex flex-wrap justify-center gap-6">
              <div className="bg-[#09090b] border border-emerald-500/20 w-32 py-6 rounded-2xl">
                <span className="block text-3xl font-black text-emerald-500 mb-1">{resultado.acertos}</span>
                <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Acertos</span>
              </div>
              <div className="bg-[#09090b] border border-red-500/20 w-32 py-6 rounded-2xl">
                <span className="block text-3xl font-black text-red-500 mb-1">{resultado.erros}</span>
                <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Erros</span>
              </div>
              <div className="bg-[#09090b] border border-white/10 w-32 py-6 rounded-2xl">
                <span className="block text-3xl font-black text-zinc-300 mb-1">{resultado.brancos}</span>
                <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Brancos</span>
              </div>
            </div>

            {simulado?.regra_subtracao && (
              <div className="mt-8 pt-6 border-t border-white/5">
                <p className="text-sm text-zinc-400 mb-2">Nota Final (Regra Cebraspe)</p>
                <span className="text-4xl font-black text-blue-500">{resultado.notaFinal} <span className="text-lg text-zinc-500">pontos líquidos</span></span>
              </div>
            )}

            {tentativas.length > 0 && (
              <div className="mt-8 pt-6 border-t border-white/5 text-left">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Suas tentativas</h3>
                <div className="space-y-2">
                  {tentativas.map((t, index) => {
                    const pct = t.total_questoes > 0 ? Math.round((t.total_acertos / t.total_questoes) * 100) : 0;
                    return (
                      <div key={index} className="flex flex-wrap items-center justify-between gap-2 bg-[#09090b] border border-white/5 px-4 py-3 rounded-xl">
                        <span className="text-sm font-bold text-white">Tentativa {t.numero_tentativa || index + 1}</span>
                        <span className="text-xs text-zinc-500">{formatarDataTentativa(t.data_conclusao)}</span>
                        <span className="text-sm font-black text-emerald-500">
                          {t.total_acertos}/{t.total_questoes}
                          <span className="text-zinc-500 font-bold"> · {pct}%</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              onClick={refazerSimulado}
              disabled={refazendo}
              className="mt-8 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors flex items-center gap-2 mx-auto disabled:opacity-50"
            >
              {refazendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              Refazer Prova
            </button>
          </div>
        )}

        <div className="space-y-12">
          {questoes.map((questao, index) => {
            const marcada = respostas[questao.id];
            const gabarito = questao.gabarito.toLowerCase();
            const revelarGabarito = finalizado;
            const acertou = marcada === gabarito;
            
            // 🚀 NOVA LÓGICA: Verifica o tipo de questão pelo banco de dados
            const isCertoErrado = questao.tipo_questao === 'certo_errado';

            return (
              <div key={questao.id} className={`p-6 md:p-8 rounded-3xl border transition-colors ${
                revelarGabarito 
                  ? (acertou ? 'bg-emerald-500/5 border-emerald-500/20' : (marcada ? 'bg-red-500/5 border-red-500/20' : 'bg-zinc-800/20 border-white/5'))
                  : 'bg-[#131c2f]/20 border-white/5'
              }`}>
                
                <div className="flex items-start gap-4 mb-6">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-white font-bold text-sm shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    {questao.id && (
                      <button
                        onClick={() => copiarQuestaoId(questao.id)}
                        title="Copiar ID da questão"
                        className="bg-white/5 px-3 py-1 rounded-md flex items-center gap-1.5 hover:bg-emerald-500/20 hover:text-emerald-500 transition-colors font-mono normal-case font-bold"
                      >
                        <Hash className="w-3 h-3" />
                        {questao.id.slice(0, 8)}
                        {idCopiado === questao.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      </button>
                    )}
                    {questao.ano && <span className="bg-white/5 px-3 py-1 rounded">{questao.ano}</span>}
                    {questao.banca && <span className="bg-white/5 px-3 py-1 rounded">{questao.banca}</span>}
                    {questao.orgao && <span className="bg-white/5 px-3 py-1 rounded">{questao.orgao}</span>}
                    {questao.cargo && <span className="bg-white/5 px-3 py-1 rounded">{questao.cargo}</span>}
                    {questao.materia && <span className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded">{questao.materia}</span>}
                    {questao.topico && <span className="bg-white/5 px-3 py-1 rounded">{questao.topico}</span>}
                  </div>
                </div>

                <div className="text-zinc-200 leading-relaxed mb-8 text-sm md:text-base whitespace-pre-wrap">
                  {questao.enunciado}
                </div>

                <div className="space-y-3">
                  {/* RENDERIZAÇÃO CONDICIONAL */}
                  {isCertoErrado ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Botão CERTO */}
                      {(() => {
                        let estiloBotao = "border-white/5 bg-[#09090b] text-zinc-400";
                        let estiloLetra = "border-white/10 text-zinc-400";
                        
                        if (!revelarGabarito) {
                          if (marcada === 'c') {
                            estiloBotao = "border-blue-500/50 bg-blue-500/10 text-blue-400";
                            estiloLetra = "border-blue-500 bg-blue-500 text-black";
                          } else {
                            estiloBotao += " hover:border-white/20";
                          }
                        } else {
                          if (gabarito === 'c') {
                            estiloBotao = "border-emerald-500/50 bg-emerald-500/10 text-emerald-500";
                            estiloLetra = "border-emerald-500 bg-emerald-500 text-black";
                          } else if (marcada === 'c' && !acertou) {
                            estiloBotao = "border-red-500/50 bg-red-500/10 text-red-500";
                            estiloLetra = "border-red-500 bg-red-500 text-black";
                          } else {
                            estiloBotao = "border-white/5 bg-[#09090b] opacity-40 text-zinc-600";
                            estiloLetra = "border-white/5 text-zinc-700";
                          }
                        }

                        return (
                          <button 
                            onClick={() => marcarAlternativa(questao.id, 'c')}
                            disabled={finalizado}
                            className={`w-full text-center p-6 rounded-2xl border transition-all flex flex-col items-center justify-center gap-3 ${estiloBotao} ${finalizado ? 'cursor-default' : 'cursor-pointer'}`}
                          >
                            <span className={`w-12 h-12 rounded-full border flex items-center justify-center text-lg font-black transition-colors ${estiloLetra}`}>
                              {revelarGabarito && gabarito === 'c' ? <CheckCircle2 className="w-6 h-6" /> : (revelarGabarito && marcada === 'c' && !acertou ? <XCircle className="w-6 h-6" /> : 'C')}
                            </span>
                            <span className="font-bold tracking-widest uppercase text-sm">Certo</span>
                          </button>
                        );
                      })()}

                      {/* Botão ERRADO */}
                      {(() => {
                        let estiloBotao = "border-white/5 bg-[#09090b] text-zinc-400";
                        let estiloLetra = "border-white/10 text-zinc-400";
                        
                        if (!revelarGabarito) {
                          if (marcada === 'e') {
                            estiloBotao = "border-blue-500/50 bg-blue-500/10 text-blue-400";
                            estiloLetra = "border-blue-500 bg-blue-500 text-black";
                          } else {
                            estiloBotao += " hover:border-white/20";
                          }
                        } else {
                          if (gabarito === 'e') {
                            estiloBotao = "border-emerald-500/50 bg-emerald-500/10 text-emerald-500";
                            estiloLetra = "border-emerald-500 bg-emerald-500 text-black";
                          } else if (marcada === 'e' && !acertou) {
                            estiloBotao = "border-red-500/50 bg-red-500/10 text-red-500";
                            estiloLetra = "border-red-500 bg-red-500 text-black";
                          } else {
                            estiloBotao = "border-white/5 bg-[#09090b] opacity-40 text-zinc-600";
                            estiloLetra = "border-white/5 text-zinc-700";
                          }
                        }

                        return (
                          <button 
                            onClick={() => marcarAlternativa(questao.id, 'e')}
                            disabled={finalizado}
                            className={`w-full text-center p-6 rounded-2xl border transition-all flex flex-col items-center justify-center gap-3 ${estiloBotao} ${finalizado ? 'cursor-default' : 'cursor-pointer'}`}
                          >
                            <span className={`w-12 h-12 rounded-full border flex items-center justify-center text-lg font-black transition-colors ${estiloLetra}`}>
                              {revelarGabarito && gabarito === 'e' ? <CheckCircle2 className="w-6 h-6" /> : (revelarGabarito && marcada === 'e' && !acertou ? <XCircle className="w-6 h-6" /> : 'E')}
                            </span>
                            <span className="font-bold tracking-widest uppercase text-sm">Errado</span>
                          </button>
                        );
                      })()}
                    </div>
                  ) : (
                    /* MÚLTIPLA ESCOLHA */
                    ['a', 'b', 'c', 'd', 'e'].map((letra) => {
                      const alternativaTexto = questao[`alternativa_${letra}`];
                      
                      if (!alternativaTexto || String(alternativaTexto).trim().toLowerCase() === 'null' || String(alternativaTexto).trim() === '') {
                        return null;
                      }

                      let estiloBotao = "border-white/5 bg-[#09090b] text-zinc-400";
                      let estiloLetra = "border-white/10 text-zinc-400";

                      if (!revelarGabarito) {
                        if (marcada === letra) {
                          estiloBotao = "border-blue-500/50 bg-blue-500/10 text-blue-400";
                          estiloLetra = "border-blue-500 bg-blue-500 text-black";
                        } else {
                          estiloBotao += " hover:border-white/20";
                        }
                      } else {
                        if (letra === gabarito) {
                          estiloBotao = "border-emerald-500/50 bg-emerald-500/10 text-emerald-500";
                          estiloLetra = "border-emerald-500 bg-emerald-500 text-black";
                        } else if (marcada === letra && !acertou) {
                          estiloBotao = "border-red-500/50 bg-red-500/10 text-red-500";
                          estiloLetra = "border-red-500 bg-red-500 text-black";
                        } else {
                          estiloBotao = "border-white/5 bg-[#09090b] opacity-40 text-zinc-600";
                          estiloLetra = "border-white/5 text-zinc-700";
                        }
                      }

                      return (
                        <button 
                          key={letra}
                          onClick={() => marcarAlternativa(questao.id, letra)}
                          disabled={finalizado}
                          className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-4 ${estiloBotao} ${finalizado ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                          <span className={`flex-shrink-0 w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold uppercase transition-colors ${estiloLetra}`}>
                            {revelarGabarito && letra === gabarito ? <CheckCircle2 className="w-5 h-5" /> : (revelarGabarito && marcada === letra && !acertou ? <XCircle className="w-5 h-5" /> : letra)}
                          </span>
                          <span className="text-sm mt-1.5">{alternativaTexto}</span>
                        </button>
                      );
                    })
                  )}
                </div>

                {revelarGabarito && questao.comentario_gabarito && (
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
          })}
        </div>

      </div>
    </div>
  );
}
