"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, XCircle, ArrowLeft, MessageSquare, Clock, Save } from 'lucide-react';

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

            setRespostas(respostasFormatadas);
            setResultado({ acertos, erros, brancos, notaFinal });
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
      const gabarito = questao.gabarito.toLowerCase();
      
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

    if (user) {
      try {
        await supabase.from('respostas_alunos').insert(respostasParaSalvar);
        
        await supabase.from('historico_tentativas').insert({
          aluno_id: user.id,
          simulado_id: simuladoId,
          total_questoes: questoes.length,
          total_acertos: acertos
        });

        localStorage.removeItem(`simulado_progresso_${simuladoId}`);
      } catch (error) {
        console.error("Erro ao salvar entrega:", error);
      }
    }

    setFinalizado(true);
    setFinalizando(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
          </div>
        )}

        <div className="space-y-12">
          {questoes.map((questao, index) => {
            const marcada = respostas[questao.id];
            const gabarito = questao.gabarito.toLowerCase();
            const revelarGabarito = finalizado;
            const acertou = marcada === gabarito;

            return (
              <div key={questao.id} className={`p-6 md:p-8 rounded-3xl border transition-colors ${
                revelarGabarito 
                  ? (acertou ? 'bg-emerald-500/5 border-emerald-500/20' : (marcada ? 'bg-red-500/5 border-red-500/20' : 'bg-zinc-800/20 border-white/5'))
                  : 'bg-[#131c2f]/20 border-white/5'
              }`}>
                
                <div className="flex items-center gap-4 mb-6">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-white font-bold text-sm">
                    {index + 1}
                  </span>
                  <div className="flex gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    <span className="bg-white/5 px-2 py-1 rounded">{questao.banca}</span>
                    <span className="bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded">{questao.materia}</span>
                  </div>
                </div>

                <div className="text-zinc-200 leading-relaxed mb-8 text-sm md:text-base whitespace-pre-wrap">
                  {questao.enunciado}
                </div>

                <div className="space-y-3">
                 {['a', 'b', 'c', 'd', 'e'].map((letra) => {
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
                  })}
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