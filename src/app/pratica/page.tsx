"use client";

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import ReportarErroQuestao from '@/components/ReportarErroQuestao';
import { Filter, Loader2, BookOpen, CheckCircle2, XCircle, MessageSquare, ChevronDown, Hash, Copy, Check, RefreshCw } from 'lucide-react';

const TAMANHO_PAGINA = 15;

type Situacao = 'todas' | 'nao_respondidas' | 'erradas' | 'acertadas';

const OPCOES_SITUACAO: { valor: Situacao; rotulo: string }[] = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'nao_respondidas', rotulo: 'Não respondidas' },
  { valor: 'erradas', rotulo: 'Só as que errei' },
  { valor: 'acertadas', rotulo: 'Só as que acertei' }
];

const OPCOES_PERIODO: { valor: string; rotulo: string }[] = [
  { valor: '', rotulo: 'Qualquer data' },
  { valor: '7d', rotulo: 'Últimos 7 dias' },
  { valor: '1m', rotulo: 'Último mês' },
  { valor: '3m', rotulo: 'Últimos 3 meses' },
  { valor: '6m', rotulo: 'Últimos 6 meses' }
];

const OPCOES_ORDEM: { valor: string; rotulo: string }[] = [
  { valor: 'id', rotulo: 'Ordem padrão' },
  { valor: 'aleatorio', rotulo: 'Aleatória' },
  { valor: 'recentes', rotulo: 'Mais recentes' },
  { valor: 'antigas', rotulo: 'Mais antigas' }
];

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
    orgaos: [] as string[],
    formatos: [] as string[],
    topicos: [] as string[]
  });

  const [bancaSelecionada, setBancaSelecionada] = useState('');
  const [materiaSelecionada, setMateriaSelecionada] = useState('');
  const [anoSelecionado, setAnoSelecionado] = useState('');
  const [cargoSelecionado, setCargoSelecionado] = useState('');
  const [orgaoSelecionado, setOrgaoSelecionado] = useState('');
  const [formatoSelecionado, setFormatoSelecionado] = useState('');
  const [topicoSelecionado, setTopicoSelecionado] = useState('');
  const [situacao, setSituacao] = useState<Situacao>('todas');
  const [periodo, setPeriodo] = useState('');
  const [ordem, setOrdem] = useState('id');

  const [paginaAtual, setPaginaAtual] = useState(0);
  const requisicaoAtual = useRef(0);

  const [selecoes, setSelecoes] = useState<Record<string, string>>({});
  const [respostas, setRespostas] = useState<Record<string, { marcada: string; correta: boolean }>>({});
  const [idCopiado, setIdCopiado] = useState('');

  const copiarQuestaoId = async (questaoId: string) => {
    try {
      await navigator.clipboard.writeText(questaoId);
      setIdCopiado(questaoId);
      setTimeout(() => setIdCopiado(''), 2000);
    } catch (error) {
      console.error("Erro ao copiar ID da questão:", error);
    }
  };

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
          orgaos: [...new Set(valoresDe('orgao'))].sort(),
          formatos: [...new Set(valoresDe('tipo_questao'))].sort(),
          topicos: []
        });
      }
    }
    carregarOpcoesFiltro();
  }, []);

  // 2. Atualiza a lista de Tópicos SEMPRE que a Matéria mudar (view de cascade).
  // O Tópico selecionado é zerado junto com a Matéria (ver selecionarMateria),
  // e não aqui dentro, para não disparar uma busca com o tópico antigo.
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
      setOpcoes(prev => ({ ...prev, topicos: [] }));
    }
  }, [materiaSelecionada]);

  const selecionarMateria = (materia: string) => {
    setMateriaSelecionada(materia);
    setTopicoSelecionado('');
  };

  // Filtros, ordenação, situação e paginação rodam no banco: excluir as questões
  // já respondidas exigiria uma lista de ids que não cabe na URL, e o contador
  // só é exato se o total for calculado com os mesmos filtros da página.
  const buscarQuestoes = async (pagina = 0) => {
    if (pagina === 0) setLoading(true);
    else setCarregandoMais(true);

    requisicaoAtual.current += 1;
    const requisicao = requisicaoAtual.current;

    try {
      const { data, error } = await supabase.rpc('obter_pagina_questoes', {
        p_banca: bancaSelecionada || null,
        p_cargo: cargoSelecionado || null,
        p_orgao: orgaoSelecionado || null,
        p_materia: materiaSelecionada || null,
        p_topico: topicoSelecionado || null,
        p_ano: anoSelecionado || null,
        p_formato: formatoSelecionado || null,
        p_periodo: periodo || null,
        p_situacao: situacao,
        p_ordem: ordem,
        p_limite: TAMANHO_PAGINA,
        p_offset: pagina * TAMANHO_PAGINA
      });

      // Com filtros aplicados automaticamente, uma resposta antiga pode chegar
      // depois de uma mais nova; nesse caso é descartada em vez de sobrescrever.
      if (requisicao !== requisicaoAtual.current) return;

      if (error) throw error;

      const itens = data?.itens ?? [];

      if (pagina === 0) {
        setQuestoes(itens);
      } else {
        // Na ordem aleatória o banco pode repetir uma questão entre lotes; o
        // offset avança pela página, não pelo tamanho da lista, para não pular
        // conteúdo por causa dessa repetição.
        setQuestoes(prev => {
          const vistos = new Set(prev.map(q => q.id));
          return [...prev, ...itens.filter((q: { id: string }) => !vistos.has(q.id))];
        });
      }

      setPaginaAtual(pagina);
      setTotalResultados(data?.total ?? 0);
    } catch (error) {
      if (requisicao === requisicaoAtual.current) console.error("Erro ao buscar questões:", error);
    } finally {
      // Só a requisição mais recente pode desligar os indicadores: se uma
      // resposta velha terminasse agora, ela apagaria o spinner de uma
      // requisição nova que ainda está em andamento.
      if (requisicao === requisicaoAtual.current) {
        setLoading(false);
        setCarregandoMais(false);
      }
    }
  };

  // Carrega no primeiro render e a cada mudança de filtro: contador e lista
  // reagem sozinhos, sem depender do botão. O botão "Aplicar Filtros" continua
  // existindo como refresh manual (útil depois de responder uma questão, que
  // também altera o resultado dos filtros de situação).
  useEffect(() => {
    buscarQuestoes(0);
  }, [bancaSelecionada, cargoSelecionado, orgaoSelecionado, materiaSelecionada, topicoSelecionado, anoSelecionado, formatoSelecionado, situacao, periodo, ordem]);

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
            <div className="bg-[#131c2f]/30 border border-white/5 p-6 rounded-2xl sticky top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
              <div className="flex items-center gap-2 mb-6 text-white">
                <Filter className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold">Filtros</h3>
              </div>

              <div className="space-y-4">
                <DropdownBuscavel label="Banca" placeholder="Ex: FGV" opcoes={opcoes.bancas} valor={bancaSelecionada} setValor={setBancaSelecionada} />
                <DropdownBuscavel label="Cargo" placeholder="Ex: Analista" opcoes={opcoes.cargos} valor={cargoSelecionado} setValor={setCargoSelecionado} />
                <DropdownBuscavel label="Órgão" placeholder="Ex: Prefeitura..." opcoes={opcoes.orgaos} valor={orgaoSelecionado} setValor={setOrgaoSelecionado} />
                
                <div className="h-px bg-white/5 my-4"></div>

                <DropdownBuscavel label="Matéria" placeholder="Ex: Direito Constitucional" opcoes={opcoes.materias} valor={materiaSelecionada} setValor={selecionarMateria} />
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

                <div className="h-px bg-white/5 my-4"></div>

                <div>
                  <label className="block text-xs font-bold uppercase mb-2 text-zinc-400">Situação</label>
                  <div className="space-y-2">
                    {OPCOES_SITUACAO.map((opcao) => (
                      <button
                        key={opcao.valor}
                        type="button"
                        onClick={() => setSituacao(opcao.valor)}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-colors ${
                          situacao === opcao.valor
                            ? 'bg-emerald-600 border-emerald-600 text-black'
                            : 'bg-[#09090b] border-white/10 text-zinc-400 hover:border-white/25 hover:text-zinc-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${situacao === opcao.valor ? 'bg-black' : 'bg-white/20'}`} />
                        {opcao.rotulo}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="filtro-periodo" className="block text-xs font-bold uppercase mb-2 text-zinc-400">Adicionadas recentemente</label>
                  <select
                    id="filtro-periodo"
                    value={periodo}
                    onChange={(e) => setPeriodo(e.target.value)}
                    className="w-full bg-[#09090b] border border-white/10 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                  >
                    {OPCOES_PERIODO.map((opcao) => (
                      <option key={opcao.valor} value={opcao.valor} className="bg-[#09090b]">{opcao.rotulo}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="filtro-ordem" className="block text-xs font-bold uppercase mb-2 text-zinc-400">Ordenação</label>
                  <select
                    id="filtro-ordem"
                    value={ordem}
                    onChange={(e) => setOrdem(e.target.value)}
                    className="w-full bg-[#09090b] border border-white/10 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                  >
                    {OPCOES_ORDEM.map((opcao) => (
                      <option key={opcao.valor} value={opcao.valor} className="bg-[#09090b]">{opcao.rotulo}</option>
                    ))}
                  </select>
                </div>

                {ordem === 'aleatorio' && (
                  <p className="text-[10px] leading-relaxed text-amber-500/80 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                    Na ordem aleatória cada página do “Carregar mais” é um novo sorteio, então algumas questões podem se repetir.
                  </p>
                )}

                <button onClick={() => buscarQuestoes(0)} className="w-full mt-6 bg-emerald-600 hover:bg-emerald-500 text-black font-black uppercase text-[10px] tracking-widest py-4 rounded-xl flex items-center justify-center gap-2 transition-colors">
                  <RefreshCw className="w-4 h-4" /> Atualizar Resultado
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
                      {questao.ano && <span className="bg-white/5 px-3 py-1 rounded-md">{questao.ano}</span>}
                      {questao.banca && <span className="bg-white/5 px-3 py-1 rounded-md">{questao.banca}</span>}
                      {questao.orgao && <span className="bg-white/5 px-3 py-1 rounded-md">{questao.orgao}</span>}
                      {questao.cargo && <span className="bg-white/5 px-3 py-1 rounded-md">{questao.cargo}</span>}
                      {questao.materia && <span className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-md">{questao.materia}</span>}
                      {questao.topico && <span className="bg-white/5 px-3 py-1 rounded-md">{questao.topico}</span>}
                      <ReportarErroQuestao questaoId={questao.id} className="ml-auto" />
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
                  onClick={() => buscarQuestoes(paginaAtual + 1)}
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