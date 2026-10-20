import { supabase } from '@/lib/supabase';
"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Search, Trash2, X } from "lucide-react";
import Link from "next/link";

interface QuestaoResumo {
  id: number;
  banca: string | null;
  orgao: string | null;
  cargo: string | null;
  materia: string | null;
  ano: number | null;
}

interface GrupoDuplicado {
  textoReferencia: string;
  quantidade: number;
  ids: number[];
  questoes: QuestaoResumo[];
}

interface RelatorioDuplicadasQuestoes {
  totalDuplicadasEncontradas: number;
  totalQuestoesAnalisadas: number;
  duplicadas: GrupoDuplicado[];
}

export default function AuditoriaDuplicadasQuestoes() {
  const [analisando, setAnalisando] = useState(false);
  const [relatorio, setRelatorio] = useState<RelatorioDuplicadasQuestoes | null>(null);
  const [erro, setErro] = useState("");
  const [limite, setLimite] = useState(500);
  const [filtro, setFiltro] = useState("");

  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [excluindo, setExcluindo] = useState(false);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);

  const varrerBanco = async () => {
    setAnalisando(true);
    setErro("");
    setRelatorio(null);
    setSelecionados([]);
    setExcluindoId(null);

    try {
      const response = await fetch("/api/verificar-duplicadas-questoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limite }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao varrer o banco de questões.");
      }

      setRelatorio(data as RelatorioDuplicadasQuestoes);
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setAnalisando(false);
    }
  };

  const duplicadasFiltradas = relatorio?.duplicadas.filter((d) => {
    if (!filtro) return true;
    const termo = filtro.toLowerCase();
    return (
      d.textoReferencia.toLowerCase().includes(termo) ||
      d.ids.some((id) => id.toString().includes(termo)) ||
      d.questoes.some(
        (q) =>
          (q.banca || "").toLowerCase().includes(termo) ||
          (q.orgao || "").toLowerCase().includes(termo) ||
          (q.cargo || "").toLowerCase().includes(termo) ||
          (q.materia || "").toLowerCase().includes(termo)
      )
    );
  });

  const toggleSelecionado = (id: number) => {
    setSelecionados((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleGrupo = (ids: number[]) => {
    const todosSelecionados = ids.every((id) => selecionados.includes(id));
    if (todosSelecionados) {
      setSelecionados((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelecionados((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  const limparSelecao = () => setSelecionados([]);
  async function excluirQuestao(id: number | string) {
    if (!confirm("Tem certeza absoluta que deseja remover esta questao permanentemente do acervo?")) return;
    try {
      const { error } = await supabase.from('questoes').delete().eq('id', id);
      if (error) throw error;
      setRelatorio((prev: any) => {
        if (!prev) return prev;
        const novosGrupos = prev.duplicadas
          .map((grupo: any) => ({
            ...grupo,
            questoes: grupo.questoes.filter((q: any) => String(q.id) !== String(id)),
            ids: grupo.ids.filter((gid: any) => String(gid) !== String(id)),
            quantidade: grupo.questoes.filter((q: any) => String(q.id) !== String(id)).length,
          }))
          .filter((grupo: any) => grupo.quantidade >= 2);
        return { ...prev, duplicadas: novosGrupos, totalDuplicadasEncontradas: novosGrupos.length };
      });
    } catch (error: any) {
      alert("Nao foi possivel excluir a questao: " + error.message);
    }
  }

const excluirUnica = async (id: number) => {
    const confirmar = confirm(
      `Excluir permanentemente a questão #${id}?\n\nEsta ação NÃO PODE ser desfeita.`
    );
    if (!confirmar) return;

    setExcluindo(true);
    setExcluindoId(id);
    try {
      const response = await fetch(`/api/questoes/${id}`, { method: "DELETE" });
      const data = await response.json();

      if (!response.ok) {
        const mensagem = [data.error, data.details && data.details !== data.error ? `\n\n${data.details}` : null, data.hint ? `\n\nDica: ${data.hint}` : null]
          .filter(Boolean)
          .join("");
        alert(mensagem || "Não foi possível excluir a questão.");
        return;
      }

      // Remove dos grupos
      setRelatorio((prev) => {
        if (!prev) return prev;
        const novosGrupos = prev.duplicadas
          .map((grupo) => ({
            ...grupo,
            questoes: grupo.questoes.filter((q) => q.id !== id),
            ids: grupo.ids.filter((gid) => gid !== id),
            quantidade: grupo.questoes.filter((q) => q.id !== id).length,
          }))
          .filter((grupo) => grupo.quantidade >= 2);
        return {
          ...prev,
          duplicadas: novosGrupos,
          totalDuplicadasEncontradas: novosGrupos.length,
        };
      });
      setSelecionados((prev) => prev.filter((s) => s !== id));
    } catch (err: any) {
      alert("Erro ao excluir questão: " + err.message);
    } finally {
      setExcluindo(false);
      setExcluindoId(null);
    }
  };

  const excluirSelecionadas = async () => {
    if (selecionados.length === 0) return;
    const confirmar = confirm(
      `Excluir permanentemente ${selecionados.length} questão(ões) selecionada(s)?\n\nEsta ação NÃO PODE ser desfeita.`
    );
    if (!confirmar) return;

    setExcluindo(true);
    try {
      const response = await fetch("/api/questoes/excluir-lote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selecionados }),
      });
      const data = await response.json();

      if (response.status === 500 && data.error) {
        alert(data.error + (data.details ? `\n\n${data.details}` : ""));
        return;
      }

      const sucessoIds = new Set((data.sucesso || []).map((s: any) => s.id));
      const falhas = data.falhas || [];

      // Remove apenas as com sucesso
      setRelatorio((prev) => {
        if (!prev) return prev;
        const novosGrupos = prev.duplicadas
          .map((grupo) => ({
            ...grupo,
            questoes: grupo.questoes.filter((q) => !sucessoIds.has(q.id)),
            ids: grupo.ids.filter((gid) => !sucessoIds.has(gid)),
            quantidade: grupo.questoes.filter((q) => !sucessoIds.has(q.id)).length,
          }))
          .filter((grupo) => grupo.quantidade >= 2);
        return {
          ...prev,
          duplicadas: novosGrupos,
          totalDuplicadasEncontradas: novosGrupos.length,
        };
      });

      // Limpa seleção das excluídas com sucesso
      setSelecionados((prev) => prev.filter((s) => !sucessoIds.has(s)));

      // Mostra relatório detalhado
      let mensagem = `Exclusão em lote finalizada.\n\nSucesso: ${sucessoIds.size}\nFalhas: ${falhas.length}`;
      if (falhas.length > 0) {
        mensagem += "\n\nDetalhes das falhas:";
        for (const f of falhas.slice(0, 10)) {
          mensagem += `\n\n#${f.id}:\n${f.motivo}`;
        }
        if (falhas.length > 10) {
          mensagem += `\n\n... e mais ${falhas.length - 10} falha(s).`;
        }
      }
      alert(mensagem);
    } catch (err: any) {
      alert("Erro ao excluir em lote: " + err.message);
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-[#e4e4e7] font-sans pb-20">
      <div className="max-w-6xl mx-auto px-6 pt-12 space-y-8">
        <div className="space-y-3">
          <h1 className="text-3xl font-serif text-white italic uppercase">
            Auditoria de Duplicadas — Banco de Questões
          </h1>
          <p className="text-zinc-400 max-w-3xl">
            Analisa todo o acervo da tabela <span className="text-zinc-200 font-medium">questoes</span> e aponta grupos com
            enunciados idênticos (após normalização de tags HTML, espaços e maiúsculas/minúsculas). Ideal para limpar
            repetições no banco geral.
          </p>
        </div>

        <div className="bg-[#131c2f]/60 border border-white/10 rounded-2xl p-6 space-y-6 shadow-lg shadow-black/20 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">
                  Limite de grupos exibidos
                </label>
                <select
                  value={limite}
                  onChange={(e) => setLimite(Number(e.target.value))}
                  disabled={analisando}
                  className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/60"
                >
                  <option value={200}>200 grupos</option>
                  <option value={500}>500 grupos (recomendado)</option>
                  <option value={1000}>1000 grupos</option>
                  <option value={9999}>Sem limite (pode demorar)</option>
                </select>
              </div>
              <div className="text-xs text-zinc-400 max-w-xs">
                Agrupa por enunciado normalizado. Considera duplicada quando há <span className="text-zinc-200">≥ 2 IDs</span> com mesmo texto.
              </div>
            </div>

            <button
              onClick={varrerBanco}
              disabled={analisando}
              className="bg-white text-[#09090b] px-6 py-2.5 rounded-lg font-bold hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-black/20"
            >
              {analisando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analisando todo o banco de questões...
                </>
              ) : (
                "Varrer Banco de Questões"
              )}
            </button>
          </div>
        </div>

        {selecionados.length > 0 && (
          <div className="sticky top-4 z-10 bg-red-500/10 border border-red-500/40 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg shadow-black/30 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-red-200">
              <Trash2 className="w-4 h-4" />
              <span className="text-sm font-semibold">
                {selecionados.length} questão(ões) selecionada(s)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={limparSelecao}
                disabled={excluindo}
                className="text-xs font-bold bg-white/5 border border-white/10 text-zinc-200 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                Limpar seleção
              </button>
              <button
                onClick={excluirSelecionadas}
                disabled={excluindo}
                className="text-xs font-bold bg-red-600/90 hover:bg-red-600 text-white px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {excluindo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Excluir selecionadas
              </button>
            </div>
          </div>
        )}

        {erro && (
          <div className="p-4 bg-red-500/10 border border-red-500/40 text-red-300 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <p className="font-medium">{erro}</p>
          </div>
        )}

        {relatorio && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#131c2f]/60 border border-white/10 rounded-xl text-sm font-semibold text-zinc-200 shadow-lg shadow-black/20">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>
                    Grupos duplicados: <span className="text-amber-400">{relatorio.totalDuplicadasEncontradas}</span>
                  </span>
                </div>
                <div className="text-zinc-400">
                  Questões analisadas: <span className="text-zinc-200">{relatorio.totalQuestoesAnalisadas}</span>
                </div>
              </div>

              {relatorio.totalDuplicadasEncontradas > 0 && (
                <div className="relative flex items-center">
                  <Search className="w-4 h-4 absolute left-3 text-zinc-500" />
                  <input
                    type="text"
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                    placeholder="Filtrar por texto, ID, banca, órgão, cargo ou matéria..."
                    className="bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500/60 w-80"
                  />
                </div>
              )}
            </div>

            {relatorio.totalDuplicadasEncontradas === 0 ? (
              <div className="p-8 text-center bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 rounded-2xl flex flex-col items-center gap-3 shadow-lg shadow-black/20">
                <CheckCircle2 className="w-8 h-8" />
                <p className="font-semibold text-lg">Nenhuma duplicidade encontrada no banco de questões.</p>
                <p className="text-sm text-emerald-300/80">Todos os enunciados são únicos após a normalização.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(duplicadasFiltradas || []).map((item, index) => (
                  <div
                    key={index}
                    className="bg-[#131c2f]/60 border border-amber-500/40 rounded-2xl p-5 shadow-lg shadow-black/20 space-y-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="bg-amber-500/10 border border-amber-500/40 text-amber-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Grupo com {item.quantidade} questões idênticas
                        </span>
                        <button
                          onClick={() => toggleGrupo(item.ids)}
                          className="text-xs text-zinc-300 hover:text-white transition-colors"
                        >
                          {item.ids.every((id) => selecionados.includes(id)) ? "Desmarcar todas" : "Selecionar todas deste grupo"}
                        </button>
                      </div>
                      <div className="text-xs text-zinc-400 font-mono">
                        IDs: {item.ids.slice(0, 6).join(", ")}
                        {item.ids.length > 6 && ` +${item.ids.length - 6} mais`}
                      </div>
                    </div>

                    <p className="text-zinc-100 font-medium leading-relaxed border-l-2 border-amber-500/60 pl-4">
                      “{item.textoReferencia}”
                    </p>

                    <div className="space-y-3 bg-black/20 border border-white/10 p-4 rounded-xl overflow-x-auto">
                      <span className="block text-zinc-400 font-semibold text-xs uppercase tracking-wider mb-2">
                        Questões no grupo
                      </span>
                      <div className="min-w-[820px] space-y-2">
                        {item.questoes.map((q) => (
                          <div
                            key={q.id}
                            className={`grid grid-cols-[40px_80px_1fr_1fr_1fr_1fr_80px_60px] items-center gap-3 px-3 py-2 border rounded-lg text-xs transition-colors ${
                              selecionados.includes(q.id)
                                ? "bg-blue-500/10 border-blue-500/40"
                                : "bg-[#131c2f]/60 border-white/10"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selecionados.includes(q.id)}
                              onChange={() => toggleSelecionado(q.id)}
                              className="w-4 h-4 text-blue-500 rounded focus:ring-blue-500 focus:ring-offset-0 bg-black/40 border-white/20"
                            />
                            <Link
                              href={`/admin/questoes/editar/${q.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-blue-300 hover:text-blue-200 flex items-center gap-1"
                            >
                              #{q.id}
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                            <div className="truncate text-zinc-300" title={q.banca || ""}>
                              {q.banca || <span className="text-zinc-500">—</span>}
                            </div>
                            <div className="truncate text-zinc-300" title={q.orgao || ""}>
                              {q.orgao || <span className="text-zinc-500">—</span>}
                            </div>
                            <div className="truncate text-zinc-300" title={q.cargo || ""}>
                              {q.cargo || <span className="text-zinc-500">—</span>}
                            </div>
                            <div className="truncate text-zinc-300" title={q.materia || ""}>
                              {q.materia || <span className="text-zinc-500">—</span>}
                            </div>
                            <div className="text-center text-zinc-300">
                              {q.ano ?? <span className="text-zinc-500">—</span>}
                            </div>
                            <button
                              onClick={() => excluirUnica(q.id)}
                              disabled={excluindo}
                              className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                              title="Excluir questão"
                            >
                              {excluindoId === q.id && excluindo ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
