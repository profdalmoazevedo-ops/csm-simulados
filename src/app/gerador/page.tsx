"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Filter, Sliders, Loader2, Zap, X, Check, PenTool } from 'lucide-react';
import { useRouter } from 'next/navigation';

// Componente ajustado para receber { label, value } e exibir a contagem
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
        {/* As tags mostram apenas o nome limpo (value), sem a contagem, para ficar elegante */}
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
  
  const [dadosBase, setDadosBase] = useState<any[]>([]);
  const [questoesRespondidas, setQuestoesRespondidas] = useState<Set<string>>(new Set());
  
  // O tipo agora é um array de objetos {label, value}
  const [opcoes, setOpcoes] = useState({ 
    bancas: [] as {label: string, value: string}[], 
    materias: [] as {label: string, value: string}[], 
    anos: [] as {label: string, value: string}[], 
    cargos: [] as {label: string, value: string}[], 
    formatos: [] as {label: string, value: string}[], 
    topicos: [] as {label: string, value: string}[] 
  });

  const [nomeSimulado, setNomeSimulado] = useState('');
  const [bancasSelecionadas, setBancasSelecionadas] = useState<string[]>([]);
  const [materiasSelecionadas, setMateriasSelecionadas] = useState<string[]>([]);
  const [anosSelecionados, setAnosSelecionados] = useState<string[]>([]);
  const [cargosSelecionados, setCargosSelecionados] = useState<string[]>([]);
  const [formatosSelecionados, setFormatosSelecionados] = useState<string[]>([]);
  const [topicosSelecionados, setTopicosSelecionados] = useState<string[]>([]);
  
  const [quantidadeQuestoes, setQuantidadeQuestoes] = useState(10);
  const [incluirRespondidas, setIncluirRespondidas] = useState(false);

  useEffect(() => {
    async function carregarBaseDeDados() {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: respostas } = await supabase.from('respostas_alunos').select('questao_id').eq('aluno_id', user.id);
        if (respostas) setQuestoesRespondidas(new Set(respostas.map(r => r.questao_id)));
      }

      const { data, error } = await supabase.from('questoes').select('id, banca, materia, ano, cargo, topico, tipo_questao');
      if (data && !error) {
        setDadosBase(data);
        
        // Calcula a quantidade por Matéria
        const countMaterias = data.reduce((acc, q) => {
          const m = q.materia?.trim();
          if (m) acc[m] = (acc[m] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const formatosTraduzidos = data.map(q => traduzirFormatoParaExibicao(q.tipo_questao?.trim())).filter(Boolean);

        setOpcoes(prev => ({
          ...prev,
          // Transforma as arrays simples em arrays de objetos {label, value}
          bancas: [...new Set(data.map(q => q.banca?.trim()).filter(Boolean))].sort().map(v => ({label: String(v), value: String(v)})),
          cargos: [...new Set(data.map(q => q.cargo?.trim()).filter(Boolean))].sort().map(v => ({label: String(v), value: String(v)})),
          anos: [...new Set(data.map(q => q.ano).filter(Boolean))].sort((a, b) => b - a).map(v => ({label: String(v), value: String(v)})),
          formatos: [...new Set(formatosTraduzidos)].sort().map(v => ({label: String(v), value: String(v)})),
          
          // Adiciona as contagens no label das matérias
          materias: Object.keys(countMaterias).sort().map(m => ({ label: `${m} (${countMaterias[m]})`, value: m }))
        }));
      }
    }
    carregarBaseDeDados();
  }, []);

  // Calcula a quantidade por Tópico baseado na Matéria selecionada
  useEffect(() => {
    if (materiasSelecionadas.length > 0) {
      const topicosDasMaterias = dadosBase.filter(q => materiasSelecionadas.includes(q.materia?.trim()));
      
      const countTopicos = topicosDasMaterias.reduce((acc, q) => {
        const t = q.topico?.trim();
        if (t) acc[t] = (acc[t] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      setOpcoes(prev => ({ 
        ...prev, 
        topicos: Object.keys(countTopicos).sort().map(t => ({ label: `${t} (${countTopicos[t]})`, value: t })) 
      }));
    } else {
      setTopicosSelecionados([]); 
      setOpcoes(prev => ({ ...prev, topicos: [] }));
    }
  }, [materiasSelecionadas, dadosBase]);

  const questoesDisponiveis = useMemo(() => {
    let filtradas = dadosBase;

    if (bancasSelecionadas.length > 0) filtradas = filtradas.filter(q => bancasSelecionadas.includes(q.banca?.trim()));
    if (materiasSelecionadas.length > 0) filtradas = filtradas.filter(q => materiasSelecionadas.includes(q.materia?.trim()));
    if (anosSelecionados.length > 0) filtradas = filtradas.filter(q => anosSelecionados.includes(String(q.ano)));
    if (cargosSelecionados.length > 0) filtradas = filtradas.filter(q => cargosSelecionados.includes(q.cargo?.trim()));
    if (topicosSelecionados.length > 0) filtradas = filtradas.filter(q => topicosSelecionados.includes(q.topico?.trim()));
    
    if (formatosSelecionados.length > 0) {
      const formatosParaBanco = formatosSelecionados.map(traduzirFormatoParaBanco);
      filtradas = filtradas.filter(q => formatosParaBanco.includes(q.tipo_questao?.trim()));
    }

    if (!incluirRespondidas) {
      filtradas = filtradas.filter(q => !questoesRespondidas.has(q.id));
    }

    return filtradas.map(q => q.id);
  }, [dadosBase, bancasSelecionadas, materiasSelecionadas, anosSelecionados, cargosSelecionados, topicosSelecionados, formatosSelecionados, incluirRespondidas, questoesRespondidas]);


  const gerarSimulado = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("Você precisa estar logado para criar um simulado.");
        setLoading(false);
        return;
      }

      if (questoesDisponiveis.length === 0) {
        alert("Nenhuma questão encontrada com esses filtros. Tente ampliar sua busca.");
        setLoading(false);
        return;
      }

      const quantidadeReal = Math.min(quantidadeQuestoes, questoesDisponiveis.length);
      const selecionadas = questoesDisponiveis.sort(() => Math.random() - 0.5).slice(0, quantidadeReal);

      const formatosParaBanco = formatosSelecionados.map(traduzirFormatoParaBanco);
      const regraCebraspeAtiva = formatosParaBanco.length === 1 && formatosParaBanco.includes('certo_errado');

      const tituloFinal = nomeSimulado.trim() || `Simulado Personalizado - ${new Date().toLocaleDateString('pt-BR')}`;

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

  return (
    <div className="min-h-screen bg-[#09090b] text-[#e4e4e7] font-sans pb-20">
      <div className="max-w-4xl mx-auto px-6 pt-12">
        
        <div className="text-center mb-12">
          <Sliders className="w-12 h-12 text-blue-500 mx-auto mb-6" />
          <h1 className="text-4xl font-serif text-white italic mb-4 uppercase">Criar Simulado</h1>
          <p className="text-zinc-400">Configure os parâmetros da sua prova. O sistema montará um simulado inédito para você.</p>
        </div>

        <div className="bg-[#131c2f]/30 border border-white/5 p-8 md:p-12 rounded-3xl">
          
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
              onClick={gerarSimulado}
              disabled={loading || questoesDisponiveis.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white font-black uppercase text-sm tracking-widest py-6 rounded-2xl flex items-center justify-center gap-3 transition-colors mt-8 shadow-xl shadow-blue-900/20"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Zap className="w-6 h-6" /> Gerar Prova e Começar</>}
            </button>
          </div>
          
        </div>
      </div>
    </div>
  );
}