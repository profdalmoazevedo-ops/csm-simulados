"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";

interface Simulado {
  id: string;
  titulo: string;
  visivel: boolean;
}

interface Duplicada {
  textoReferencia: string;
  banca: string | null;
  ano: number | null;
  ids: number[];
  simulados: string[];
}

interface RelatorioDuplicadas {
  totalDuplicadasEncontradas: number;
  duplicadas: Duplicada[];
}

export default function RelatorioDuplicadas() {
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [simulados, setSimulados] = useState<Simulado[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);

  const [analisando, setAnalisando] = useState(false);
  const [relatorio, setRelatorio] = useState<RelatorioDuplicadas | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    async function carregarSimulados() {
      const { data, error } = await supabase
        .from("simulados")
        .select("id, titulo, visivel")
        .order("data_liberacao", { ascending: false });

      if (!error && data) {
        setSimulados(data as Simulado[]);
      }
      setCarregandoDados(false);
    }
    carregarSimulados();
  }, []);

  const toggleSimulado = (id: string) => {
    setSelecionados((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selecionarApenasVisiveis = () => {
    const visiveis = simulados.filter((s) => s.visivel).map((s) => s.id);
    setSelecionados(visiveis);
  };

  const limparSelecao = () => setSelecionados([]);

  const varrerBanco = async () => {
    if (selecionados.length < 2) {
      setErro("Selecione pelo menos 2 simulados para comparar.");
      return;
    }

    setAnalisando(true);
    setErro("");
    setRelatorio(null);

    try {
      const response = await fetch("/api/verificar-duplicadas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simuladosIds: selecionados }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao varrer o banco de dados.");
      }

      setRelatorio(data as RelatorioDuplicadas);
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setAnalisando(false);
    }
  };

  const getNomeSimulado = (id: string) => {
    const sim = simulados.find((s) => s.id === id);
    return sim ? sim.titulo : `ID: ${id}`;
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-[#e4e4e7] font-sans pb-20">
      <div className="max-w-5xl mx-auto px-6 pt-12 space-y-8">
        <div className="space-y-3">
          <h1 className="text-3xl font-serif text-white italic uppercase">
            Auditoria de Banco de Questões
          </h1>
          <p className="text-zinc-400 max-w-3xl">
            Compare simulados para identificar questões duplicadas, tanto dentro do mesmo simulado quanto entre diferentes cadernos. Para evitar falsos positivos com blocos importados pela IA, priorize a seleção apenas de simulados finais (visíveis aos alunos).
          </p>
        </div>

        <div className="bg-[#131c2f]/60 border border-white/10 rounded-2xl p-6 space-y-6 shadow-lg shadow-black/20 backdrop-blur-sm">
          {carregandoDados ? (
            <div className="flex items-center gap-2 text-zinc-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Carregando simulados...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">
                  Selecionar Simulados para Comparação
                </h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={selecionarApenasVisiveis}
                    className="text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-lg hover:bg-emerald-500/20 transition-colors"
                  >
                    ✓ Selecionar Apenas Visíveis (Finais)
                  </button>
                  <button
                    onClick={limparSelecao}
                    className="text-xs font-bold bg-white/5 border border-white/10 text-zinc-300 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    Limpar Seleção
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto p-2 border border-white/10 rounded-xl bg-black/20">
                {simulados.map((sim) => (
                  <label
                    key={sim.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selecionados.includes(sim.id)
                        ? "bg-blue-500/10 border-blue-500/40"
                        : "bg-[#131c2f]/40 border-white/10 hover:bg-white/5"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selecionados.includes(sim.id)}
                      onChange={() => toggleSimulado(sim.id)}
                      className="w-4 h-4 text-blue-500 rounded focus:ring-blue-500 focus:ring-offset-0 bg-black/40 border-white/20"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-zinc-100 block truncate">
                        {sim.titulo}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider ${
                          sim.visivel ? "text-emerald-400" : "text-amber-400"
                        }`}
                      >
                        {sim.visivel ? "👁️ Visível aos Alunos" : "🔒 Bloco Oculto (Base)"}
                      </span>
                    </div>
                  </label>
                ))}
              </div>

              <button
                onClick={varrerBanco}
                disabled={analisando || selecionados.length < 2}
                className="mt-2 bg-white text-[#09090b] px-6 py-2.5 rounded-lg font-bold hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-black/20"
              >
                {analisando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processando cruzamento de dados...
                  </>
                ) : (
                  `Comparar ${selecionados.length} Simulado${selecionados.length !== 1 ? "s" : ""} Selecionado${selecionados.length !== 1 ? "s" : ""}`
                )}
              </button>
            </div>
          )}
        </div>

        {erro && (
          <div className="p-4 bg-red-500/10 border border-red-500/40 text-red-300 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <p className="font-medium">{erro}</p>
          </div>
        )}

        {relatorio && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-4 p-4 bg-[#131c2f]/60 border border-white/10 rounded-xl text-sm font-semibold text-zinc-200 shadow-lg shadow-black/20">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>
                  Duplicadas encontradas:{" "}
                  <span className="text-amber-400">{relatorio.totalDuplicadasEncontradas}</span>
                </span>
              </div>
              <div className="text-zinc-400 text-xs">Simulados analisados: {selecionados.length}</div>
            </div>

            {relatorio.totalDuplicadasEncontradas === 0 ? (
              <div className="p-8 text-center bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 rounded-2xl flex flex-col items-center gap-3 shadow-lg shadow-black/20">
                <CheckCircle2 className="w-8 h-8" />
                <p className="font-semibold text-lg">Excelente! Não há repetição de questões entre os simulados selecionados.</p>
                <p className="text-sm text-emerald-300/80">O cruzamento não encontrou textos idênticos nos cadernos analisados.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {relatorio.duplicadas.map((item, index) => (
                  <div key={index} className="bg-[#131c2f]/60 border border-amber-500/40 rounded-2xl p-5 shadow-lg shadow-black/20 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <span className="bg-amber-500/10 border border-amber-500/40 text-amber-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Alerta de Duplicidade
                      </span>
                      <div className="text-sm font-semibold text-zinc-400 text-right">
                        {item.banca ? item.banca : "—"}
                        {item.ano !== null && item.ano !== undefined ? ` (${item.ano})` : ""}
                      </div>
                    </div>

                    <p className="text-zinc-100 font-medium leading-relaxed border-l-2 border-amber-500/60 pl-4">“{item.textoReferencia}”</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-black/20 border border-white/10 p-4 rounded-xl">
                      <div className="space-y-2">
                        <span className="block text-zinc-400 font-semibold text-xs uppercase tracking-wider mb-2">IDs das Questões</span>
                        <div className="flex flex-wrap gap-2">
                          {item.ids.map((id) => (
                            <span key={id} className="bg-[#131c2f]/80 border border-white/10 px-2.5 py-1 rounded-lg text-zinc-200 font-mono text-xs shadow-sm">
                              {id}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className="block text-zinc-400 font-semibold text-xs uppercase tracking-wider mb-2">Encontrada nos Simulados</span>
                        <div className="flex flex-wrap gap-2">
                          {item.simulados.map((simId) => (
                            <Link
                              key={simId}
                              href={`/admin/simulados/editar/${simId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-blue-500/10 border border-blue-500/40 text-blue-300 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm hover:bg-blue-500/20 transition-colors flex items-center gap-1.5"
                              title="Abrir simulado em nova aba"
                            >
                              {getNomeSimulado(simId)}
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                          ))}
                        </div>
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
