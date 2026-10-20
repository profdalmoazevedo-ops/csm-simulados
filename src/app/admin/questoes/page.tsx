"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ehCampoFaltante } from '@/lib/metadados';
import { Plus, Search, Edit, Trash2, Database, BookOpen, AlertCircle, Filter, Wand2, RefreshCcw, ChevronDown, ChevronsDownUp, ChevronsUpDown, CopyCheck } from 'lucide-react';
import Link from 'next/link';


type Questao = {
  id: string;
  materia: string | null;
  topico: string | null;
  enunciado: string | null;
  comentario_gabarito: string | null;
  criado_em?: string;
  [chave: string]: any;
};

type GrupoTopico = {
  topico: string;
  questoes: Questao[];
};

type GrupoMateria = {
  materia: string;
  total: number;
  topicos: GrupoTopico[];
};

// Chave de agrupamento: ignora caixa e espaÃ§os extras (trim + espaÃ§os colapsados).
const normalizarChave = (valor: string | null | undefined) =>
  (valor || '').trim().replace(/\s+/g, ' ').toLowerCase();

const rotuloMaisFrequente = (rotulos: Map<string, number>) =>
  [...rotulos.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];

function agruparPorMateriaTopico(lista: Questao[]): GrupoMateria[] {
  const porMateria = new Map<string, {
    rotulos: Map<string, number>;
    topicos: Map<string, { rotulos: Map<string, number>; questoes: Questao[] }>;
  }>();

  for (const q of lista) {
    const materia = (q.materia || '').trim() || 'Sem MatÃ©ria';
    const topico = (q.topico || '').trim() || 'Sem TÃ³pico';

    const chaveMateria = normalizarChave(materia);
    const chaveTopico = normalizarChave(topico);

    if (!porMateria.has(chaveMateria)) {
      porMateria.set(chaveMateria, { rotulos: new Map(), topicos: new Map() });
    }
    const grupoMateria = porMateria.get(chaveMateria)!;
    grupoMateria.rotulos.set(materia, (grupoMateria.rotulos.get(materia) || 0) + 1);

    if (!grupoMateria.topicos.has(chaveTopico)) {
      grupoMateria.topicos.set(chaveTopico, { rotulos: new Map(), questoes: [] });
    }
    const grupoTopico = grupoMateria.topicos.get(chaveTopico)!;
    grupoTopico.rotulos.set(topico, (grupoTopico.rotulos.get(topico) || 0) + 1);
    grupoTopico.questoes.push(q);
  }

  return [...porMateria.values()]
    .map(({ rotulos, topicos }) => ({
      materia: rotuloMaisFrequente(rotulos),
      total: [...topicos.values()].reduce((acc, t) => acc + t.questoes.length, 0),
      topicos: [...topicos.values()]
        .map(t => ({ topico: rotuloMaisFrequente(t.rotulos), questoes: t.questoes }))
        .sort((a, b) => a.topico.localeCompare(b.topico)),
    }))
    .sort((a, b) => a.materia.localeCompare(b.materia));
}

