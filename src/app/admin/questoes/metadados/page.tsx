"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ehCampoFaltante } from '@/lib/metadados';
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronDown, ExternalLink, Loader2, RefreshCcw, Search } from 'lucide-react';

type QuestaoMeta = {
  id: string;
  banca: string;
  materia: string;
  topico: string;
  ano: number | null;
  enunciado: string;
  alternativa_a: string;
  orgaoOriginal: string;
  cargoOriginal: string;
  orgaoEditado: string;
  cargoEditado: string;
  fonte: string;
  fonteUrl: string;
  status: 'verificado' | 'estimado' | 'nao_encontrado';
  aplicada: boolean;
};

type GrupoMetadados = {
  chave: string;
  banca: string;
  materia: string;
  ano: number | null;
  questoes: QuestaoMeta[];
};

type LinhaQuestao = {
  id: string;
  banca: string | null;
  orgao: string | null;
  cargo: string | null;
  materia: string | null;
  topico: string | null;
  ano: number | null;
  enunciado: string | null;
  alternativa_a: string | null;
};

type SugestaoResposta = {
  id: string;
  orgao: string;
  cargo: string;
  fonte: string;
  url: string;
  status: 'verificado' | 'estimado' | 'nao_encontrado';
};

const TAMANHO_LOTE = 3;

