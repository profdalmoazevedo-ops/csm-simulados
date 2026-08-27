"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Filter, Sliders, Loader2, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';

// Reaproveitamos o componente de busca limpo
const DropdownBuscavel = ({ label, placeholder, opcoes, valor, setValor, disabled = false }: { label: string, placeholder: string, opcoes: any[], valor: string, setValor: (v: string) => void, disabled?: boolean }) => {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  
  useEffect(() => { setBusca(valor); }, [valor]);

  const opcoesFiltradas = opcoes.filter(op => String(op).toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="relative">
      <label className={`block text-xs font-bold uppercase mb-2 ${disabled ? 'text-zinc-600' : 'text-zinc-400'}`}>{label}</label>
      <input 
        type="text" value={busca} disabled={disabled}
        onChange={(e) => { setBusca(e.target.value); setAberto(true); if (e.target.value === '') setValor(''); }}
        onFocus={() => setAberto(true)} onBlur={() => setTimeout(() => setAberto(false), 200)}
        placeholder={disabled ? "Selecione uma matéria primeiro..." : placeholder}
        className={`w-full bg-[#09090b] border rounded-lg px-4 py-3 text-sm transition-colors focus:outline-none ${
          disabled ? 'border-white/5 text-zinc-600 cursor-not-allowed bg-black/20' : 'border-white/10 text-zinc-200 focus:border-blue-500'
        }`}
      />
      {aberto && !disabled && opcoesFiltradas.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-[#131c2f] border border-white/10 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {opcoesFiltradas.map((op) => (
            <li key={op} onMouseDown={(e) => { e.preventDefault(); setValor(String(op)); setBusca(String(op)); setAberto(false); }}
              className="px-4 py-3 text-sm text-zinc-300 hover:bg-blue-500/20 hover:text-blue-500 cursor-pointer transition-colors">
              {op}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default function GeradorSimulados() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [dadosBase, setDadosBase] = useState<any[]>([]);
  
  const [opcoes, setOpcoes] = useState({ bancas: [] as string[], materias: [] as string[], anos: [] as number[], cargos: [] as string[], formatos: [] as string[], topicos: [] as string[] });

  // Filtros
  const [bancaSelecionada, setBancaSelecionada] = useState('');
  const [materiaSelecionada, setMateriaSelecionada] = useState('');
  const [anoSelecionado, setAnoSelecionado] = useState('');
  const [cargoSelecionado, setCargoSelecionado] = useState('');
  const [formatoSelecionado, setFormatoSelecionado] = useState('');
  const [topicoSelecionado, setTopicoSelecionado] = useState('');
  
  // Configuração da Prova
  const [quantidadeQuestoes, setQuantidadeQuestoes] = useState(10);

  useEffect(() => {
    async function carregarOpcoesFiltro() {
      const { data, error } = await supabase.from('questoes').select('banca, materia, ano, cargo, topico, tipo_questao');
      if (data && !error) {
        setDadosBase(data);
        setOpcoes(prev => ({
          ...prev,
          bancas: [...new Set(data.map(q => q.banca?.trim()).filter(Boolean))].sort() as string[], 
          materias: [...new Set(data.map(q => q.materia?.trim()).filter(Boolean))].sort() as string[], 
          anos: [...new Set(data.map(q => q.ano).filter(Boolean))].sort((a, b) => b - a) as number[],
          cargos: [...new Set(data.map(q => q.cargo?.trim()).filter(Boolean))].sort() as string[],
          formatos: [...new Set(data.map(q => q.tipo_questao?.trim()).filter(Boolean))].sort() as string[]
        }));
      }
    }
    carregarOpcoesFiltro();
  }, []);

  useEffect(() => {
    if (materiaSelecionada) {
      const topicosDaMateria = dadosBase.filter(q => q.materia?.trim() === materiaSelecionada).map(q => q.topico?.trim()).filter(Boolean);
      setOpcoes(prev => ({ ...prev, topicos: [...new Set(topicosDaMateria)].sort() as string[] }));
    } else {
      setTopicoSelecionado(''); 
      setOpcoes(prev => ({ ...prev, topicos: [] }));
    }
  }, [materiaSelecionada, dadosBase]);

  const gerarSimulado = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("Você precisa estar logado para criar um simulado.");
        setLoading(false);
        return;
      }

      // 1. Busca todas as questões que batem com o filtro
      let query = supabase.from('questoes').select('id');
      if (bancaSelecionada) query = query.eq('banca', bancaSelecionada);
      if (materiaSelecionada) query = query.eq('materia', materiaSelecionada);
      if (anoSelecionado) query = query.eq('ano', parseInt(anoSelecionado));
      if (cargoSelecionado) query = query.eq('cargo', cargoSelecionado);
      if (topicoSelecionado) query = query.eq('topico', topicoSelecionado);
      if (formatoSelecionado) query = query.eq('tipo_questao', formatoSelecionado);

      const { data: questoesEncontradas, error: erroBusca } = await query;

      if (erroBusca) throw erroBusca;

      if (!questoesEncontradas || questoesEncontradas.length === 0) {
        alert("Nenhuma questão encontrada com esses filtros. Tente ampliar sua busca.");
        setLoading(false);
        return;
      }

      // 2. Embaralha e corta na quantidade desejada
      const selecionadas = questoesEncontradas
        .sort(() => Math.random() - 0.5)
        .slice(0, quantidadeQuestoes);

      // 3. Cria o Simulado na tabela 'simulados'
      const { data: novoSimulado, error: erroSimulado } = await supabase
        .from('simulados')
        .insert({
          titulo: `Simulado Personalizado - ${new Date().toLocaleDateString('pt-BR')}`,
          tipo: 'gerado_aluno',
          criado_por: user.id,
          visivel: true,
          regra_subtracao: formatoSelecionado === 'CERTO OU ERRADO' // Ativa regra Cebraspe automaticamente se for C/E
        })
        .select()
        .single();

      if (erroSimulado) throw erroSimulado;

      // 4. Salva as questões sorteadas na tabela 'simulado_questoes'
      const insercoesQuestoes = selecionadas.map((q, index) => ({
        simulado_id: novoSimulado.id,
        questao_id: q.id,
        ordem: index + 1
      }));

      const { error: erroInsercao } = await supabase.from('simulado_questoes').insert(insercoesQuestoes);
      
      if (erroInsercao) throw erroInsercao;

      // 5. Redireciona para a página da prova
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
              <DropdownBuscavel label="Banca" placeholder="Ex: FGV" opcoes={opcoes.bancas} valor={bancaSelecionada} setValor={setBancaSelecionada} />
              <DropdownBuscavel label="Cargo" placeholder="Ex: Analista" opcoes={opcoes.cargos} valor={cargoSelecionado} setValor={setCargoSelecionado} />
              <DropdownBuscavel label="Matéria" placeholder="Ex: Direito Administrativo" opcoes={opcoes.materias} valor={materiaSelecionada} setValor={setMateriaSelecionada} />
              <DropdownBuscavel label="Tópico" placeholder="Ex: Atos Administrativos" opcoes={opcoes.topicos} valor={topicoSelecionado} setValor={setTopicoSelecionado} disabled={!materiaSelecionada} />
              <DropdownBuscavel label="Ano" placeholder="Ex: 2024" opcoes={opcoes.anos} valor={anoSelecionado} setValor={setAnoSelecionado} />
              <DropdownBuscavel label="Formato" placeholder="Ex: Múltipla" opcoes={opcoes.formatos} valor={formatoSelecionado} setValor={setFormatoSelecionado} />
            </div>
          </div>

          <div>
            <h3 className="font-bold text-white mb-6 border-b border-white/5 pb-4">Configuração Final</h3>
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase mb-4">Quantidade de Questões</label>
              <div className="flex gap-4">
                {[10, 20, 30, 50, 100].map(num => (
                  <button
                    key={num}
                    onClick={() => setQuantidadeQuestoes(num)}
                    className={`flex-1 py-4 rounded-xl font-black text-sm transition-all border ${
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