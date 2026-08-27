"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Filter, Sliders, Loader2, Zap, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

const MultiSelectBuscavel = ({ label, placeholder, opcoes, valores, setValores, disabled = false }: { label: string, placeholder: string, opcoes: any[], valores: string[], setValores: (v: string[]) => void, disabled?: boolean }) => {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');

  const opcoesFiltradas = opcoes.filter(op => 
    String(op).toLowerCase().includes(busca.toLowerCase()) && !valores.includes(String(op))
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
              key={op}
              onMouseDown={(e) => {
                e.preventDefault();
                setValores([...valores, String(op)]);
                setBusca('');
                setAberto(false);
              }}
              className="px-4 py-3 text-sm text-zinc-300 hover:bg-blue-500/20 hover:text-blue-500 cursor-pointer transition-colors"
            >
              {op}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// Funções de tradução do formato
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
  
  const [opcoes, setOpcoes] = useState({ bancas: [] as string[], materias: [] as string[], anos: [] as number[], cargos: [] as string[], formatos: [] as string[], topicos: [] as string[] });

  const [bancasSelecionadas, setBancasSelecionadas] = useState<string[]>([]);
  const [materiasSelecionadas, setMateriasSelecionadas] = useState<string[]>([]);
  const [anosSelecionados, setAnosSelecionados] = useState<string[]>([]);
  const [cargosSelecionados, setCargosSelecionados] = useState<string[]>([]);
  const [formatosSelecionados, setFormatosSelecionados] = useState<string[]>([]);
  const [topicosSelecionados, setTopicosSelecionados] = useState<string[]>([]);
  
  const [quantidadeQuestoes, setQuantidadeQuestoes] = useState(10);

  useEffect(() => {
    async function carregarOpcoesFiltro() {
      const { data, error } = await supabase.from('questoes').select('banca, materia, ano, cargo, topico, tipo_questao');
      if (data && !error) {
        setDadosBase(data);
        
        // Aplica a tradução na hora de montar a lista de opções de formato
        const formatosTraduzidos = data.map(q => traduzirFormatoParaExibicao(q.tipo_questao?.trim())).filter(Boolean);

        setOpcoes(prev => ({
          ...prev,
          bancas: [...new Set(data.map(q => q.banca?.trim()).filter(Boolean))].sort() as string[], 
          materias: [...new Set(data.map(q => q.materia?.trim()).filter(Boolean))].sort() as string[], 
          anos: [...new Set(data.map(q => q.ano).filter(Boolean))].sort((a, b) => b - a) as number[],
          cargos: [...new Set(data.map(q => q.cargo?.trim()).filter(Boolean))].sort() as string[],
          formatos: [...new Set(formatosTraduzidos)].sort() as string[]
        }));
      }
    }
    carregarOpcoesFiltro();
  }, []);

  useEffect(() => {
    if (materiasSelecionadas.length > 0) {
      const topicosDasMaterias = dadosBase
        .filter(q => materiasSelecionadas.includes(q.materia?.trim()))
        .map(q => q.topico?.trim())
        .filter(Boolean);
      
      setOpcoes(prev => ({ ...prev, topicos: [...new Set(topicosDasMaterias)].sort() as string[] }));
    } else {
      setTopicosSelecionados([]); 
      setOpcoes(prev => ({ ...prev, topicos: [] }));
    }
  }, [materiasSelecionadas, dadosBase]);

  const gerarSimulado = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("Você precisa estar logado para criar um simulado.");
        setLoading(false);
        return;
      }

      let query = supabase.from('questoes').select('id');
      
      if (bancasSelecionadas.length > 0) query = query.in('banca', bancasSelecionadas);
      if (materiasSelecionadas.length > 0) query = query.in('materia', materiasSelecionadas);
      if (anosSelecionados.length > 0) query = query.in('ano', anosSelecionados);
      if (cargosSelecionados.length > 0) query = query.in('cargo', cargosSelecionados);
      if (topicosSelecionados.length > 0) query = query.in('topico', topicosSelecionados);
      
      // Traduz os formatos de volta para o padrão do banco antes de consultar
      if (formatosSelecionados.length > 0) {
        const formatosParaBanco = formatosSelecionados.map(traduzirFormatoParaBanco);
        query = query.in('tipo_questao', formatosParaBanco);
      }

      const { data: questoesEncontradas, error: erroBusca } = await query;

      if (erroBusca) throw erroBusca;

      if (!questoesEncontradas || questoesEncontradas.length === 0) {
        alert("Nenhuma questão encontrada com esses filtros. Tente ampliar sua busca.");
        setLoading(false);
        return;
      }

      const selecionadas = questoesEncontradas
        .sort(() => Math.random() - 0.5)
        .slice(0, quantidadeQuestoes);

      // Regra Cebraspe: Ativa apenas se o único formato selecionado for "Certo ou Errado" (traduzido para banco)
      const formatosParaBanco = formatosSelecionados.map(traduzirFormatoParaBanco);
      const regraCebraspeAtiva = formatosParaBanco.length === 1 && formatosParaBanco.includes('certo_errado');

      const { data: novoSimulado, error: erroSimulado } = await supabase
        .from('simulados')
        .insert({
          titulo: `Simulado Personalizado - ${new Date().toLocaleDateString('pt-BR')}`,
          tipo: 'gerado_aluno',
          criado_por: user.id,
          visivel: true,
          regra_subtracao: regraCebraspeAtiva
        })
        .select()
        .single();

      if (erroSimulado) throw erroSimulado;

      const insercoesQuestoes = selecionadas.map((q, index) => ({
        simulado_id: novoSimulado.id,
        questao_id: q.id,
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
          <p className="text-zinc-400">Configure os parâmetros da sua prova. O sistema montará um caderno inédito para você.</p>
        </div>

        <div className="bg-[#131c2f]/30 border border-white/5 p-8 md:p-12 rounded-3xl space-y-10">
          
          <div>
            <h3 className="flex items-center gap-2 font-bold text-white mb-6 border-b border-white/5 pb-4">
              <Filter className="w-5 h-5 text-blue-500" /> Direcionamento da Prova
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MultiSelectBuscavel label="Banca" placeholder="Ex: FGV, VUNESP" opcoes={opcoes.bancas} valores={bancasSelecionadas} setValores={setBancasSelecionadas} />
              <MultiSelectBuscavel label="Cargo" placeholder="Ex: Analista" opcoes={opcoes.cargos} valores={cargosSelecionados} setValores={setCargosSelecionados} />
              
              <div className="col-span-1 md:col-span-2 h-px bg-white/5 my-2"></div>
              
              <MultiSelectBuscavel label="Matérias" placeholder="Ex: Direito Administrativo" opcoes={opcoes.materias} valores={materiasSelecionadas} setValores={setMateriasSelecionadas} />
              <MultiSelectBuscavel label="Tópicos" placeholder="Ex: Atos Administrativos" opcoes={opcoes.topicos} valores={topicosSelecionados} setValores={setTopicosSelecionados} disabled={materiasSelecionadas.length === 0} />
              
              <div className="col-span-1 md:col-span-2 h-px bg-white/5 my-2"></div>

              <MultiSelectBuscavel label="Anos" placeholder="Ex: 2024, 2023" opcoes={opcoes.anos.map(String)} valores={anosSelecionados} setValores={setAnosSelecionados} />
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
            </div>
          </div>

          <button 
            onClick={gerarSimulado}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-black uppercase text-sm tracking-widest py-6 rounded-2xl flex items-center justify-center gap-3 transition-colors mt-8 shadow-xl shadow-blue-900/20"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Zap className="w-6 h-6" /> Gerar Prova e Começar</>}
          </button>
          
        </div>
      </div>
    </div>
  );
}