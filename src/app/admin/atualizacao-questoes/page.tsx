"use client";

import { useState } from "react";
// Importa o seu cliente local em vez do auth-helpers (ajuste o caminho se necessário)
import { supabase } from "@/lib/supabase"; 
import { Play, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

export default function AtualizadorEmLote() {
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [batchSize] = useState(20);

  const addLog = (message: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev]);
  };

  const processarProximoLote = async () => {
    setLoading(true);
    try {
      addLog(`Buscando até ${batchSize} questões sem órgão/cargo no banco...`);
      
      // 1. Busca questoes onde orgao está nulo
      const { data: questoes, error: fetchError } = await supabase
        .from("questoes")
        .select("id, enunciado")
        .is("orgao", null)
        .limit(batchSize);

      if (fetchError) throw fetchError;

      if (!questoes || questoes.length === 0) {
        addLog("✅ Nenhuma questão pendente encontrada! Atualização concluída.");
        setLoading(false);
        return;
      }

      addLog(`Encontradas ${questoes.length} questões. Enviando para IA...`);

      // 2. Envia o lote para a API
      const apiResponse = await fetch("/api/extrair-metadados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questoes }),
      });

      const apiData = await apiResponse.json();

      if (!apiResponse.ok) {
        throw new Error(apiData.error || "Erro desconhecido na API da IA.");
      }

      const extracoes = apiData.dados;
      addLog(`IA retornou dados para ${extracoes.length} questões. Salvando no Supabase...`);

      // 3. Atualiza as questões no Supabase
      for (const item of extracoes) {
        const { error: updateError } = await supabase
          .from("questoes")
          .update({ 
            orgao: item.orgao !== "N/A" ? item.orgao : null, 
            cargo: item.cargo !== "N/A" ? item.cargo : null 
          })
          .eq("id", item.id);
          
        if (updateError) {
          addLog(`Erro ao salvar questão ID ${item.id}: ${updateError.message}`);
        }
      }

      addLog(`Lote processado com sucesso!`);
      
    } catch (error: any) {
      addLog(`❌ ERRO: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 bg-[#09090b] min-h-screen text-white">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Cabeçalho */}
        <div>
          <h1 className="text-3xl font-serif italic text-white mb-2">Migração de Metadados</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            Ferramenta de extração em lote (Órgão / Cargo)
          </p>
        </div>

        {/* Card de Controle */}
        <div className="bg-[#131c2f]/30 border border-white/5 rounded-xl p-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Pronto para iniciar</h2>
            <p className="text-sm text-zinc-500 mt-1">
              O sistema pegará lotes de {batchSize} questões e usará IA para extrair os dados.
            </p>
          </div>
          <button
            onClick={processarProximoLote}
            disabled={loading}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Play className="w-5 h-5" />
            )}
            {loading ? "Processando Lote..." : "Processar Próximo Lote"}
          </button>
        </div>

        {/* Console de Logs */}
        <div className="bg-black/50 border border-white/10 rounded-xl p-4 h-96 overflow-y-auto custom-scrollbar">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4 sticky top-0 bg-black/80 py-2 border-b border-white/10">
            Log de Execução
          </h3>
          <div className="space-y-2 font-mono text-sm text-zinc-300">
            {log.length === 0 ? (
              <p className="text-zinc-600 italic">Aguardando inicialização...</p>
            ) : (
              log.map((msg, index) => (
                <div key={index} className="flex gap-2">
                  <span className="text-blue-400 shrink-0">➜</span>
                  <span className={msg.includes("❌") ? "text-rose-400" : msg.includes("✅") ? "text-emerald-400" : ""}>
                    {msg}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}