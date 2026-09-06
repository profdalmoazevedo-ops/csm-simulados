"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Filter, Sliders, Loader2, Zap, X, PenTool, History, Play, Trash2, AlertCircle, CheckCircle2, Clock, Flame, BookX } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const MultiSelectBuscavel = ({ label, placeholder, opcoes, valores, setValores, disabled = false }: { label: string, placeholder: string, opcoes: {label: string, value: string}[], valores: string[], setValores: (v: string[]) => void, disabled?: boolean }) => {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');

  const opcoesFiltradas = opcoes.filter(op => 
    op.label.toLowerCase().includes(busca.toLowerCase()) && !valores.includes(op.value)
  );

  const removerValor = (valorParaRemover: string) => {
    setValores(valores.filter(v => v !== valorParaRemover));
  };

  return (
    <div className="relative">
      <label className={`block text-xs font-bold uppercase mb-2 ${disabled ? 'text-zinc-600' : 'text-zinc-400'}`}>{label}</label>
      
      <div className={`w-full bg-[#09090b] border rounded-lg p-2 min-h-[50px] transition-colors flex flex-wrap gap-2 items-center ${
        disabled ? 'border-white/5 bg-black/20 cursor-not-allowed' : 'border-white/10 focus-within:border-blue-500'
      }`}>
        {valores.map(v => (
           <span key={v} className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs px-2 py-1.5 rounded-md flex items-center gap-1.5">
             {v} 
             <button type="button" onClick={() => removerValor(v)} className="hover:text-red-400 transition-colors">
               <X className="w-3 h-3" />
             </button>
           </span>
        ))}
        
        <input 
          type="text"
          value={busca}
          disabled={disabled}
          onChange={(e) => { setBusca(e.target.value); setAberto(true); }}
          onFocus={() => setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 200)}
          placeholder={valores.length === 0 ? (disabled ? "Selecione uma matéria primeiro..." : placeholder) : ""}
          className="flex-1 bg-transparent border-none text-sm text-zinc-200 focus:outline-none min-w-[120px] px-2 py-1"
        />
      </div>

      {aberto && !disabled && opcoesFiltradas.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-[#131c2f] border border-white/10 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {opcoesFiltradas.map((op) => (
            <li 
              key={op.value}
              onMouseDown={(e) => {
                e.preventDefault();
                setValores([...valores, op.value]);
                setBusca('');
                setAberto(false);
              }}
              className="px-4 py-3 text-sm text-zinc-300 hover:bg-blue-500/20 hover:text-blue-500 cursor-pointer transition-colors"
            >
              {op.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const traduzirFormatoParaExibicao = (val: string) => {
  if (val === 'certo_errado') return 'Certo ou Errado';
  if (val === 'multipla_escolha') return 'Múltipla Escolha';
  return val;
};

const traduzirFormatoParaBanco = (val: string) => {
  if (val === 'Certo ou Errado') return 'certo_errado';
  if (val === 'Múltipla Escolha') return 'multipla_escolha';
  return val;
};

export default function GeradorSimulados() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [loadingErros, setLoadingErros] = useState(false);
  
  // Controle de Abas
  const [abaAtiva, setAbaAtiva] = useState<'gerar' | 'historico' | 'erros'>('gerar');
  const [historicoSimulados, setHistoricoSimulados] = useState<any[]>([]);
  
  // 🚀 NOVO ESTADO: Dados do Caderno de Erros
  const [estatisticasErros, setEstatisticasErros] = useState({
    totalRespondidas: 0,
    totalErros: 0,
    questoesComErroIds: [] as string[]
  });

  const [dadosBase, setDadosBase] = useState<any[]>([]);
  const [questoesRespondidas, setQuestoesRespondidas] = useState<Set<string>>(new Set());
  
  const [nomeSimulado, setNomeSimulado] = useState('');
  const [bancasSelecionadas, setBancasSelecionadas] = useState<string[]>([]);
  const [materiasSelecionadas, setMateriasSelecionadas] = useState<string[]>([]);
  const [anosSelecionados, setAnosSelecionados] = useState<string[]>([]);
  const [cargosSelecionados, setCargosSelecionados] = useState<string[]>([]);
  const [formatosSelecionados, setFormatosSelecionados] = useState<string[]>([]);
  const [topicosSelecionados, setTopicosSelecionados] = useState<string[]>([]);
  
  const [quantidadeQuestoes, setQuantidadeQuestoes] = useState(10);
  const [incluirRespondidas, setIncluirRespondidas] = useState(false);

  // Lê a URL na montagem para abrir a aba certa (caso venha do painel de desempenho)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const aba = urlParams.get('aba');
      if (aba === 'erros' || aba === 'historico' || aba === 'gerar') {
        setAbaAtiva(aba);
      }
    }
  }, []);

  useEffect(() => {
    async function carregarBaseDeDados() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: respostas } = await supabase.from('respostas_alunos').select('questao_id').eq('aluno_id', user.id);
        if (respostas) setQuestoesRespondidas(new Set(respostas.map(r => r.questao_id)));
      }

      const { data, error } = await supabase.from('questoes').select('id, banca, materia, ano, cargo, topico, tipo_questao');
      if (data && !error) setDadosBase(data);
    }
    carregarBaseDeDados();
  }, []);

  useEffect(() => {
    if (abaAtiva === 'historico') carregarHistorico();
    if (abaAtiva === 'erros') carregarDadosErros();
  }, [abaAtiva]);

  async function carregarHistorico() {
    setLoadingHistorico(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: simulados, error } = await supabase
        .from('simulados')
        .select(`
          id,
          titulo,
          criado_em,
          simulado_questoes (count)
        `)
        .eq('tipo', 'gerado_aluno')
        .eq('criado_por', user.id)
        .order('criado_em', { ascending: false });

      if (error) throw error;

      const { data: respostasSalvas } = await supabase
        .from('respostas_alunos')
        .select('simulado_id')
        .eq('aluno_id', user.id);
      
      const simuladosConcluidos = new Set(respostasSalvas?.map(r => r.simulado_id));

      const simuladosComStatus = (simulados || []).map(simulado => {
        const isConcluido = simuladosConcluidos.has(simulado.id);
        const isEmAndamento = typeof window !== 'undefined' && !!localStorage.getItem(`simulado_progresso_${simulado.id}`);
        
        let status = 'novo';
        if (isConcluido) status = 'concluido';
        else if (isEmAndamento) status = 'andamento';

        return { ...simulado, status };
      });

      setHistoricoSimulados(simuladosComStatus);
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
    } finally {
      setLoadingHistorico(false);
    }
  }

  // 🚀 LÓGICA DE CARREGAMENTO DO CADERNO DE ERROS
  async function carregarDadosErros() {
    setLoadingErros(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('respostas_alunos')
        .select('questao_id, foi_correta')
        .eq('aluno_id', user.id);

      if (error) throw error;

      if (data) {
        // Filtra apenas as questões que ele errou
        const erradasUnicas = new Set(data.filter(r => r.foi_correta === false).map(r => r.questao_id));
        
        setEstatisticasErros({
          totalRespondidas: data.length,
          totalErros: erradasUnicas.size,
          questoesComErroIds: Array.from(erradasUnicas)
        });
      }
    } catch (error) {
      console.error("Erro ao carregar caderno de erros:", error);
    } finally {
      setLoadingErros(false);
    }
  }

  async function excluirSimuladoHistorico(id: string) {
    if (!confirm("Tem certeza que deseja excluir este simulado? Seu progresso nele será perdido.")) return;
    
    try {
      const { error } = await supabase.from('simulados').delete().eq('id', id);
      if (error) throw error;
      
      localStorage.removeItem(`simulado_progresso_${id}`);
      setHistoricoSimulados(prev => prev.filter(s => s.id !== id));
    } catch (error) {
      alert("Erro ao excluir o simulado.");
    }
  }

  // ... (useMemo configs mantidos sem alteração para o gerador principal)
  const opcoes = useMemo(() => {
    const obterBaseFiltrada = (filtroIgnorado: string) => {
      let pool = dadosBase;
      if (!incluirRespondidas) pool = pool.filter(q => !questoesRespondidas.has(q.id));

      if (filtroIgnorado !== 'bancas' && bancasSelecionadas.length > 0) pool = pool.filter(q => bancasSelecionadas.includes(q.banca?.trim()));
      if (filtroIgnorado !== 'cargos' && cargosSelecionados.length > 0) pool = pool.filter(q => cargosSelecionados.includes(q.cargo?.trim()));
      if (filtroIgnorado !== 'materias' && materiasSelecionadas.length > 0) pool = pool.filter(q => materiasSelecionadas.includes(q.materia?.trim()));
      if (filtroIgnorado !== 'topicos' && topicosSelecionados.length > 0) pool = pool.filter(q => topicosSelecionados.includes(q.topico?.trim()));
      if (filtroIgnorado !== 'anos' && anosSelecionados.length > 0) pool = pool.filter(q => anosSelecionados.includes(String(q.ano)));
      if (filtroIgnorado !== 'formatos' && formatosSelecionados.length > 0) {
        const f = formatosSelecionados.map(traduzirFormatoParaBanco);
        pool = pool.filter(q => f.includes(q.tipo_questao?.trim()));
      }
      return pool;
    };

    const gerarDropdown = (chave: string, pool: any[]) => {
      const counts = pool.reduce((acc, q) => {
        let rawVal = q[chave];
        if (!rawVal) return acc;

        let val = '';
        if (chave === 'tipo_questao') val = traduzirFormatoParaExibicao(String(rawVal).trim());
        else if (chave === 'ano') val = String(rawVal);
        else val = String(rawVal).trim();

        if (val && val.toLowerCase() !== 'null') acc[val] = (acc[val] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return Object.keys(counts)
        .sort((a, b) => chave === 'ano' ? Number(b) - Number(a) : a.localeCompare(b))
        .map(k => ({ label: `${k} (${counts[k]})`, value: k }));
    };

    return {
      bancas: gerarDropdown('banca', obterBaseFiltrada('bancas')),
      cargos: gerarDropdown('cargo', obterBaseFiltrada('cargos')),
      materias: gerarDropdown('materia', obterBaseFiltrada('materias')),
      topicos: materiasSelecionadas.length > 0 ? gerarDropdown('topico', obterBaseFiltrada('topicos')) : [],
      anos: gerarDropdown('ano', obterBaseFiltrada('anos')),
      formatos: gerarDropdown('tipo_questao', obterBaseFiltrada('formatos')),
    };
  }, [dadosBase, bancasSelecionadas, cargosSelecionados, materiasSelecionadas, topicosSelecionados, anosSelecionados, formatosSelecionados, incluirRespondidas, questoesRespondidas]);

  const questoesDisponiveis = useMemo(() => {
    let pool = dadosBase;
    if (!incluirRespondidas) pool = pool.filter(q => !questoesRespondidas.has(q.id));
    if (bancasSelecionadas.length > 0) pool = pool.filter(q => bancasSelecionadas.includes(q.banca?.trim()));
    if (cargosSelecionados.length > 0) pool = pool.filter(q => cargosSelecionados.includes(q.cargo?.trim()));
    if (materiasSelecionadas.length > 0) pool = pool.filter(q => materiasSelecionadas.includes(q.materia?.trim()));
    if (topicosSelecionados.length > 0) pool = pool.filter(q => topicosSelecionados.includes(q.topico?.trim()));
    if (anosSelecionados.length > 0) pool = pool.filter(q => anosSelecionados.includes(String(q.ano)));
    if (formatosSelecionados.length > 0) {
      const f = formatosSelecionados.map(traduzirFormatoParaBanco);
      pool = pool.filter(q => f.includes(q.tipo_questao?.trim()));
    }
    return pool.map(q => q.id);
  }, [dadosBase, bancasSelecionadas, cargosSelecionados, materiasSelecionadas, topicosSelecionados, anosSelecionados, formatosSelecionados, incluirRespondidas, questoesRespondidas]);

  const gerarSimulado = async (listaIdsParaGerar: string[] = questoesDisponiveis, tituloPersonalizado?: string) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("Você precisa estar logado para criar um simulado.");
        setLoading(false);
        return;
      }

      // Se não passou título, tenta usar o nome digitado, senão usa padrão
      const tituloFinal = tituloPersonalizado || nomeSimulado.trim() || `Simulado Personalizado - ${new Date().toLocaleDateString('pt-BR')}`;
      
      // No Caderno de Erros, ele já manda a lista fatiada (25 ou 50). No Gerador, pega a state 'quantidadeQuestoes'
      const usarQtdDefinidaPorLista = tituloPersonalizado !== undefined;
      const quantidadeReal = usarQtdDefinidaPorLista ? listaIdsParaGerar.length : Math.min(quantidadeQuestoes, listaIdsParaGerar.length);
      
      // Sorteia as questões
      const selecionadas = listaIdsParaGerar.sort(() => Math.random() - 0.5).slice(0, quantidadeReal);

      const formatosParaBanco = formatosSelecionados.map(traduzirFormatoParaBanco);
      const regraCebraspeAtiva = !usarQtdDefinidaPorLista && formatosParaBanco.length === 1 && formatosParaBanco.includes('certo_errado');

      const { data: novoSimulado, error: erroSimulado } = await supabase
        .from('simulados')
        .insert({
          titulo: tituloFinal,
          tipo: 'gerado_aluno',
          criado_por: user.id,
          visivel: true,
          regra_subtracao: regraCebraspeAtiva,
          data_liberacao: new Date().toISOString(),
          e_gratis: false
        })
        .select()
        .single();

      if (erroSimulado) throw erroSimulado;

      const insercoesQuestoes = selecionadas.map((id, index) => ({
        simulado_id: novoSimulado.id,
        questao_id: id,
        ordem: index + 1
      }));

      const { error: erroInsercao } = await supabase.from('simulado_questoes').insert(insercoesQuestoes);
      
      if (erroInsercao) throw erroInsercao;

      router.push(`/simulado/${novoSimulado.id}`);

    } catch (error) {
      console.error("Erro ao gerar simulado:", error);
      alert("Houve um erro ao montar sua prova. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // Lógica específica acionada pelos botões do Caderno de Erros
  const acionarCadernoErros = (quantidadeDesejada: number) => {
    // Sorteia da lista geral de erros do aluno
    const idsSorteados = [...estatisticasErros.questoesComErroIds]
      .sort(() => Math.random() - 0.5)
      .slice(0, quantidadeDesejada);
    
    gerarSimulado(idsSorteados, `Caderno de Erros - ${new Date().toLocaleDateString('pt-BR')}`);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-[#e4e4e7] font-sans pb-20">
      <div className="max-w-4xl mx-auto px-6 pt-12">
        
        <div className="text-center mb-10">
          <Sliders className="w-12 h-12 text-blue-500 mx-auto mb-6" />
          <h1 className="text-4xl font-serif text-white italic mb-4 uppercase">Meu Laboratório</h1>
          <p className="text-zinc-400">Configure os parâmetros da sua prova ou resgate seus erros.</p>
        </div>

        {/* Sistema de Abas */}
        <div className="flex bg-[#131c2f]/50 p-1 rounded-xl max-w-lg mx-auto mb-10 border border-white/5 overflow-x-auto">
          <button 
            onClick={() => setAbaAtiva('gerar')}
            className={`flex-1 py-2.5 px-4 text-xs font-bold uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap ${abaAtiva === 'gerar' ? "bg-blue-600 text-white shadow-md" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            <Zap className="w-4 h-4" /> Gerar Novo
          </button>
          <button 
            onClick={() => setAbaAtiva('historico')}
            className={`flex-1 py-2.5 px-4 text-xs font-bold uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap ${abaAtiva === 'historico' ? "bg-white/10 text-white shadow-md" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            <History className="w-4 h-4" /> Histórico
          </button>
          
          {/* 🚀 NOVA ABA: CADERNO DE ERROS */}
          <button 
            onClick={() => setAbaAtiva('erros')}
            className={`flex-1 py-2.5 px-4 text-xs font-bold uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap ${abaAtiva === 'erros' ? "bg-orange-600 text-white shadow-md" : "text-zinc-500 hover:text-orange-400/50"}`}
          >
            <Flame className="w-4 h-4" /> Caderno de Erros
          </button>
        </div>

        {/* ==============================================================
            ABA 1: GERAR SIMULADO 
            ============================================================== */}
        {abaAtiva === 'gerar' && (
          <div className="bg-[#131c2f]/30 border border-white/5 p-8 md:p-12 rounded-3xl animate-in fade-in">
            <div className="mb-10">
              <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase mb-3">
                <PenTool className="w-4 h-4" /> Nome do Simulado (Opcional)
              </label>
              <input 
                type="text"
                value={nomeSimulado}
                onChange={(e) => setNomeSimulado(e.target.value)}
                placeholder="Ex: Revisão Final FGV"
                className="w-full bg-[#09090b] border border-white/10 rounded-lg px-4 py-4 text-sm text-white focus:border-blue-500 focus:outline-none transition-colors"
              />
            </div>

            <div className="space-y-10">
              <div>
                <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-4 mb-6 gap-4">
                  <h3 className="flex items-center gap-2 font-bold text-white">
                    <Filter className="w-5 h-5 text-blue-500" /> Direcionamento da Prova
                  </h3>
                  
                  <div className="bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-lg text-blue-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-all">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    {questoesDisponiveis.length} questões disponíveis
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <MultiSelectBuscavel label="Banca" placeholder="Ex: FGV, VUNESP" opcoes={opcoes.bancas} valores={bancasSelecionadas} setValores={setBancasSelecionadas} />
                  <MultiSelectBuscavel label="Cargo" placeholder="Ex: Analista" opcoes={opcoes.cargos} valores={cargosSelecionados} setValores={setCargosSelecionados} />
                  
                  <div className="col-span-1 md:col-span-2 h-px bg-white/5 my-2"></div>
                  
                  <MultiSelectBuscavel label="Matérias" placeholder="Ex: Direito Administrativo" opcoes={opcoes.materias} valores={materiasSelecionadas} setValores={setMateriasSelecionadas} />
                  <MultiSelectBuscavel label="Tópicos" placeholder="Ex: Atos Administrativos" opcoes={opcoes.topicos} valores={topicosSelecionados} setValores={setTopicosSelecionados} disabled={materiasSelecionadas.length === 0} />
                  
                  <div className="col-span-1 md:col-span-2 h-px bg-white/5 my-2"></div>

                  <MultiSelectBuscavel label="Anos" placeholder="Ex: 2024, 2023" opcoes={opcoes.anos} valores={anosSelecionados} setValores={setAnosSelecionados} />
                  <MultiSelectBuscavel label="Formatos" placeholder="Ex: Múltipla Escolha" opcoes={opcoes.formatos} valores={formatosSelecionados} setValores={setFormatosSelecionados} />
                </div>
              </div>

              <div>
                <h3 className="font-bold text-white mb-6 border-b border-white/5 pb-4">Configuração Final</h3>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-4">Quantidade de Questões</label>
                  <div className="flex flex-wrap gap-4">
                    {[10, 20, 30, 50, 100].map(num => (
                      <button
                        key={num}
                        onClick={() => setQuantidadeQuestoes(num)}
                        className={`flex-1 py-4 rounded-xl font-black text-sm transition-all border min-w-[60px] ${
                          quantidadeQuestoes === num 
                            ? 'bg-blue-600 border-blue-500 text-white' 
                            : 'bg-[#09090b] border-white/10 text-zinc-400 hover:border-blue-500/50'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer mt-8 w-fit group">
                    <input 
                      type="checkbox"
                      checked={incluirRespondidas}
                      onChange={(e) => setIncluirRespondidas(e.target.checked)}
                      className="w-5 h-5 rounded border border-white/10 bg-[#09090b] text-blue-600 focus:ring-blue-500 focus:ring-offset-[#09090b] accent-blue-600 cursor-pointer"
                    />
                    <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors">
                      Incluir questões que eu já respondi
                    </span>
                  </label>

                </div>
              </div>

              <button 
                onClick={() => gerarSimulado()}
                disabled={loading || questoesDisponiveis.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white font-black uppercase text-sm tracking-widest py-6 rounded-2xl flex items-center justify-center gap-3 transition-colors mt-8 shadow-xl shadow-blue-900/20"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Zap className="w-6 h-6" /> Gerar Prova e Começar</>}
              </button>
            </div>
          </div>
        )}

        {/* ==============================================================
            ABA 2: HISTÓRICO DE SIMULADOS 
            ============================================================== */}
        {abaAtiva === 'historico' && (
          <div className="animate-in fade-in">
            {loadingHistorico ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
              </div>
            ) : historicoSimulados.length === 0 ? (
              <div className="text-center py-20 bg-[#131c2f]/30 border border-white/5 rounded-3xl">
                <AlertCircle className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-zinc-300">Você ainda não gerou nenhuma prova.</h3>
                <p className="text-sm text-zinc-500 mt-2">Crie seu primeiro simulado personalizado na aba ao lado.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {historicoSimulados.map((simulado) => {
                  const qtdQuestoes = simulado.simulado_questoes[0]?.count || 0;
                  const dataFormatada = new Date(simulado.criado_em).toLocaleDateString('pt-BR');

                  let corStatus = "text-zinc-400 bg-white/5 border-white/10";
                  let iconeStatus = <Zap className="w-3 h-3" />;
                  let textoStatus = "Não Iniciado";
                  let textoBotao = "Iniciar";

                  if (simulado.status === 'concluido') {
                    corStatus = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
                    iconeStatus = <CheckCircle2 className="w-3 h-3" />;
                    textoStatus = "Concluído";
                    textoBotao = "Ver Resultado";
                  } else if (simulado.status === 'andamento') {
                    corStatus = "text-amber-400 bg-amber-500/10 border-amber-500/20";
                    iconeStatus = <Clock className="w-3 h-3" />;
                    textoStatus = "Pausado";
                    textoBotao = "Continuar";
                  }

                  return (
                    <div key={simulado.id} className={`bg-[#131c2f]/30 border p-5 md:p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 transition-colors hover:border-blue-500/30 ${simulado.status === 'concluido' ? 'border-white/5' : 'border-white/10'}`}>
                      <div>
                        
                        <div className="flex items-center gap-3 mb-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border ${corStatus}`}>
                            {iconeStatus} {textoStatus}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                            Criado em {dataFormatada}
                          </span>
                        </div>
                        
                        <h3 className="text-lg font-bold text-white mb-2">{simulado.titulo}</h3>
                        <p className="text-sm font-medium text-blue-400">
                          {qtdQuestoes} Questões
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <Link 
                          href={`/simulado/${simulado.id}`}
                          className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-sm ${simulado.status === 'concluido' ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                        >
                          <Play className="w-4 h-4 fill-current" /> {textoBotao}
                        </Link>
                        <button 
                          onClick={() => excluirSimuladoHistorico(simulado.id)}
                          className="p-3 bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 rounded-xl transition-colors"
                          title="Excluir Histórico"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==============================================================
            ABA 3: CADERNO DE ERROS (A RESGATE)
            ============================================================== */}
        {abaAtiva === 'erros' && (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            {loadingErros ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              </div>
            ) : estatisticasErros.totalErros === 0 ? (
              <div className="text-center py-20 bg-[#131c2f]/30 border border-white/5 rounded-3xl">
                <BookX className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-white uppercase tracking-widest mb-2">Histórico Impecável</h3>
                <p className="text-sm text-zinc-400">Você ainda não errou nenhuma questão resolvida na plataforma.<br/>Continue assim!</p>
              </div>
            ) : (
              <div className="bg-[#131c2f]/30 border-2 border-orange-500/20 p-8 md:p-12 rounded-3xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                  <Flame className="w-64 h-64 text-orange-500" />
                </div>
                
                <div className="relative z-10">
                  <div className="mb-8">
                    <h2 className="text-2xl font-black text-white uppercase tracking-widest flex items-center gap-3 mb-2">
                      <Flame className="w-8 h-8 text-orange-500" />
                      Caderno de Erros
                    </h2>
                    <p className="text-zinc-400 text-sm max-w-xl">
                      A repetição espaçada focada nos seus erros é a ferramenta mais poderosa para aprovação. O sistema identificou <strong className="text-orange-400">{estatisticasErros.totalErros} questões</strong> que você errou no passado. Vamos enfrentá-las novamente?
                    </p>
                  </div>

                  {/* CARDS DE RESUMO DO ERRO */}
                  <div className="grid grid-cols-2 gap-4 mb-10 max-w-lg">
                    <div className="bg-[#09090b] border border-white/5 p-5 rounded-2xl">
                      <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Total Respondidas</span>
                      <span className="text-2xl font-black text-white">{estatisticasErros.totalRespondidas}</span>
                    </div>
                    <div className="bg-orange-500/10 border border-orange-500/20 p-5 rounded-2xl">
                      <span className="block text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-1">Questões Erradas</span>
                      <span className="text-2xl font-black text-orange-400">{estatisticasErros.totalErros}</span>
                    </div>
                  </div>

                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5 pb-4 mb-6">
                    Gerar Simulado de Resgate Aleatório
                  </h3>

                  <div className="flex flex-col sm:flex-row gap-4 max-w-lg">
                    <button 
                      onClick={() => acionarCadernoErros(25)}
                      disabled={loading || estatisticasErros.totalErros === 0}
                      className="flex-1 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-black uppercase text-xs tracking-widest py-5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-900/20"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Play className="w-4 h-4 fill-current" /> 25 Questões</>}
                    </button>
                    
                    <button 
                      onClick={() => acionarCadernoErros(50)}
                      disabled={loading || estatisticasErros.totalErros < 50}
                      className="flex-1 bg-[#09090b] border-2 border-orange-500/30 hover:border-orange-500 disabled:opacity-50 text-orange-500 hover:text-orange-400 font-black uppercase text-xs tracking-widest py-5 rounded-xl flex items-center justify-center gap-2 transition-all"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Play className="w-4 h-4 fill-current" /> 50 Questões</>}
                    </button>
                  </div>

                  {estatisticasErros.totalErros > 0 && estatisticasErros.totalErros < 50 && (
                    <p className="text-[10px] text-zinc-500 mt-4 uppercase tracking-widest">
                      * O pacote de 50 questões requer mais erros acumulados no histórico.
                    </p>
                  )}
                  
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}