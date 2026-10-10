"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { dispararAlertaSuporte } from "@/lib/telegram";
import { uploadImagensSuporte, montarMensagemComImagens } from "@/lib/uploadImagem";
import AnexadorImagem from "@/components/AnexadorImagem";
import { AlertTriangle, X, Send, CheckCircle2, Loader2 } from "lucide-react";

const TIPOS_ERRO = [
  "Gabarito errado",
  "Erro de digitação",
  "Enunciado/alternativa incompleta",
  "Falta informação (cargo, órgão ou ano)",
  "Outro",
];

// Botão "Reportar erro" ao lado de cada questão. Grava um chamado de suporte
// com categoria "Erro em Questão" e o ID da questão já preenchido — o mesmo
// canal que a página /suporte usa, então aparece no histórico do aluno e na
// fila do /admin/suporte com alerta por Telegram.
//
// Regra anti-duplicata: o mesmo aluno não abre um segundo reporte "aberto"
// (pendente ou em atendimento) para a mesma questão.
interface ReportarErroQuestaoProps {
  questaoId: string;
  className?: string;
}

export default function ReportarErroQuestao({ questaoId, className }: ReportarErroQuestaoProps) {
  const [aberto, setAberto] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [jaReportado, setJaReportado] = useState(false);
  const [tipoSelecionado, setTipoSelecionado] = useState<string | null>(null);
  const [descricao, setDescricao] = useState("");
  const [imagens, setImagens] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const [identidade, setIdentidade] = useState<{ alunoId: string | null; nome: string; email: string }>({
    alunoId: null,
    nome: "",
    email: "",
  });

  // Carrega a identidade do aluno ao abrir e já confere se há um reporte aberto.
  useEffect(() => {
    if (!aberto) return;

    let ativo = true;

    (async () => {
      setVerificando(true);

      const { data: { session } } = await supabase.auth.getSession();
      const alunoId = session?.user?.id || null;
      const email = session?.user?.email || "";
      let nome = "";

      if (alunoId) {
        const { data: perfil } = await supabase
          .from("usuarios")
          .select("nome")
          .eq("id", alunoId)
          .single();
        if (perfil?.nome) nome = perfil.nome;
      }

      let pendenteAnterior = false;
      if (alunoId) {
        const { data: abertos } = await supabase
          .from("chamados_suporte")
          .select("id")
          .eq("aluno_id", alunoId)
          .eq("questao_id", questaoId)
          .neq("status", "resolvido");

        pendenteAnterior = !!(abertos && abertos.length > 0);
      }

      if (!ativo) return;
      setIdentidade({ alunoId, nome, email });
      setJaReportado(pendenteAnterior);
      setVerificando(false);
    })();

    return () => { ativo = false; };
  }, [aberto, questaoId]);

  const fechar = () => {
    if (enviando) return;
    setAberto(false);
    setTipoSelecionado(null);
    setDescricao("");
    setImagens([]);
    setErro("");
  };

  const enviar = async () => {
    if (!tipoSelecionado) {
      setErro("Escolha o tipo de problema antes de enviar.");
      return;
    }

    setEnviando(true);
    setErro("");

    try {
      const urlsImagens = await uploadImagensSuporte(imagens);
      const textoBase = tipoSelecionado + (descricao.trim() ? `\n\n${descricao.trim()}` : "");
      const mensagemFinal = montarMensagemComImagens(textoBase, urlsImagens);

      const { error: erroSuporte } = await supabase.from("chamados_suporte").insert({
        aluno_id: identidade.alunoId,
        nome: identidade.nome || null,
        email: identidade.email || null,
        categoria: "Erro em Questão",
        mensagem: mensagemFinal,
        questao_id: questaoId,
        status: "pendente",
      });

      if (erroSuporte) throw erroSuporte;

      await dispararAlertaSuporte({
        tipo: "novo",
        nome: identidade.nome || undefined,
        email: identidade.email || undefined,
        categoria: "Erro em Questão",
        msg: textoBase,
        questaoId,
        imagens: urlsImagens,
      });

      setJaReportado(true);
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : String(err);
      setErro(`Não foi possível enviar o reporte: ${mensagem}`);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 ${className || ""} hover:bg-red-500/20 hover:text-red-400 px-3 py-1 rounded-md transition-colors`}
        title="Reportar erro nesta questão"
      >
        <AlertTriangle className="w-3 h-3" /> Reportar erro
      </button>

      {aberto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#131c2f] w-full max-w-md p-7 rounded-3xl border border-white/10 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h2 className="font-bold text-white uppercase tracking-widest text-sm">
                  Reportar erro
                </h2>
              </div>
              <button
                type="button"
                onClick={fechar}
                disabled={enviando}
                className="p-1.5 text-zinc-500 hover:text-white rounded-lg transition-colors disabled:opacity-50"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {verificando ? (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              </div>
            ) : jaReportado ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                <p className="text-sm text-zinc-300 font-medium">
                  Você já reportou um problema nesta questão. Ele está aberto no seu histórico de Suporte.
                </p>
                <p className="text-xs text-zinc-500 mt-2">
                  Pode continuar acompanhando por lá, e a correção será feita pelo professor.
                </p>
                <button
                  type="button"
                  onClick={fechar}
                  className="mt-6 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-zinc-300 text-[10px] font-black uppercase tracking-widest transition-colors"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                    Qual é o problema?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {TIPOS_ERRO.map(tipo => (
                      <button
                        key={tipo}
                        type="button"
                        onClick={() => { setTipoSelecionado(tipo); setErro(""); }}
                        className={`px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-colors ${
                          tipoSelecionado === tipo
                            ? "bg-red-500/20 border-red-500/40 text-red-400"
                            : "bg-white/5 border-white/10 text-zinc-400 hover:border-white/25"
                        }`}
                      >
                        {tipo}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                    Descreva o que encontrou (opcional)
                  </p>
                  <textarea
                    rows={3}
                    value={descricao}
                    onChange={e => setDescricao(e.target.value)}
                    placeholder="Ex.: a alternativa C está incompleta, falta o final da frase."
                    className="w-full bg-[#09090b] border border-white/10 rounded-xl p-4 text-sm text-white outline-none focus:border-emerald-500 transition-colors resize-none placeholder:text-zinc-600"
                  />
                </div>

                <AnexadorImagem imagens={imagens} onChange={setImagens} />

                {erro && <p className="text-xs font-bold text-red-400">{erro}</p>}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={fechar}
                    disabled={enviando}
                    className="px-5 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-zinc-400 text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={enviar}
                    disabled={enviando || !tipoSelecionado}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-xl text-white text-[10px] font-black uppercase tracking-widest transition-colors"
                  >
                    {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {enviando ? "Enviando..." : "Enviar reporte"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}