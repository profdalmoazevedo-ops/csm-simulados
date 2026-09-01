"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { LifeBuoy, MessageSquare, History, Send, CheckCircle2, AlertCircle, Trash2, RotateCcw, X } from "lucide-react";

interface Chamado {
  id: string;
  criado_em: string;
  categoria: string;
  mensagem: string;
  status: string;
  resposta_admin: string | null;
  questao_id: string | null;
}

export default function SuportePage() {
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [alunoId, setAlunoId] = useState<string | null>(null);
  
  const [abaAtiva, setAbaAtiva] = useState<"novo" | "historico">("novo");
  const [meusChamados, setMeusChamados] = useState<Chamado[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);

  // Estados para reabertura de chamado
  const [reabrindoId, setReabrindoId] = useState<string | null>(null);
  const [motivoReabertura, setMotivoReabertura] = useState("");
  const [processandoAcao, setProcessandoAcao] = useState(false);

  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    categoria: "Acesso à Plataforma",
    mensagem: "",
    questao_id: "",
  });

  useEffect(() => {
    async function checarSessao() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setAlunoId(session.user.id);
        setFormData(prev => ({ ...prev, email: session.user.email || "" }));
        
        const { data: perfil } = await supabase
          .from("usuarios")
          .select("nome")
          .eq("id", session.user.id)
          .single();
          
        if (perfil?.nome) {
          setFormData(prev => ({ ...prev, nome: perfil.nome }));
        }
      }
    }
    checarSessao();
  }, []);

  useEffect(() => {
    async function buscarHistorico() {
      if (abaAtiva === "historico" && alunoId) {
        setCarregandoHistorico(true);
        try {
          const { data, error } = await supabase
            .from("chamados_suporte")
            .select("id, criado_em, categoria, mensagem, status, resposta_admin, questao_id")
            .eq("aluno_id", alunoId)
            .order("criado_em", { ascending: false });

          if (!error && data) {
            setMeusChamados(data);
          }
        } catch (err) {
          console.error("Erro ao buscar histórico:", err);
        } finally {
          setCarregandoHistorico(false);
        }
      }
    }
    buscarHistorico();
  }, [abaAtiva, alunoId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const enviarAlertaTelegram = async (nome: string, email: string, categoria: string, msg: string, qId?: string, isReabertura = false) => {
    const token = process.env.NEXT_PUBLIC_BOT_SUPORTE_TOKEN;
    const chatId = process.env.NEXT_PUBLIC_CHAT_ADMIN_ID;
    
    if (!token || !chatId) return;

    const textoFormatado = isReabertura 
      ? `⚠️ *CHAMADO REABERTO PELO ALUNO* ⚠️\n\n` +
        `👤 *Aluno:* ${nome}\n` +
        `📌 *Categoria:* ${categoria}\n` +
        `\n💬 *Motivo da Reabertura:* \n"${msg}"\n\n` +
        `📦 _Acesse o painel admin para verificar._`
      : `🚨 *NOVO CHAMADO DE SUPORTE* 🚨\n\n` +
        `👤 *Aluno:* ${nome}\n` +
        `📬 *E-mail:* ${email}\n` +
        `📌 *Categoria:* ${categoria}\n` +
        (qId ? `🆔 *ID da Questão:* ${qId}\n` : '') +
        `\n💬 *Mensagem:* \n"${msg}"\n\n` +
        `📦 _Acesse o painel admin para responder._`;

    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: textoFormatado, parse_mode: "Markdown" }),
      });
    } catch (err) {
      console.error("Falha ao enviar push para o Telegram:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const idDaQuestao = formData.categoria === "Erro em Questão" ? formData.questao_id : null;

      const { error: erroSuporte } = await supabase.from("chamados_suporte").insert({
        aluno_id: alunoId,
        nome: formData.nome,
        email: formData.email,
        categoria: formData.categoria,
        mensagem: formData.mensagem,
        questao_id: idDaQuestao,
        status: "pendente"
      });

      if (erroSuporte) throw erroSuporte;

      await enviarAlertaTelegram(formData.nome, formData.email, formData.categoria, formData.mensagem, idDaQuestao || undefined);

      setSucesso(true);
      setFormData(prev => ({ ...prev, mensagem: "", questao_id: "", categoria: "Acesso à Plataforma" }));
    } catch (error: any) {
      alert(`Erro ao enviar chamado: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- NOVAS AÇÕES DO ALUNO ---
  
  const handleApagarChamado = async (id: string) => {
    if (!confirm("Tem certeza que deseja apagar este chamado do seu histórico?")) return;
    try {
      const { error } = await supabase.from("chamados_suporte").delete().eq("id", id);
      if (error) throw error;
      setMeusChamados(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      alert(`Erro ao apagar: ${err.message}`);
    }
  };

  const handleConfirmarReabertura = async (chamado: Chamado) => {
    if (!motivoReabertura.trim()) {
      return alert("Por favor, explique o motivo da reabertura.");
    }
    setProcessandoAcao(true);
    try {
      const novaMensagem = `${chamado.mensagem}\n\n[REABERTO PELO ALUNO]\nMotivo: ${motivoReabertura}`;
      
      const { error } = await supabase.from("chamados_suporte").update({
        status: 'pendente',
        mensagem: novaMensagem
      }).eq("id", chamado.id);

      if (error) throw error;

      await enviarAlertaTelegram(formData.nome, formData.email, chamado.categoria, motivoReabertura, chamado.questao_id || undefined, true);

      // Atualiza estado local
      setMeusChamados(prev => prev.map(c => c.id === chamado.id ? { ...c, status: 'pendente', mensagem: novaMensagem } : c));
      setReabrindoId(null);
      setMotivoReabertura("");
    } catch (err: any) {
      alert(`Erro ao reabrir: ${err.message}`);
    } finally {
      setProcessandoAcao(false);
    }
  };

  if (sucesso) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4">
        <div className="bg-[#131c2f]/30 rounded-2xl border border-white/5 p-10 max-w-md w-full text-center shadow-lg animate-in zoom-in duration-300">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-6" />
          <h2 className="text-2xl font-black text-white tracking-tight mb-3 uppercase tracking-widest">Chamado Recebido</h2>
          <p className="text-sm text-zinc-400 mb-8 leading-relaxed">
            Sua solicitação foi encaminhada para a nossa equipe. Você pode acompanhar o andamento na aba de histórico.
          </p>
          <button 
            onClick={() => { setSucesso(false); setAbaAtiva("historico"); }} 
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-4 text-xs font-bold text-white uppercase tracking-widest hover:bg-white/10 transition-colors"
          >
            Ver Meus Chamados
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-[#e4e4e7] py-12 px-4 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-8">
        
        {/* Cabeçalho */}
        <div className="text-center space-y-3">
          <LifeBuoy className="w-10 h-10 text-emerald-500 mx-auto" />
          <h1 className="text-2xl font-black tracking-widest text-white uppercase">Central de Suporte</h1>
          <p className="text-xs text-zinc-500 uppercase tracking-widest">Como podemos ajudar você hoje?</p>
        </div>

        {/* Navegação por Abas */}
        <div className="flex bg-[#131c2f]/50 p-1.5 rounded-2xl border border-white/5">
          <button
            onClick={() => setAbaAtiva("novo")}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${
              abaAtiva === "novo" ? "bg-white/10 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
            }`}
          >
            <MessageSquare className="w-4 h-4" /> Novo Chamado
          </button>
          <button
            onClick={() => setAbaAtiva("historico")}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${
              abaAtiva === "historico" ? "bg-white/10 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
            }`}
          >
            <History className="w-4 h-4" /> Meu Histórico
          </button>
        </div>

        {/* Área de Conteúdo */}
        <div className="bg-[#131c2f]/30 rounded-3xl border border-white/5 p-6 sm:p-8 shadow-sm">
          
          {abaAtiva === "novo" && (
            <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Seu Nome</label>
                  <input type="text" name="nome" required value={formData.nome} onChange={handleChange} 
                    className="w-full rounded-xl bg-[#09090b] border border-white/10 p-4 text-sm text-white focus:border-emerald-500 focus:outline-none transition-colors placeholder:text-zinc-700" 
                    placeholder="Ex: João da Silva"/>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">E-mail</label>
                  <input type="email" name="email" required value={formData.email} onChange={handleChange} 
                    className="w-full rounded-xl bg-[#09090b] border border-white/10 p-4 text-sm text-white focus:border-emerald-500 focus:outline-none transition-colors placeholder:text-zinc-700" 
                    placeholder="Ex: joao@email.com"/>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Assunto / Categoria</label>
                <div className="relative">
                  <select name="categoria" value={formData.categoria} onChange={handleChange} 
                    className="w-full rounded-xl bg-[#09090b] border border-white/10 p-4 text-sm text-white focus:border-emerald-500 focus:outline-none transition-colors appearance-none cursor-pointer">
                    <option value="Acesso à Plataforma" className="bg-[#09090b]">Acesso / Login</option>
                    <option value="Dúvida sobre Assinatura" className="bg-[#09090b]">Problema na Assinatura / Pagamento</option>
                    <option value="Erro em Questão" className="bg-[#09090b]">Erro em Questão (Gabarito, Duplicidade)</option>
                    <option value="Dúvida de Conteúdo" className="bg-[#09090b]">Dúvida de Conteúdo</option>
                    <option value="Outros" className="bg-[#09090b]">Outros</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 text-xs">▼</div>
                </div>
              </div>

              {formData.categoria === "Erro em Questão" && (
                <div className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-xl animate-in slide-in-from-top-2">
                  <label className="block text-xs font-bold text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> ID da Questão (Opcional)
                  </label>
                  <input type="text" name="questao_id" value={formData.questao_id} onChange={handleChange} 
                    className="w-full rounded-lg bg-[#09090b] border border-amber-500/30 p-3 text-sm text-white focus:border-amber-500 focus:outline-none placeholder:text-zinc-600" 
                    placeholder="Cole o ID da questão aqui..."/>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Mensagem</label>
                <textarea name="mensagem" required rows={5} value={formData.mensagem} onChange={handleChange} 
                  className="w-full rounded-xl bg-[#09090b] border border-white/10 p-4 text-sm text-white focus:border-emerald-500 focus:outline-none resize-none transition-colors placeholder:text-zinc-700 custom-scrollbar" 
                  placeholder="Descreva seu problema com o máximo de detalhes possível..."/>
              </div>

              <button type="submit" disabled={loading} 
                className="w-full rounded-xl bg-emerald-600 px-4 py-4 text-xs font-black uppercase tracking-widest text-black hover:bg-emerald-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20">
                {loading ? "Processando..." : <><Send className="w-4 h-4" /> Enviar Solicitação</>}
              </button>
            </form>
          )}

          {abaAtiva === "historico" && (
            <div className="space-y-4 animate-in fade-in duration-500">
              {carregandoHistorico ? (
                <div className="text-center py-12 text-zinc-500 text-xs font-bold uppercase tracking-widest animate-pulse">
                  Carregando histórico...
                </div>
              ) : meusChamados.length === 0 ? (
                <div className="text-center py-16 text-zinc-500 bg-[#09090b] rounded-2xl border border-dashed border-white/10">
                  <p className="text-sm font-bold uppercase tracking-widest">Nenhum chamado</p>
                  <p className="text-xs mt-2">Você ainda não abriu solicitações de suporte.</p>
                </div>
              ) : (
                meusChamados.map((chamado) => (
                  <div key={chamado.id} className="bg-[#09090b] border border-white/5 rounded-2xl p-6 transition-all hover:border-white/10 space-y-4">
                    
                    {/* Header do Card */}
                    <div className="flex justify-between items-start border-b border-white/5 pb-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border w-fit ${
                          chamado.status === 'resolvido' 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : chamado.status === 'em_atendimento' 
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {chamado.status === 'resolvido' ? '✅ Resolvido' : chamado.status === 'em_atendimento' ? '🔄 Em Análise' : '⏳ Pendente'}
                        </span>
                        <span className="text-xs font-bold text-zinc-300 uppercase tracking-widest">{chamado.categoria}</span>
                      </div>
                      
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                          {new Date(chamado.criado_em).toLocaleDateString('pt-BR')}
                        </span>
                        <button 
                          onClick={() => handleApagarChamado(chamado.id)}
                          className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Apagar do Histórico"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Conteúdo */}
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-2">Sua Mensagem:</p>
                      <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{chamado.mensagem}</p>
                    </div>

                    {/* Resposta do Admin */}
                    {chamado.resposta_admin && (
                      <div className="mt-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-5 relative">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                            Resposta do Professor
                          </span>
                        </div>
                        <p className="text-sm text-emerald-100/80 whitespace-pre-wrap leading-relaxed">
                          {chamado.resposta_admin}
                        </p>
                      </div>
                    )}

                    {/* Ações Inferiores (Reabrir) */}
                    {chamado.status === 'resolvido' && reabrindoId !== chamado.id && (
                      <div className="pt-2 border-t border-white/5 flex justify-end">
                        <button 
                          onClick={() => setReabrindoId(chamado.id)}
                          className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 hover:text-amber-400 uppercase tracking-widest transition-colors p-2 rounded-lg hover:bg-amber-500/10"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> O problema persiste? Reabrir chamado
                        </button>
                      </div>
                    )}

                    {/* Formulário de Reabertura */}
                    {reabrindoId === chamado.id && (
                      <div className="mt-4 bg-black/40 border border-white/10 rounded-xl p-5 animate-in slide-in-from-top-2">
                        <div className="flex justify-between items-center mb-3">
                          <label className="block text-[10px] font-bold text-amber-500 uppercase tracking-widest">
                            Motivo da contestação / reabertura
                          </label>
                          <button onClick={() => { setReabrindoId(null); setMotivoReabertura(""); }} className="text-zinc-500 hover:text-white">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <textarea 
                          rows={3} 
                          value={motivoReabertura} 
                          onChange={(e) => setMotivoReabertura(e.target.value)}
                          className="w-full rounded-lg bg-[#09090b] border border-white/10 p-3 text-sm text-white focus:border-amber-500 focus:outline-none resize-none transition-colors mb-3 custom-scrollbar" 
                          placeholder="Explique por que a resposta não resolveu o problema..."
                        />
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => handleConfirmarReabertura(chamado)}
                            disabled={processandoAcao}
                            className="bg-amber-600 hover:bg-amber-500 text-black px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-50"
                          >
                            {processandoAcao ? "Processando..." : "Confirmar Reabertura"}
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}