const limparHtml = (texto: string | null) =>
  (texto || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function montarGrupos(candidatas: LinhaQuestao[]): GrupoMetadados[] {
  const mapa = new Map<string, GrupoMetadados>();

  for (const q of candidatas) {
    const banca = (q.banca || 'Sem banca').trim();
    const materia = (q.materia || 'Sem matéria').trim();
    const ano = q.ano;
    const chave = `${banca}|${materia}|${ano ?? '—'}`;

    if (!mapa.has(chave)) {
      mapa.set(chave, { chave, banca, materia, ano, questoes: [] });
    }

    mapa.get(chave)!.questoes.push({
      id: q.id,
      banca,
      materia,
      topico: q.topico || '',
      ano,
      enunciado: limparHtml(q.enunciado),
      alternativa_a: q.alternativa_a || '',
      orgaoOriginal: q.orgao || '',
      cargoOriginal: q.cargo || '',
      orgaoEditado: q.orgao || '',
      cargoEditado: q.cargo || '',
      fonte: '',
      fonteUrl: '',
      status: 'nao_encontrado',
      aplicada: false
    });
  }

  return [...mapa.values()]
    .map(g => ({ ...g, questoes: g.questoes.sort((a, b) => a.enunciado.localeCompare(b.enunciado)) }))
    .sort((a, b) => b.questoes.length - a.questoes.length);
}

export default function PreencherMetadados() {
  const [grupos, setGrupos] = useState<GrupoMetadados[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [expandido, setExpandido] = useState<string | null>(null);
  const [buscandoIA, setBuscandoIA] = useState<Record<string, boolean>>({});
  const [progressoIA, setProgressoIA] = useState<Record<string, string>>({});
  const [aplicando, setAplicando] = useState<Record<string, boolean>>({});
  const [progressoAplicar, setProgressoAplicar] = useState<Record<string, string>>({});

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        const { data, error } = await supabase
          .from('questoes')
          .select('id, banca, orgao, cargo, materia, topico, ano, enunciado, alternativa_a');

        if (error) throw error;

        const candidatas = (data || []).filter(
          (q: LinhaQuestao) => ehCampoFaltante(q.orgao) || ehCampoFaltante(q.cargo)
        );

        if (!ativo) return;
        const novosGrupos = montarGrupos(candidatas);
        setGrupos(novosGrupos);
        if (novosGrupos.length > 0) setExpandido(novosGrupos[0].chave);
      } catch (err) {
        if (!ativo) return;
        setErro(err instanceof Error ? err.message : 'Erro ao carregar as questões.');
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    carregar();

    return () => {
      ativo = false;
    };
  }, []);

  const totalPendentes = grupos.reduce(
    (acc, g) => acc + g.questoes.filter(q => !q.aplicada).length,
    0
  );

  async function buscarMetadadosGrupo(chave: string) {
    const grupo = grupos.find(g => g.chave === chave);
    if (!grupo) return;

    const pendentes = grupo.questoes.filter(q => !q.aplicada);
    if (pendentes.length === 0) return;

    setBuscandoIA(prev => ({ ...prev, [chave]: true }));
    setProgressoIA(prev => ({ ...prev, [chave]: 'Buscando na web...' }));
    setErro('');

    try {
      for (let i = 0; i < pendentes.length; i += TAMANHO_LOTE) {
        const lote = pendentes.slice(i, i + TAMANHO_LOTE);
        const fim = Math.min(i + TAMANHO_LOTE, pendentes.length);

        setProgressoIA(prev => ({
          ...prev,
          [chave]: `Buscando ${i + 1}–${fim} de ${pendentes.length}...`
        }));

        const resposta = await fetch('/api/inferir-metadados', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questoes: lote.map(q => ({
              id: q.id,
              banca: q.banca,
              materia: q.materia,
              topico: q.topico,
              ano: q.ano,
              enunciado: q.enunciado,
              alternativa_a: q.alternativa_a
            }))
          })
        });

        const dados = (await resposta.json()) as { error?: string; inferencias?: SugestaoResposta[] };

        if (!resposta.ok || !dados.inferencias) {
          throw new Error(dados.error || 'Falha ao obter as informações.');
        }

        const porId = new Map(dados.inferencias.map(s => [s.id, s]));

        setGrupos(prev => prev.map(g => {
          if (g.chave !== chave) return g;
          return {
            ...g,
            questoes: g.questoes.map(q => {
              const sugestao = porId.get(q.id);
              if (!sugestao) return q;
              return {
                ...q,
                orgaoEditado: sugestao.orgao || q.orgaoEditado,
                cargoEditado: sugestao.cargo || q.cargoEditado,
                fonte: sugestao.fonte,
                fonteUrl: sugestao.url,
                status: sugestao.status
              };
            })
          };
        }));

        if (fim < pendentes.length) await sleep(4000);
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao buscar as informações.');
    } finally {
      setBuscandoIA(prev => ({ ...prev, [chave]: false }));
      setProgressoIA(prev => ({ ...prev, [chave]: '' }));
    }
  }

  function atualizarCampo(chave: string, id: string, campo: 'orgaoEditado' | 'cargoEditado', valor: string) {
    setGrupos(prev => prev.map(g => {
      if (g.chave !== chave) return g;
      return {
        ...g,
        questoes: g.questoes.map(q => q.id === id ? { ...q, [campo]: valor } : q)
      };
    }));
  }

  async function aplicarQuestao(chave: string, id: string) {
    const grupo = grupos.find(g => g.chave === chave);
    const questao = grupo?.questoes.find(q => q.id === id);
    if (!grupo || !questao) return;

    try {
      const { error } = await supabase
        .from('questoes')
        .update({
          orgao: questao.orgaoEditado.trim() || questao.orgaoOriginal,
          cargo: questao.cargoEditado.trim() || questao.cargoOriginal
        })
        .eq('id', id);

      if (error) throw error;

      setGrupos(prev => prev.map(g => g.chave === chave ? {
        ...g,
        questoes: g.questoes.map(q => q.id === id ? { ...q, aplicada: true } : q)
      } : g));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar a questão.');
    }
  }

  async function aplicarGrupo(chave: string) {
    const grupo = grupos.find(g => g.chave === chave);
    if (!grupo) return;

    const pendentes = grupo.questoes.filter(q => !q.aplicada);
    if (pendentes.length === 0) return;

    if (!confirm(`Aplicar Órgão e Cargo nas ${pendentes.length} questões deste grupo?`)) return;

    setAplicando(prev => ({ ...prev, [chave]: true }));
    setProgressoAplicar(prev => ({ ...prev, [chave]: 'Salvando...' }));
    setErro('');

    try {
      for (let i = 0; i < pendentes.length; i++) {
        const q = pendentes[i];

        const { error } = await supabase
          .from('questoes')
          .update({
            orgao: q.orgaoEditado.trim() || q.orgaoOriginal,
            cargo: q.cargoEditado.trim() || q.cargoOriginal
          })
          .eq('id', q.id);

        if (error) throw error;

        setProgressoAplicar(prev => ({ ...prev, [chave]: `Salvando ${i + 1}/${pendentes.length}...` }));

        if (i < pendentes.length - 1) await sleep(200);
      }

      setGrupos(prev => prev.map(g => g.chave === chave ? {
        ...g,
        questoes: g.questoes.map(q => q.aplicada ? q : { ...q, aplicada: true })
      } : g));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar as questões.');
    } finally {
      setAplicando(prev => ({ ...prev, [chave]: false }));
      setProgressoAplicar(prev => ({ ...prev, [chave]: '' }));
    }
  }

  async function recarregar() {
    setCarregando(true);
    setErro('');
    setGrupos([]);
    setExpandido(null);

    try {
      const { data, error } = await supabase
        .from('questoes')
        .select('id, banca, orgao, cargo, materia, topico, ano, enunciado, alternativa_a');

      if (error) throw error;

      const candidatas = (data || []).filter(
        (q: LinhaQuestao) => ehCampoFaltante(q.orgao) || ehCampoFaltante(q.cargo)
      );

      const novosGrupos = montarGrupos(candidatas);
      setGrupos(novosGrupos);
      if (novosGrupos.length > 0) setExpandido(novosGrupos[0].chave);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar as questões.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-[#e4e4e7] font-sans pb-20">
      <div className="max-w-5xl mx-auto px-6 pt-12 space-y-6 animate-in fade-in duration-500">

        <div className="flex items-center gap-3 border-b border-white/5 pb-4">
          <Link href="/admin/questoes" className="p-2 bg-white/5 hover:bg-white/10 text-zinc-400 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-white uppercase tracking-widest">
            Preencher Cargo e Órgão
          </h1>
        </div>

        {erro && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3 text-xs font-bold uppercase tracking-widest">
            <AlertCircle className="w-5 h-5 shrink-0" /> {erro}
          </div>
        )}

        {carregando ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
          </div>
        ) : totalPendentes === 0 ? (
          <div className="text-center py-20 bg-[#131c2f]/30 border border-white/5 rounded-3xl">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white uppercase tracking-widest mb-2">Tudo preenchido!</h3>
            <p className="text-sm text-zinc-400">Nenhuma questão ficou sem Cargo ou Órgão definido.</p>
            <button onClick={recarregar} className="mt-6 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white bg-white/5 px-4 py-2.5 rounded-lg transition-colors">
              Recarregar
            </button>
          </div>
        ) : (
          <>
            <div className="bg-[#131c2f]/30 border border-white/5 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-amber-400 uppercase tracking-widest">
                  {totalPendentes} questões aguardando preenchimento
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  Agrupadas por Banca · Matéria · Ano. A busca na web encontra a questão original e sugere as tags — revise antes de salvar.
                </p>
              </div>
              <button onClick={recarregar} className="text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white bg-white/5 px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2 w-fit">
                <RefreshCcw className="w-3.5 h-3.5" /> Recarregar
              </button>
            </div>

            <div className="space-y-4">
              {grupos.map(grupo => {
                const pendentes = grupo.questoes.filter(q => !q.aplicada);
                if (pendentes.length === 0) return null;
                const aberto = expandido === grupo.chave;
                const topicos = new Set(pendentes.filter(q => q.topico).map(q => q.topico)).size;

                return (
                  <div key={grupo.chave} className="bg-[#131c2f]/30 border border-white/5 rounded-2xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandido(aberto ? null : grupo.chave)}
                      className="w-full flex items-center justify-between gap-4 p-5 hover:bg-white/5 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <ChevronDown className={`w-5 h-5 text-zinc-500 shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`} />
                        <div className="min-w-0">
                          <p className="font-bold text-white text-sm truncate">
                            {grupo.banca} · {grupo.materia} · {grupo.ano ?? 'ano indefinido'}
                          </p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {topicos === 1 ? `${topicos} tópico` : `${topicos} tópicos`}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md">
                        {pendentes.length} questões
                      </span>
                    </button>

                    {aberto && (
                      <div className="border-t border-white/5 p-5 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => buscarMetadadosGrupo(grupo.chave)}
                            disabled={!!buscandoIA[grupo.chave]}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest py-3 px-5 rounded-xl transition-all flex items-center gap-2 w-fit"
                          >
                            {buscandoIA[grupo.chave] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                            {buscandoIA[grupo.chave] ? 'Buscando na web...' : 'Buscar informações na web'}
                          </button>
                          <span className="text-xs text-zinc-500">
                            Encontra a questão no Gran Cursos e preenche Órgão/Cargo da prova. IA estima o restante.
                          </span>
                          {progressoIA[grupo.chave] && (
                            <span className="text-xs font-medium text-indigo-400">{progressoIA[grupo.chave]}</span>
                          )}
                        </div>

                        <div className="space-y-3">
                          {pendentes.map(q => (
                            <div key={q.id} className="bg-[#09090b] border border-white/5 rounded-xl p-4 space-y-3">
                              <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">{q.enunciado}</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Órgão</label>
                                  <input
                                    type="text"
                                    value={q.orgaoEditado}
                                    onChange={e => atualizarCampo(grupo.chave, q.id, 'orgaoEditado', e.target.value)}
                                    placeholder="Ex: TRT-2, TJ-RJ"
                                    className="w-full text-sm bg-[#09090b] border border-white/10 text-white rounded-lg px-3 py-2.5 focus:border-blue-500 outline-none transition-all"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Cargo</label>
                                  <input
                                    type="text"
                                    value={q.cargoEditado}
                                    onChange={e => atualizarCampo(grupo.chave, q.id, 'cargoEditado', e.target.value)}
                                    placeholder="Ex: Analista Judiciário"
                                    className="w-full text-sm bg-[#09090b] border border-white/10 text-white rounded-lg px-3 py-2.5 focus:border-blue-500 outline-none transition-all"
                                  />
                                </div>
                              </div>
                              {q.status !== 'nao_encontrado' && (
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <span
                                    className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md flex items-center gap-1.5 ${
                                      q.status === 'verificado'
                                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                                        : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                                    }`}
                                  >
                                    {q.status === 'verificado'
                                      ? `Encontrada — ${q.fonte}`
                                      : `Estimativa IA — ${q.fonte}`}
                                  </span>
                                  {q.fonteUrl && (
                                    <a
                                      href={q.fonteUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[10px] font-bold uppercase tracking-widest text-blue-400 hover:text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-md flex items-center gap-1.5 transition-colors"
                                    >
                                      <ExternalLink className="w-3 h-3" /> abrir fonte
                                    </a>
                                  )}
                                </div>
                              )}
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => aplicarQuestao(grupo.chave, q.id)}
                                  className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-md transition-colors"
                                >
                                  Aplicar
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 pt-1">
                          {progressoAplicar[grupo.chave] && (
                            <span className="text-xs font-medium text-emerald-400">{progressoAplicar[grupo.chave]}</span>
                          )}
                          <button
                            type="button"
                            onClick={() => aplicarGrupo(grupo.chave)}
                            disabled={!!aplicando[grupo.chave] || pendentes.length === 0}
                            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-black text-xs font-black uppercase tracking-widest px-6 py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                          >
                            {aplicando[grupo.chave] ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Aplicar todas as {pendentes.length} questões
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}