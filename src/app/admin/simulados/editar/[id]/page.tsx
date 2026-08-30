"use client";
import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from "@/lib/supabase";
import { 
  ArrowLeft, Save, FileText, ListChecks, Search, 
  Plus, Trash2, BookOpen, ChevronDown, ChevronUp, 
  Filter, EyeOff 
} from 'lucide-react';
import Link from 'next/link';

export default function EditarSimuladoAdmin() {
  const router = useRouter();
  const params = useParams();
  const idSimulado = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [abaAtiva, setAbaAtiva] = useState<'questoes' | 'config'>('questoes');

  // Estados das Questões e Buscas
  const [questoesVinculadas, setQuestoesVinculadas] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const [resultadosBusca, setResultadosBusca] = useState<any[]>([]);
  const [buscando, setBuscando] = useState(false);
  
  // Estado: Armazena IDs que o professor pediu para esconder na sessão atual
  const [idsIgnoradosSessao, setIdsIgnoradosSessao] = useState<string[]>([]);
  
  // Estados para o Dropdown Inteligente
  const [topicosDisponiveis, setTopicosDisponiveis] = useState<string[]>([]);
  const [filtroTopico, setFiltroTopico] = useState("Todos");
  
  // Controle de Expansão do Enunciado
  const [questaoExpandidaId, setQuestaoExpandidaId] = useState<string | null>(null);

  // Estado Atualizado: Apenas as configurações essenciais
  const [formData, setFormData] = useState({
    titulo: '',
    disciplina_foco: '',
    visivel: false,
    regra_subtracao: false,
  });

  useEffect(() => {
    if (!idSimulado) return;
    carregarDadosSimulado();
    carregarTopicosUnicos();
  }, [idSimulado]);

  async function carregarTopicosUnicos() {
    try {
      const { data } = await supabase.from('questoes').select('topico');
      if (data) {
        const topicos = Array.from(new Set(data.map(q => q.topico).filter(Boolean))).sort();
        setTopicosDisponiveis(topicos as string[]);
      }
    } catch (err) {
      console.error("Erro ao carregar tópicos:", err);
    }
  }

  async function carregarDadosSimulado() {
    setLoading(true);
    try {
      const { data: simData, error: simError } = await supabase
        .from('simulados')
        .select('*')
        .eq('id', idSimulado)
        .single();

      if (simError) throw simError;

      if (simData) {
        setFormData({
          titulo: simData.titulo || '',
          disciplina_foco: simData.disciplina_foco || '',
          visivel: simData.visivel || false,
          regra_subtracao: simData.regra_subtracao || false,
        });
      }

      const { data: vinculadas, error: vincError } = await supabase
        .from('simulado_questoes')
        .select(`
          id,
          ordem,
          questao_id,
          questoes ( id, banca, orgao, cargo, ano, materia, topico, enunciado, tipo_questao )
        `)
        .eq('simulado_id', idSimulado)
        .order('ordem', { ascending: true });

      if (vincError) throw vincError;
      setQuestoesVinculadas(vinculadas || []);
    } catch (err: any) {
      setErro("Falha ao carregar os dados do simulado.");
    } finally {
      setLoading(false);
    }
  }

  async function pesquisarQuestoesNoBanco() {
    setBuscando(true);
    try {
      const { data: todasRelacionadas } = await supabase
        .from('simulado_questoes')
        .select('questao_id');

      let idsParaIgnorar = todasRelacionadas 
        ? Array.from(new Set(todasRelacionadas.map(r => r.questao_id).filter(Boolean)))
        : [];

      const idsJaVinculadasAqui = questoesVinculadas.map(q => q.questao_id).filter(Boolean);
      idsParaIgnorar = [...idsParaIgnorar, ...idsJaVinculadasAqui, ...idsIgnoradosSessao];
      idsParaIgnorar = Array.from(new Set(idsParaIgnorar));

      let query = supabase
        .from('questoes')
        .select('id, banca, orgao, cargo, ano, materia, topico, enunciado, tipo_questao');

      if (filtroTopico !== "Todos") {
        query = query.eq('topico', filtroTopico);
      }
      
      if (busca && busca.length >= 3) {
        query = query.or(`enunciado.ilike.%${busca}%,materia.ilike.%${busca}%`);
      }
      
      if (idsParaIgnorar.length > 0) {
        query = query.not('id', 'in', `(${idsParaIgnorar.join(',')})`);
      }

      const { data, error } = await query
        .order('criado_em', { ascending: false }) 
        .limit(25);
      
      if (error) throw error;
      
      setResultadosBusca(data || []);
    } catch (err) {
      console.error("Erro na busca:", err);
    } finally {
      setBuscando(false);
    }
  }

  async function adicionarQuestao(questao: any) {
    try {
      const novaOrdem = questoesVinculadas.length + 1;
      const { data, error } = await supabase
        .from('simulado_questoes')
        .insert([{ simulado_id: idSimulado, questao_id: questao.id, ordem: novaOrdem }])
        .select(`id, ordem, questao_id, questoes ( id, banca, orgao, cargo, ano, materia, topico, enunciado, tipo_questao )`)
        .single();

      if (error) throw error;

      setQuestoesVinculadas([...questoesVinculadas, data]);
      setResultadosBusca(resultadosBusca.filter(r => r.id !== questao.id));
    } catch (err: any) {
      alert("Erro ao vincular questão: " + err.message);
    }
  }

  function ocultarQuestaoBusca(idQuestao: string) {
    setIdsIgnoradosSessao(prev => [...prev, idQuestao]);
    setResultadosBusca(prev => prev.filter(r => r.id !== idQuestao));
  }

  async function removerQuestao(idRelacionamento: string) {
    try {
      const { error } = await supabase
        .from('simulado_questoes')
        .delete()
        .eq('id', idRelacionamento);

      if (error) throw error;
      
      setQuestoesVinculadas(prev => prev.filter(q => q.id !== idRelacionamento));
      await pesquisarQuestoesNoBanco(); 
    } catch (err: any) {
      alert("Erro ao remover: " + err.message);
    }
  }

  const handleChangeConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handleSalvarConfiguracoes = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      const { error } = await supabase
        .from('simulados')
        .update(formData)
        .eq('id', idSimulado);
        
      if (error) throw error;
      alert("Configurações atualizadas com sucesso!");
    } catch (error) {
      alert("Erro ao salvar configurações.");
      console.error(error);
    } finally {
      setSalvando(false);
    }
  };

  if (!idSimulado || loading) return <div className="p-12 text-center text-zinc-500 font-medium animate-pulse uppercase tracking-widest text-xs">Carregando dados do simulado...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-5">
        <div className="flex items-center gap-4">
          <Link href="/admin/simulados" className="p-2 bg-white/5 hover:bg-white/10 text-zinc-400 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white uppercase tracking-widest">
              {formData.titulo || "Simulado sem título"}
            </h1>
            <p className="text-xs text-zinc-500 mt-1 uppercase tracking-widest">Gestão de caderno e questões.</p>
          </div>
        </div>
      </div>

      {/* Navegação por Separadores */}
      <div className="flex gap-2 border-b border-white/5">
        <button 
          onClick={() => setAbaAtiva('questoes')}
          className={`px-6 py-4 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 border-b-2 transition-all ${
            abaAtiva === 'questoes' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
          }`}
        >
          <ListChecks className="w-4 h-4" /> Caderno de Questões ({questoesVinculadas.length})
        </button>
        <button 
          onClick={() => setAbaAtiva('config')}
          className={`px-6 py-4 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 border-b-2 transition-all ${
            abaAtiva === 'config' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
          }`}
        >
          <FileText className="w-4 h-4" /> Configurações
        </button>
      </div>

      {/* CONTEÚDO: ABA DE QUESTÕES */}
      {abaAtiva === 'questoes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Questões no Simulado
            </h2>
            <div className="bg-[#131c2f]/30 rounded-2xl border border-white/5 overflow-hidden min-h-[400px]">
              {questoesVinculadas.length === 0 ? (
                <div className="p-12 text-center text-zinc-500">
                  <p className="font-bold text-sm uppercase tracking-widest">Este simulado ainda não tem questões.</p>
                  <p className="text-xs mt-2">Utilize a pesquisa ao lado para adicionar o conteúdo.</p>
                </div>
              ) : (
                <ul className="divide-y divide-white/5">
                  {questoesVinculadas.map((qv, index) => (
                    <li key={qv.id} className="p-5 hover:bg-white/5 transition-colors flex gap-5">
                      <div className="flex flex-col items-center justify-start mt-1">
                        <span className="w-8 h-8 rounded-full bg-white/5 border border-white/10 text-zinc-400 font-bold flex items-center justify-center text-xs">
                          {index + 1}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                            {qv.questoes?.banca} {qv.questoes?.ano ? `- ${qv.questoes.ano}` : ''}
                          </span>
                          
                          {(qv.questoes?.orgao || qv.questoes?.cargo) && (
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-md border border-blue-500/20">
                              {qv.questoes.orgao} {qv.questoes.cargo ? `• ${qv.questoes.cargo}` : ''}
                            </span>
                          )}

                          <span className="text-xs text-zinc-500 font-medium">
                            {qv.questoes?.materia} - {qv.questoes?.topico}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-300 line-clamp-3 leading-relaxed">
                          {qv.questoes?.enunciado?.replace(/<[^>]+>/g, '')}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 justify-center shrink-0">
                        <button onClick={() => removerQuestao(qv.id)} className="p-2 text-zinc-500 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-colors" title="Remover do Simulado">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <Search className="w-4 h-4" /> Adicionar ao Caderno
            </h2>
            <div className="bg-[#131c2f]/50 rounded-2xl border border-white/5 p-5 space-y-4">
              
              <div className="flex flex-col gap-3">
                <div className="bg-[#09090b] border border-white/10 rounded-xl flex items-center px-4">
                  <Filter className="w-4 h-4 text-emerald-500 shrink-0 mr-2" />
                  <select 
                    value={filtroTopico} 
                    onChange={(e) => setFiltroTopico(e.target.value)}
                    className="w-full bg-transparent border-none text-white focus:ring-0 outline-none text-sm py-3 cursor-pointer appearance-none"
                  >
                    <option value="Todos" className="bg-[#09090b]">Todos os Tópicos</option>
                    {topicosDisponiveis.map(topico => (
                      <option key={topico} value={topico} className="bg-[#09090b]">{topico}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && pesquisarQuestoesNoBanco()}
                    placeholder="Palavra-chave do enunciado..."
                    className="flex-1 bg-[#09090b] border border-white/10 text-white rounded-xl px-4 py-3 focus:border-emerald-500 outline-none text-sm placeholder:text-zinc-600"
                  />
                  <button 
                    onClick={pesquisarQuestoesNoBanco}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 rounded-xl transition-colors flex items-center justify-center shrink-0"
                    title="Buscar Questões"
                  >
                    <Search className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="max-h-[500px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {buscando ? (
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest text-center py-6 animate-pulse">A pesquisar no acervo...</p>
                ) : resultadosBusca.length > 0 ? (
                  resultadosBusca.map((q) => {
                    const isExpanded = questaoExpandidaId === q.id;
                    return (
                      <div key={q.id} className="bg-[#09090b] border border-white/5 rounded-xl p-4 flex flex-col gap-3 transition-all hover:border-white/10">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex flex-col min-w-0 gap-1.5">
                            <span className="text-xs font-bold text-white truncate">{q.topico}</span>
                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center flex-wrap gap-1">
                              {q.banca} {q.ano ? `• ${q.ano}` : ''}
                            </span>
                            
                            {(q.orgao || q.cargo) && (
                              <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest truncate max-w-[200px]">
                                {q.orgao} {q.cargo ? `• ${q.cargo}` : ''}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button 
                              onClick={() => ocultarQuestaoBusca(q.id)}
                              className="bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 p-2 rounded-lg transition-colors border border-transparent hover:border-red-500/30"
                              title="Esconder Questão (Já Utilizada/Ignorar)"
                            >
                              <EyeOff className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => adicionarQuestao(q)}
                              className="bg-white/5 hover:bg-emerald-500/20 text-zinc-400 hover:text-emerald-400 font-bold p-2 rounded-lg transition-colors border border-transparent hover:border-emerald-500/30"
                              title="Adicionar Questão"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div 
                          className="cursor-pointer group mt-1" 
                          onClick={() => setQuestaoExpandidaId(isExpanded ? null : q.id)}
                        >
                          <p className={`text-xs text-zinc-400 leading-relaxed transition-all ${isExpanded ? '' : 'line-clamp-3'}`}>
                            {q.enunciado?.replace(/<[^>]+>/g, '')}
                          </p>
                          <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-zinc-600 mt-2 font-bold group-hover:text-emerald-500 transition-colors">
                            {isExpanded ? (
                              <><ChevronUp className="w-3 h-3" /> Ver menos</>
                            ) : (
                              <><ChevronDown className="w-3 h-3" /> Ler completo</>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (filtroTopico !== "Todos" || busca.length > 2) ? (
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest text-center py-6">Nenhuma questão inédita encontrada.</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO: ABA DE CONFIGURAÇÕES */}
      {abaAtiva === 'config' && (
        <form onSubmit={handleSalvarConfiguracoes} className="space-y-6 max-w-4xl animate-in slide-in-from-bottom-4 duration-500">
          <div className="bg-[#131c2f]/30 p-8 rounded-2xl shadow-sm border border-white/5 space-y-6">
              
             <div className="grid grid-cols-1 gap-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Título do Simulado</label>
                  <input type="text" name="titulo" value={formData.titulo} onChange={handleChangeConfig} required className="w-full text-sm bg-[#09090b] border border-white/10 text-white rounded-lg px-4 py-3 focus:border-emerald-500 outline-none" />
                </div>
                
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Disciplina Foco <span className="text-zinc-600">(Opcional)</span></label>
                  <input type="text" name="disciplina_foco" value={formData.disciplina_foco} onChange={handleChangeConfig} className="w-full text-sm bg-[#09090b] border border-white/10 text-white rounded-lg px-4 py-3 focus:border-emerald-500 outline-none" />
                </div>
             </div>

             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-t border-white/5 pt-6 mt-6">
                <div className="flex flex-col sm:flex-row gap-6">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" name="visivel" checked={formData.visivel} onChange={handleChangeConfig} className="w-5 h-5 accent-emerald-500" />
                    <span className="text-xs font-bold uppercase tracking-widest text-white">Tornar Visível para Alunos</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" name="regra_subtracao" checked={formData.regra_subtracao} onChange={handleChangeConfig} className="w-5 h-5 accent-emerald-500" />
                    <span className="text-xs font-bold uppercase tracking-widest text-white">Regra Cebraspe (1 Erro anula 1 Acerto)</span>
                  </label>
                </div>

                <button type="submit" disabled={salvando} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest py-3 px-8 rounded-xl transition-all shadow-sm flex items-center gap-2 w-full sm:w-auto justify-center">
                  {salvando ? 'A atualizar...' : <><Save className="w-4 h-4"/> Guardar Alterações</>}
                </button>
             </div>

          </div>
        </form>
      )}

    </div>
  );
}