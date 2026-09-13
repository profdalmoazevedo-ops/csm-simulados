"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Filter, Search, Loader2, BookOpen, CheckCircle2, XCircle, MessageSquare, ChevronDown } from 'lucide-react';

const TAMANHO_PAGINA = 15;

const DropdownBuscavel = ({ label, placeholder, opcoes, valor, setValor, disabled = false }: { label: string, placeholder: string, opcoes: any[], valor: string, setValor: (v: string) => void, disabled?: boolean }) => {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  
  useEffect(() => { setBusca(valor); }, [valor]);

  const opcoesFiltradas = opcoes.filter(op => 
    String(op).toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="relative">
      <label className={`block text-xs font-bold uppercase mb-2 ${disabled ? 'text-zinc-600' : 'text-zinc-400'}`}>{label}</label>
      <input 
        type="text"
        value={busca}
        disabled={disabled}
        onChange={(e) => {
          setBusca(e.target.value);
          setAberto(true);
          if (e.target.value === '') setValor('');
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 200)}
        placeholder={disabled ? "Selecione uma matéria primeiro..." : placeholder}
        className={`w-full bg-[#09090b] border rounded-lg px-4 py-3 text-sm transition-colors focus:outline-none ${
          disabled 
            ? 'border-white/5 text-zinc-600 cursor-not-allowed bg-black/20' 
            : 'border-white/10 text-zinc-200 focus:border-emerald-500'
        }`}
      />
      {aberto && !disabled && opcoesFiltradas.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-[#131c2f] border border-white/10 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {opcoesFiltradas.map((op) => (
            <li 
              key={op}
              onMouseDown={(e) => {
                e.preventDefault();
                setValor(String(op));
                setBusca(String(op));
                setAberto(false);
              }}
              className="px-4 py-3 text-sm text-zinc-300 hover:bg-emerald-500/20 hover:text-emerald-500 cursor-pointer transition-colors"
            >
              {op}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default function BancoDeQuestoes() {
  const [questoes, setQuestoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [totalResultados, setTotalResultados] = useState(0);

  const [opcoes, setOpcoes] = useState({
    bancas: [] as string[],
    materias: [] as string[],
    anos: [] as number[],
    cargos: [] as string[],
    formatos: [] as string[],
    topicos: [] as string[]
  });

  const [bancaSelecionada, setBancaSelecionada] = useState('');
  const [materiaSelecionada, setMateriaSelecionada] = useState('');
  const [anoSelecionado, setAnoSelecionado] = useState('');
  const [cargoSelecionado, setCargoSelecionado] = useState('');
  const [formatoSelecionado, setFormatoSelecionado] = useState('');
  const [topicoSelecionado, setTopicoSelecionado] = useState('');

  const [selecoes, setSelecoes] = useState<Record<string, string>>({});
  const [respostas, setRespostas] = useState<Record<string, { marcada: string; correta: boolean }>>({});

  // 1. Carrega as opções de filtro a partir da view agregada (sem baixar a tabela inteira)
  useEffect(() => {
    async function carregarOpcoesFiltro() {
      const { data, error } = await supabase
        .from('vw_opcoes_filtro')
        .select('tipo, valor, total');

      if (data && !error) {
        const valoresDe = (tipo: string) =>
          data
            .filter((r: { tipo: string; valor: string | null }) => r.tipo === tipo && r.valor)
            .map((r: { valor: string }) => String(r.valor).trim())
            .filter(Boolean);

        setOpcoes({
          bancas: [...new Set(valoresDe('banca'))].sort(),
          materias: [...new Set(valoresDe('materia'))].sort(),
          anos: [...new Set(valoresDe('ano').map(v => parseInt(v)))].filter(n => !isNaN(n)).sort((a, b) => b - a),
          cargos: [...new Set(valoresDe('cargo'))].sort(),
          formatos: [...new Set(valoresDe('tipo_questao'))].sort(),
          topicos: []
        });
      }
    }
    carregarOpcoesFiltro();
  }, []);

  // 2. Atualiza a lista de Tópicos SEMPRE que a Matéria mudar (view de cascade)
  useEffect(() => {
    if (materiaSelecionada) {
      supabase
        .from('vw_topico_por_materia')
        .select('topico')
        .eq('materia', materiaSelecionada)
        .order('topico')
        .then(({ data }) => {
          setOpcoes(prev => ({
            ...prev,
            topicos: (data || []).map((r: { topico: string | null }) => String(r.topico).trim()).filter(Boolean)
          }));
        });
    } else {
      setTopicoSelecionado('');
      setOpcoes(prev => ({ ...prev, topicos: [] }));
    }
  }, [materiaSelecionada]);

  const buscarQuestoes = async (pagina = 0) => {
    if (pagina === 0) setLoading(true);
    else setCarregandoMais(true);

    try {
      const inicio = pagina * TAMANHO_PAGINA;
      const fim = inicio + TAMANHO_PAGINA - 1;

      let query = supabase
        .from('questoes')
        .select('*', { count: 'exact' })
        .order('id')
        .range(inicio, fim);

      if (bancaSelecionada) query = query.eq('banca', bancaSelecionada);
      if (materiaSelecionada) query = query.eq('materia', materiaSelecionada);
      if (anoSelecionado) query = query.eq('ano', parseInt(anoSelecionado));
      if (cargoSelecionado) query = query.eq('cargo', cargoSelecionado);
      if (topicoSelecionado) query = query.eq('topico', topicoSelecionado);
      if (formatoSelecionado) query = query.eq('tipo_questao', formatoSelecionado);

      const { data, count, error } = await query;
      if (error) throw error;

      setQuestoes(prev => (pagina === 0 ? data || [] : [...prev, ...(data || [])]));
      setTotalResultados(count || 0);
    } catch (error) {
      console.error("Erro ao buscar questões:", error);
    } finally {
      setLoading(false);
      setCarregandoMais(false);
    }
  };

  useEffect(() => {
    buscarQuestoes();
  }, []);

  const selecionarAlternativa = (questaoId: string, letra: string) => {
    if (respostas[questaoId]) return;
    setSelecoes(prev => ({ ...prev, [questaoId]: letra }));
  };

  const confirmarResposta = async (questao: any) => {
    const alternativaMarcada = selecoes[questao.id];
    if (!alternativaMarcada || respostas[questao.id]) return;

    const gabaritoReal = questao.gabarito.toLowerCase();
    const acertou = alternativaMarcada === gabaritoReal;

    setRespostas(prev => ({ ...prev, [questao.id]: { marcada: alternativaMarcada, correta: acertou } }));

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('respostas_alunos').insert({
        aluno_id: user.id,
        questao_id: questao.id,
        alternativa_marcada: alternativaMarcada.toUpperCase(),
        foi_correta: acertou
      });
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
          
          {/* Painel de Filtros Completo */}
          <div className="w-full lg:w-1/4">
            <div className="bg-[#131c2f]/30 border border-white/5 p-6 rounded-2xl sticky top-6">
              <div className="flex items-center gap-2 mb-6 text-white">
                <Filter className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold">Filtros</h3>
              </div>

              <div className="space-y-4">
                <DropdownBuscavel label="Banca" placeholder="Ex: FGV" opcoes={opcoes.bancas} valor={bancaSelecionada} setValor={setBancaSelecionada} />
                <DropdownBuscavel label="Cargo" placeholder="Ex: Analista" opcoes={opcoes.cargos} valor={cargoSelecionado} setValor={setCargoSelecionado} />
                
                <div className="h-px bg-white/5 my-4"></div>

                <DropdownBuscavel label="Matéria" placeholder="Ex: Direito Constitucional" opcoes={opcoes.materias} valor={materiaSelecionada} setValor={setMateriaSelecionada} />
                <DropdownBuscavel 
                  label="Tópico" 
                  placeholder="Ex: Direitos Fundamentais" 
                  opcoes={opcoes.topicos} 
                  valor={topicoSelecionado} 
                  setValor={setTopicoSelecionado} 
                  disabled={!materiaSelecionada} // Bloqueia se não tiver matéria
                />

                <div className="h-px bg-white/5 my-4"></div>

                <div className="grid grid-cols-2 gap-4">
                  <DropdownBuscavel label="Ano" placeholder="Ex: 2024" opcoes={opcoes.anos} valor={anoSelecionado} setValor={setAnoSelecionado} />
                  <DropdownBuscavel label="Formato" placeholder="Ex: Múltipla" opcoes={opcoes.formatos} valor={formatoSelecionado} setValor={setFormatoSelecionado} />
                </div>

                <button onClick={() => buscarQuestoes(0)} className="w-full mt-6 bg-emerald-600 hover:bg-emerald-500 text-black font-black uppercase text-[10px] tracking-widest py-4 rounded-xl flex items-center justify-center gap-2 transition-colors">
                  <Search className="w-4 h-4" /> Aplicar Filtros
                </button>
                {(totalResultados > 0 || questoes.length > 0) && (
                  <p className="text-center text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-4">
                    {totalResultados} {totalResultados === 1 ? 'questão encontrada' : 'questões encontradas'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Feed de Questões */}
          <div className="w-full lg:w-3/4 space-y-6">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              </div>
            ) : questoes.length > 0 ? (
              questoes.map((questao) => {
                const statusResposta = respostas[questao.id];
                const jaRespondida = !!statusResposta;
                const selecionada = selecoes[questao.id];
                const gabaritoCorreto = questao.gabarito.toLowerCase();

                return (
                  <div key={questao.id} className="bg-[#131c2f]/20 border border-white/5 p-6 md:p-8 rounded-3xl">
                    
                    <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-6">
                      {questao.ano && <span className="bg-white/5 px-3 py-1 rounded-md">{questao.ano}</span>}
                      {questao.banca && <span className="bg-white/5 px-3 py-1 rounded-md">{questao.banca}</span>}
                      {questao.orgao && <span className="bg-white/5 px-3 py-1 rounded-md">{questao.orgao}</span>}
                      {questao.cargo && <span className="bg-white/5 px-3 py-1 rounded-md">{questao.cargo}</span>}
                      {questao.materia && <span className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-md">{questao.materia}</span>}
                      {questao.topico && <span className="bg-white/5 px-3 py-1 rounded-md">{questao.topico}</span>}
                    </div>

                    <div className="text-zinc-200 leading-relaxed mb-8 text-sm md:text-base whitespace-pre-wrap">
                      {questao.enunciado}
                    </div>

                    <div className="space-y-3">
                    {['a', 'b', 'c', 'd', 'e'].map((letra) => {
  const alternativaTexto = questao[`alternativa_${letra}`];
  
  // Ignora se for vazio, se for o texto "null" ou se tiver apenas espaços
  if (!alternativaTexto || String(alternativaTexto).trim().toLowerCase() === 'null' || String(alternativaTexto).trim() === '') {
    return null;
  }

                        let estiloBotao = "border-white/5 bg-[#09090b] hover:border-white/20 text-zinc-400";
                        let estiloLetra = "border-white/10 text-zinc-400";
                        
                        if (jaRespondida) {
                          if (letra === gabaritoCorreto) {
                            estiloBotao = "border-emerald-500/50 bg-emerald-500/10 text-emerald-500";
                            estiloLetra = "border-emerald-500 bg-emerald-500 text-black";
                          } else if (letra === statusResposta.marcada && !statusResposta.correta) {
                            estiloBotao = "border-red-500/50 bg-red-500/10 text-red-500";
                            estiloLetra = "border-red-500 bg-red-500 text-black";
                          } else {
                            estiloBotao = "border-white/5 bg-[#09090b] opacity-40 cursor-default text-zinc-600";
                            estiloLetra = "border-white/5 text-zinc-700";
                          }
                        } else if (selecionada === letra) {
                          estiloBotao = "border-zinc-400/50 bg-zinc-800/50 text-zinc-200";
                          estiloLetra = "border-zinc-400 bg-zinc-400 text-black";
                        }

                        return (
                          <button 
                            key={letra}
                            onClick={() => selecionarAlternativa(questao.id, letra)}
                            disabled={jaRespondida}
                            className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-4 ${estiloBotao}`}
                          >
                            <span className={`flex-shrink-0 w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold uppercase transition-colors ${estiloLetra}`}>
                              {jaRespondida && letra === statusResposta?.marcada ? (
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

                    {!jaRespondida && (
                      <div className="mt-6 flex justify-end">
                        <button
                          onClick={() => confirmarResposta(questao)}
                          disabled={!selecionada}
                          className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-black font-black uppercase text-[10px] tracking-widest rounded-xl transition-colors"
                        >
                          Responder
                        </button>
                      </div>
                    )}

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

            {questoes.length > 0 && questoes.length < totalResultados && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={() => buscarQuestoes(Math.ceil(questoes.length / TAMANHO_PAGINA))}
                  disabled={carregandoMais}
                  className="px-8 py-3 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-zinc-300 font-black uppercase text-[10px] tracking-widest rounded-xl transition-colors flex items-center gap-2 border border-white/10"
                >
                  {carregandoMais ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
                  Carregar mais
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}