export default function BancoDeQuestoesAdmin() {
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroTopico, setFiltroTopico] = useState("Todos");
  const [qtdFaltantes, setQtdFaltantes] = useState(0);
  const [materiasExpandidas, setMateriasExpandidas] = useState<Record<string, boolean>>({});
  const [topicosColapsados, setTopicosColapsados] = useState<Record<string, boolean>>({});

  const [gerandoLote, setGerandoLote] = useState(false);
  const [progressoLote, setProgressoLote] = useState("");

  useEffect(() => {
    carregarQuestoes();
  }, []);

  async function carregarQuestoes() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('questoes')
        .select('*')
        .order('criado_em', { ascending: false }); // ðŸš€ CorreÃ§Ã£o: ordenando pela data real de criaÃ§Ã£o

      if (error) throw error;
      setQuestoes(data || []);
      setQtdFaltantes((data || []).filter(q => ehCampoFaltante(q.orgao) || ehCampoFaltante(q.cargo)).length);
    } catch (error: any) {
      console.error("Erro interno ao carregar questÃµes:", error);
    } finally {
      setLoading(false);
    }
  }

  async function gerarComentariosEmLote() {
    // Pendente = sem comentÃ¡rio OU comentÃ¡rio que vira vazio apÃ³s trim (ex.: sÃ³
    // quebras de linha), que passaria batido pelo filtro antigo.
    const pendentes = questoes.filter(q =>
      !q.comentario_gabarito ||
      q.comentario_gabarito.trim() === "" ||
      q.comentario_gabarito === "Gerando comentÃ¡rio..."
    );
    
    if (pendentes.length === 0) {
      alert("Todas as questÃµes jÃ¡ possuem comentÃ¡rios gerados!");
      return;
    }

    if (!confirm(`Deseja iniciar a geraÃ§Ã£o de comentÃ¡rios para ${pendentes.length} questÃµes pendentes?`)) return;

    setGerandoLote(true);

    // Pool paralelo: vÃ¡rias questÃµes ao mesmo tempo em vez de uma por vez,
    // sem as antigas pausas fixas de 5 s entre cada questÃ£o.
    const CONCORRENCIA = 4;
    const MAX_TENTATIVAS = 3;

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Em erro de cota (429), sobrecarga (503) ou infra (5xx), espera e tenta de
    // novo com backoff progressivo. Qualquer outro erro Ã© devolvido direto.
    const chamarComRetry = async (payload: Record<string, unknown>) => {
      let ultimaResposta: Response | null = null;
      for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
        ultimaResposta = await fetch('/api/gerar-comentario', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const precisaRetry = ultimaResposta.status === 429 || ultimaResposta.status === 503 || ultimaResposta.status >= 500;
        if (ultimaResposta.ok || !precisaRetry) return ultimaResposta;

        if (tentativa < MAX_TENTATIVAS) await sleep(2000 * tentativa);
      }
      return ultimaResposta!;
    };

    let cursor = 0;
    let ok = 0;
    const falhas: { id: string; motivo: string }[] = [];

    const processarQuestao = async (q: Questao) => {
      try {
        const res = await chamarComRetry({
          enunciado: q.enunciado,
          tipo_questao: q.tipo_questao,
          gabarito: q.gabarito,
          alternativas: { A: q.alternativa_a, B: q.alternativa_b, C: q.alternativa_c, D: q.alternativa_d, E: q.alternativa_e }
        });

        const data = await res.json();

        if (res.ok && data.comentario) {
          const { error: updateError } = await supabase
            .from('questoes')
            .update({ comentario_gabarito: data.comentario })
            .eq('id', q.id);

          if (updateError) throw updateError;
          ok++;
        } else {
          throw new Error(data.error || "Sem comentÃ¡rio gerado.");
        }
      } catch (err) {
        const mensagem = err instanceof Error ? err.message : String(err);
        falhas.push({ id: q.id, motivo: mensagem });
        console.error(`Falha na questÃ£o ${q.id}:`, err);
      }
    };

    const trabalhador = async () => {
      while (true) {
        const indice = cursor++;
        if (indice >= pendentes.length) return;

        const feito = Math.min(cursor, pendentes.length);
        setProgressoLote(`Processando (${feito}/${pendentes.length}) â€” ${ok} ok${falhas.length ? ` Â· ${falhas.length} com erro` : ""}`);

        // Pequeno espaÃ§amento aleatÃ³rio para nÃ£o estourar o limite de requisiÃ§Ãµes por minuto.
        await sleep(Math.floor(Math.random() * 500));

        await processarQuestao(pendentes[indice]);
      }
    };

    try {
      await Promise.all(
        Array.from({ length: Math.min(CONCORRENCIA, pendentes.length) }, () => trabalhador())
      );

      if (falhas.length > 0) {
            <Link
              href="/admin/questoes/duplicadas"
              className="bg-[#131c2f]/80 hover:bg-[#131c2f] border border-amber-500/30 text-amber-400 font-bold py-3 px-5 rounded-xl transition-all flex items-center gap-2 text-xs uppercase tracking-widest"
            >
              <CopyCheck className="w-4 h-4" /> Verificar Duplicadas
            </Link>

        alert(`Processo finalizado com ${ok} comentÃ¡rio(s) gerado(s) e ${falhas.length} falha(s).\n\nAs questÃµes com falha continuam sem comentÃ¡rio â€” clique em "Gerar ComentÃ¡rios (IA)" novamente para tentar de novo, e o botÃ£o processa apenas as pendentes.`);
      } else {
        alert(`ðŸŽ‰ Processo finalizado! ${ok} comentÃ¡rio(s) gerado(s) com sucesso.`);
      }
      carregarQuestoes(); 
    } catch (err: any) {
      alert("Erro ao processar lote: " + err.message);
    } finally {
      setGerandoLote(false);
      setProgressoLote("");
    }
  }

  async function excluirQuestao(id: string) {
    if (!confirm("Tem certeza absoluta que deseja remover esta questÃ£o permanentemente do acervo?")) return;

    try {
      const { error } = await supabase.from('questoes').delete().eq('id', id);
      if (error) throw error;
      setQuestoes(prev => prev.filter(q => q.id !== id));
    } catch (error: any) {
      alert("NÃ£o foi possÃ­vel excluir a questÃ£o: " + error.message);
    }
  }

  function alternarMateria(materia: string) {
    setMateriasExpandidas(prev => ({ ...prev, [materia]: !(prev[materia] ?? false) }));
  }

  function alternarTopico(chaveMateria: string, chaveTopico: string) {
    const chave = `${chaveMateria}||${chaveTopico}`;
    setTopicosColapsados(prev => ({ ...prev, [chave]: !(prev[chave] ?? false) }));
  }

  function expandirTodas() {
    setMateriasExpandidas(Object.fromEntries(materias.map(m => [m.materia, true])));
    const todosTopicos: Record<string, boolean> = {};
    for (const m of materias) {
      for (const t of m.topicos) {
        todosTopicos[`${normalizarChave(m.materia)}||${normalizarChave(t.topico)}`] = false;
      }
    }
    setTopicosColapsados(todosTopicos);
  }

  function recolherTodas() {
    setMateriasExpandidas(Object.fromEntries(materias.map(m => [m.materia, false])));
  }

  const topicosUnicos = (() => {
    const mapa = new Map<string, Map<string, number>>();
    for (const q of questoes) {
      const bruto = (q.topico || '').trim();
      if (!bruto) continue;
      const chave = normalizarChave(bruto);
      if (!mapa.has(chave)) mapa.set(chave, new Map());
      const rotulos = mapa.get(chave)!;
      rotulos.set(bruto, (rotulos.get(bruto) || 0) + 1);
    }
    return [...mapa.values()].map(rotuloMaisFrequente).sort();
  })();

  const questoesFiltradas = questoes.filter(q => {
    const matchBusca = (q.materia || "").toLowerCase().includes(busca.toLowerCase()) ||
                       (q.topico || "").toLowerCase().includes(busca.toLowerCase()) ||
                       (q.enunciado || "").toLowerCase().includes(busca.toLowerCase());
    const matchTopico = filtroTopico === "Todos" || normalizarChave(q.topico) === normalizarChave(filtroTopico);
    return matchBusca && matchTopico;
  });

  const materias = agruparPorMateriaTopico(questoesFiltradas);

  return (
    <div className="min-h-screen bg-[#09090b] text-[#e4e4e7] font-sans pb-20">
      <div className="max-w-7xl mx-auto px-6 pt-12 space-y-6 animate-in fade-in duration-500">
        
        {/* CabeÃ§alho */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <h1 className="text-3xl font-serif italic text-white flex items-center gap-2 uppercase">
              <Database className="w-8 h-8 text-emerald-500" /> GestÃ£o do Acervo
            </h1>
            <p className="text-zinc-400 mt-2 text-sm">
              Gerencie questÃµes, simulados e lotes de IA. Total de {questoes.length} questÃµes carregadas.
            </p>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            <button 
              onClick={gerarComentariosEmLote}
              disabled={gerandoLote}
              className="bg-[#131c2f]/80 hover:bg-[#131c2f] border border-blue-500/30 text-blue-400 disabled:opacity-50 font-bold py-3 px-5 rounded-xl transition-all flex items-center gap-2 text-xs uppercase tracking-widest"
            >
              {gerandoLote ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              {gerandoLote ? progressoLote : "Gerar ComentÃ¡rios (IA)"}
            </button>

            <Link 
              href="/admin/questoes/nova" 
              className="bg-emerald-600 hover:bg-emerald-500 text-black font-black py-3 px-6 rounded-xl transition-all flex items-center gap-2 text-xs uppercase tracking-widest"
            >
              <Plus className="w-4 h-4" /> Nova QuestÃ£o
            </Link>
          </div>
        </div>

        {/* Banner: questÃµes sem Cargo/Ã“rgÃ£o */}
        {qtdFaltantes > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-400 uppercase tracking-widest">
                  {qtdFaltantes} questÃµes sem Cargo e/ou Ã“rgÃ£o definido
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  Preencha em lote com sugestÃ£o da IA ou manualmente, agrupado por banca, matÃ©ria e ano.
                </p>
              </div>
            </div>
            <Link
              href="/admin/questoes/metadados"
              className="bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-widest px-5 py-3 rounded-xl transition-all flex items-center gap-2 shrink-0 w-fit"
            >
              <Wand2 className="w-4 h-4" /> Preencher em Lote
            </Link>
          </div>
        )}

        {/* ÃREA DE FILTROS */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="bg-[#131c2f]/30 rounded-xl border border-white/5 flex items-center gap-3 flex-1 px-4 py-2">
            <Search className="w-5 h-5 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Buscar por palavra-chave no enunciado..." 
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full bg-transparent border-none text-zinc-200 focus:ring-0 outline-none placeholder:text-zinc-600 py-2 text-sm"
            />
          </div>

          <div className="bg-[#131c2f]/30 rounded-xl border border-white/5 flex items-center gap-3 md:w-1/3 px-4 py-2">
            <Filter className="w-5 h-5 text-emerald-500 shrink-0" />
            <select 
              value={filtroTopico} 
              onChange={(e) => setFiltroTopico(e.target.value)}
              className="w-full bg-transparent border-none text-zinc-200 focus:ring-0 outline-none font-medium cursor-pointer text-sm py-2 appearance-none"
            >
              <option value="Todos" className="bg-[#09090b]">Todos os TÃ³picos</option>
              {topicosUnicos.map(topico => (
                <option key={topico as string} value={topico as string} className="bg-[#09090b]">{topico as string}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Lista de QuestÃµes agrupada por MatÃ©ria â†’ TÃ³pico */}
        {loading ? (
          <div className="bg-[#131c2f]/30 rounded-2xl border border-white/5 p-12 text-center text-zinc-500 font-medium animate-pulse">
            Carregando acervo...
          </div>
        ) : questoesFiltradas.length === 0 ? (
          <div className="bg-[#131c2f]/30 rounded-2xl border border-white/5 p-12 flex flex-col items-center justify-center text-zinc-500 text-center">
            <AlertCircle className="w-12 h-12 mb-3 text-zinc-600" />
            <p className="font-medium text-sm">Nenhuma questÃ£o passou nos filtros aplicados.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Controles do agrupamento */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-500 font-medium">
                  {materias.length} {materias.length === 1 ? 'matÃ©ria' : 'matÃ©rias'} Â· {questoesFiltradas.length} {questoesFiltradas.length === 1 ? 'questÃ£o' : 'questÃµes'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={expandirTodas}
                  className="p-2 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                  title="Expandir todas as matÃ©rias"
                >
                  <ChevronsDownUp className="w-4 h-4" />
                </button>
                <button
                  onClick={recolherTodas}
                  className="p-2 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                  title="Recolher todas as matÃ©rias"
                >
                  <ChevronsUpDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {materias.map((materia) => {
              const aberta = materiasExpandidas[materia.materia] ?? false;

              return (
                <div key={materia.materia} className="bg-[#131c2f]/30 border border-white/5 rounded-2xl overflow-hidden">
                  {/* CabeÃ§alho da matÃ©ria */}
                  <button
                    type="button"
                    onClick={() => alternarMateria(materia.materia)}
                    className="w-full flex items-center justify-between gap-4 p-5 hover:bg-white/5 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ChevronDown className={`w-5 h-5 text-zinc-500 shrink-0 transition-transform ${aberta ? 'rotate-180' : ''}`} />
                      <div className="min-w-0">
                        <p className="font-bold text-white text-sm truncate">{materia.materia}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {materia.topicos.length === 1 ? `${materia.topicos.length} tÃ³pico` : `${materia.topicos.length} tÃ³picos`}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md">
                      {materia.total} {materia.total === 1 ? 'questÃ£o' : 'questÃµes'}
                    </span>
                  </button>

                  {/* SeÃ§Ãµes por tÃ³pico */}
                  {aberta && (
                    <div className="border-t border-white/5">
                      {materia.topicos.map(topico => {
                        const chaveMateria = normalizarChave(materia.materia);
                        const chaveTopicoTopico = normalizarChave(topico.topico);
                        const topicoAberto = topicosColapsados[`${chaveMateria}||${chaveTopicoTopico}`] === false;

                        return (
                          <div key={`${chaveMateria}||${topico.topico}`} className="border-b border-white/5 last:border-b-0">
                            <button
                              type="button"
                              onClick={() => alternarTopico(chaveMateria, chaveTopicoTopico)}
                              className="w-full bg-black/20 px-5 py-2.5 flex items-center justify-between gap-3 hover:bg-black/40 transition-colors text-left"
                            >
                              <span className="text-xs font-bold uppercase tracking-widest text-emerald-500/90 flex items-center gap-1.5 truncate">
                                <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 shrink-0 transition-transform ${topicoAberto ? 'rotate-180' : ''}`} />
                                <BookOpen className="w-3.5 h-3.5 shrink-0" /> {topico.topico}
                              </span>
                              <span className="shrink-0 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                                {topico.questoes.length}
                              </span>
                            </button>
                            {topicoAberto && (
                              <div className="divide-y divide-white/5">
                                {topico.questoes.map((questao) => (
                              <div key={questao.id} className="px-5 py-4 flex items-start justify-between gap-4 hover:bg-white/5 transition-colors">
                                <div className="flex-1 min-w-0">
                                  <div className="text-zinc-300 line-clamp-2 leading-relaxed text-sm">
                                    {questao.enunciado ? questao.enunciado.replace(/<[^>]+>/g, '') : "Enunciado vazio"}
                                  </div>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                  <Link 
                                    href={`/admin/questoes/editar/${questao.id}`}
                                    className="p-2 text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors inline-block" 
                                    title="Editar QuestÃ£o"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Link>
                                  <button 
                                    onClick={() => excluirQuestao(questao.id)}
                                    className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" 
                                    title="Excluir QuestÃ£o"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                            )}
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
