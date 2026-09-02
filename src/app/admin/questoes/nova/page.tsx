"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Save, BookOpen, AlertCircle, CheckCircle2, Wand2, RefreshCcw, Info, Layers } from 'lucide-react';
import Link from 'next/link';

export default function NovaQuestaoAdmin() {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  
  const [modo, setModo] = useState<'manual' | 'ia_unica' | 'ia_lote'>('manual');
  
  const [textoBruto, setTextoBruto] = useState("");
  const [gerandoComentario, setGerandoComentario] = useState(false);
  
  const [faseLote, setFaseLote] = useState<'ocioso' | 'extraindo' | 'comentando' | 'finalizado'>('ocioso');
  const [progressoLote, setProgressoLote] = useState("");
  const [sucessoLote, setSucessoLote] = useState("");

  const [formData, setFormData] = useState({
    banca: 'FGV',
    orgao: '',
    cargo: '',
    tipo_questao: 'multipla_escolha',
    materia: '',
    topico: '',
    enunciado: '',
    alternativa_a: '',
    alternativa_b: '',
    alternativa_c: '',
    alternativa_d: '',
    alternativa_e: '',
    gabarito: 'A',
    comentario_gabarito: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTipoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const novoTipo = e.target.value;
    setFormData(prev => ({ 
      ...prev, 
      tipo_questao: novoTipo,
      gabarito: novoTipo === 'certo_errado' ? 'C' : 'A' 
    }));
  };

  const processarTextoBrutoUnico = async () => {
    if (!textoBruto.trim()) return;
    setSalvando(true);
    setErro("");

    try {
      const response = await fetch('/api/importar-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textoBruto })
      });

      // 🚀 VACINA APLICADA NA IMPORTAÇÃO ÚNICA
      const textResponse = await response.text();

      if (!response.ok) {
        let mensagemErro = `Erro ${response.status} no servidor.`;
        try {
          const errorJson = JSON.parse(textResponse);
          mensagemErro = errorJson.error || mensagemErro;
        } catch (e) {
          if (response.status === 504) {
            mensagemErro = "A inteligência artificial demorou muito para responder (Timeout). Tente novamente.";
          } else {
            mensagemErro = "O servidor retornou uma resposta inválida.";
          }
        }
        throw new Error(mensagemErro);
      }

      const data = JSON.parse(textResponse);

      if (!data.sucesso || !data.questoes?.length) {
        throw new Error(data.error || "A Inteligência Artificial não conseguiu fatiar este texto estruturado.");
      }

      const qIA = data.questoes[0];

      setFormData({
        banca: qIA.banca || 'FGV',
        orgao: qIA.orgao || '',
        cargo: qIA.cargo || '',
        tipo_questao: qIA.tipo_questao || 'multipla_escolha',
        materia: qIA.materia || '',
        topico: qIA.topico || '',
        enunciado: qIA.enunciado || '',
        alternativa_a: qIA.alternativa_a || '',
        alternativa_b: qIA.alternativa_b || '',
        alternativa_c: qIA.alternativa_c || '',
        alternativa_d: qIA.alternativa_d || '',
        alternativa_e: qIA.alternativa_e || '',
        gabarito: qIA.gabarito || 'A',
        comentario_gabarito: qIA.comentario_gabarito ? qIA.comentario_gabarito.replace(/<br\s*\/?>/gi, '\n') : ''
      });

      setModo('manual');
      setTextoBruto("");
    } catch (err: any) {
      console.error("Falha ao integrar IA:", err);
      setErro(err.message || "Conexão com o motor de inteligência artificial falhou.");
    } finally {
      setSalvando(false);
    }
  };

  const processarLoteIA = async () => {
    if (!textoBruto.trim()) return;
    
    setSalvando(true);
    setErro("");
    setFaseLote('extraindo');

    try {
      const blocosRaw = textoBruto.split(/(?=Questão\s+\d+)/i);
      const blocos = blocosRaw.flatMap(b => b.split(/-{3,}/)).map(b => b.trim()).filter(b => b !== "");

      const tamanhoDoLote = 5;
      const lotesTexto = [];

      for (let i = 0; i < blocos.length; i += tamanhoDoLote) {
        lotesTexto.push(blocos.slice(i, i + tamanhoDoLote).join("\n\n"));
      }

      let questoesSalvasTotais: any[] = [];

      for (let i = 0; i < lotesTexto.length; i++) {
        setProgressoLote(`Extraindo pacote ${i + 1} de ${lotesTexto.length}...`);

        const response = await fetch('/api/importar-lote-ia', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ textoBruto: lotesTexto[i] })
        });

        // 🚀 VACINA APLICADA NA IMPORTAÇÃO EM LOTE
        const textResponse = await response.text();

        if (!response.ok) {
          let mensagemErro = `Erro ${response.status} no servidor.`;
          try {
            const errorJson = JSON.parse(textResponse);
            mensagemErro = errorJson.error || mensagemErro;
          } catch (e) {
            if (response.status === 504) {
              mensagemErro = `O pacote ${i + 1} demorou muito para responder (Timeout da Vercel). Tente enviar as questões restantes em um novo lote.`;
            } else {
              mensagemErro = "O servidor retornou uma resposta inválida.";
            }
          }
          throw new Error(mensagemErro);
        }

        const data = JSON.parse(textResponse);

        if (!data.sucesso) {
          throw new Error(data.error || `A IA falhou ao processar o pacote ${i + 1}.`);
        }

        if (data.questoes_inseridas && data.questoes_inseridas.length > 0) {
          questoesSalvasTotais = [...questoesSalvasTotais, ...data.questoes_inseridas];
        }
      }

      if (questoesSalvasTotais.length === 0) {
        throw new Error("Nenhuma questão pôde ser extraída do texto.");
      }

      setFaseLote('comentando');
      setProgressoLote(`Gerando comentários cirúrgicos (0/${questoesSalvasTotais.length})...`);

      const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      for (let i = 0; i < questoesSalvasTotais.length; i++) {
        const q = questoesSalvasTotais[i];
        
        try {
          const resComentario = await fetch('/api/gerar-comentario', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              enunciado: q.enunciado,
              tipo_questao: q.tipo_questao,
              gabarito: q.gabarito,
              alternativas: { A: q.alternativa_a, B: q.alternativa_b, C: q.alternativa_c, D: q.alternativa_d, E: q.alternativa_e }
            })
          });
          
          const dataComentario = await resComentario.json();
          
          if (dataComentario.comentario) {
            await supabase.from('questoes').update({ comentario_gabarito: dataComentario.comentario }).eq('id', q.id);
          }
        } catch (e) {
          console.warn(`Aviso: Falha ao gerar comentário para questão ID ${q.id}`);
        }

        setProgressoLote(`Gerando comentários cirúrgicos (${i + 1}/${questoesSalvasTotais.length})...`);
        
        if (i < questoesSalvasTotais.length - 1) {
           await sleep(4500);
        }
      }

      setFaseLote('finalizado');
      setSucessoLote(`🎉 Trabalho concluído! ${questoesSalvasTotais.length} questões estruturadas.`);
      setTextoBruto("");
      
      setTimeout(() => {
        router.push('/admin/questoes');
        router.refresh();
      }, 3500);

    } catch (err: any) {
      console.error("Falha no lote:", err);
      setErro(err.message || "Erro inesperado ao processar o lote.");
      setFaseLote('ocioso');
    } finally {
      setSalvando(false);
    }
  };

  const gerarComentarioComIA = async () => {
    if (!formData.enunciado) {
      setErro("Preencha pelo menos o enunciado para gerar um comentário.");
      return;
    }
    
    setGerandoComentario(true);
    setErro("");

    try {
      const response = await fetch('/api/gerar-comentario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enunciado: formData.enunciado,
          tipo_questao: formData.tipo_questao,
          gabarito: formData.gabarito,
          alternativas: {
            A: formData.alternativa_a, B: formData.alternativa_b, C: formData.alternativa_c, D: formData.alternativa_d, E: formData.alternativa_e,
          }
        })
      });

      const data = await response.json();

      if (!response.ok || !data.comentario) {
        throw new Error(data.error || "Falha ao gerar o novo comentário.");
      }

      const comentarioLimpoParaEdicao = data.comentario.replace(/<br\s*\/?>/gi, '\n');
      setFormData(prev => ({ ...prev, comentario_gabarito: comentarioLimpoParaEdicao }));

    } catch (err: any) {
      console.error("Erro ao gerar comentário:", err);
      setErro(err.message || "Não foi possível gerar o comentário agora.");
    } finally {
      setGerandoComentario(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro("");

    if (!formData.banca || !formData.enunciado) {
      setErro("Preencha a banca e o enunciado da questão.");
      setSalvando(false);
      return;
    }

    if (formData.tipo_questao === 'multipla_escolha' && (!formData.alternativa_a || !formData.alternativa_b)) {
      setErro("Para múltipla escolha, preencha pelo menos as alternativas A e B.");
      setSalvando(false);
      return;
    }

    try {
      const comentarioProntoProBanco = formData.comentario_gabarito
        ? formData.comentario_gabarito.replace(/\n/g, '<br/>')
        : '';

      const insertData: any = {
        banca: formData.banca,
        orgao: formData.orgao, 
        cargo: formData.cargo, 
        tipo_questao: formData.tipo_questao,
        materia: formData.materia,
        topico: formData.topico,
        enunciado: formData.enunciado,
        gabarito: formData.gabarito,
        comentario_gabarito: comentarioProntoProBanco,
        alternativa_a: formData.tipo_questao === 'multipla_escolha' ? formData.alternativa_a : null,
        alternativa_b: formData.tipo_questao === 'multipla_escolha' ? formData.alternativa_b : null,
        alternativa_c: formData.tipo_questao === 'multipla_escolha' ? formData.alternativa_c : null,
        alternativa_d: formData.tipo_questao === 'multipla_escolha' ? formData.alternativa_d : null,
        alternativa_e: formData.tipo_questao === 'multipla_escolha' ? formData.alternativa_e : null,
      };

      const { error } = await supabase.from('questoes').insert([insertData]);
      if (error) throw error;

      router.push('/admin/questoes');
      router.refresh();

    } catch (err: any) {
      console.error("Erro ao salvar questão:", err);
      setErro(err.message || "Houve um erro ao salvar a questão no banco de dados.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/questoes" className="p-2 bg-white/5 hover:bg-white/10 text-zinc-400 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-white uppercase tracking-widest">
            Cadastrar Questões
          </h1>
        </div>
        
        {/* Menu de Abas */}
        <div className="flex bg-[#09090b] p-1 rounded-xl w-full sm:w-auto border border-white/5">
          <button 
            type="button" onClick={() => { setModo('manual'); setErro(""); }}
            className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-all uppercase tracking-widest flex items-center justify-center gap-2 ${modo === 'manual' ? "bg-white/10 text-white shadow-sm" : "text-zinc-600 hover:text-zinc-300"}`}
          >
            Formulário Manual
          </button>
          <button 
            type="button" onClick={() => { setModo('ia_unica'); setErro(""); setTextoBruto(""); }}
            className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-all uppercase tracking-widest flex items-center justify-center gap-2 ${modo === 'ia_unica' ? "bg-indigo-500/20 text-indigo-400 shadow-sm border border-indigo-500/30" : "text-zinc-600 hover:text-zinc-300"}`}
          >
            <Wand2 className="w-3.5 h-3.5" /> IA (Única)
          </button>
          <button 
            type="button" onClick={() => { setModo('ia_lote'); setErro(""); setTextoBruto(""); }}
            className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-all uppercase tracking-widest flex items-center justify-center gap-2 ${modo === 'ia_lote' ? "bg-emerald-500/20 text-emerald-400 shadow-sm border border-emerald-500/30" : "text-zinc-600 hover:text-zinc-300"}`}
          >
            <Layers className="w-3.5 h-3.5" /> IA (Lote)
          </button>
        </div>
      </div>

      {erro && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3 text-xs font-bold uppercase tracking-widest">
          <AlertCircle className="w-5 h-5 shrink-0" /> {erro}
        </div>
      )}

      {/* MODO 2: IMPORTAÇÃO ÚNICA */}
      {modo === 'ia_unica' && (
        <div className="bg-indigo-500/5 p-6 rounded-2xl border border-indigo-500/20 space-y-4 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3 text-indigo-400 mb-2">
            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400"><Wand2 className="w-5 h-5" /></div>
            <div>
              <h3 className="font-bold uppercase tracking-widest text-xs">Assistente de Importação Unitária</h3>
              <p className="text-xs text-indigo-400/60 mt-1">Cole o texto bruto de 1 questão.</p>
            </div>
          </div>
          <textarea value={textoBruto} onChange={(e) => setTextoBruto(e.target.value)} rows={6}
            placeholder="Cole o texto da questão aqui..."
            className="w-full text-sm bg-[#09090b] border border-indigo-500/30 text-zinc-200 rounded-lg px-4 py-3 focus:ring-1 focus:ring-indigo-500 outline-none transition-all resize-y"
          />
          <div className="flex justify-end">
            <button type="button" onClick={processarTextoBrutoUnico} disabled={!textoBruto.trim() || salvando}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest py-3 px-6 rounded-xl transition-all shadow-sm flex items-center gap-2">
              <RefreshCcw className={`w-4 h-4 ${salvando ? 'animate-spin' : ''}`} /> {salvando ? "A processar..." : "Preencher Formulário"}
            </button>
          </div>
        </div>
      )}

      {/* MODO 3: IMPORTAÇÃO EM LOTE */}
      {modo === 'ia_lote' && (
        <div className="bg-emerald-500/5 p-6 rounded-2xl border border-emerald-500/20 space-y-4 animate-in slide-in-from-top-2">
          {faseLote === 'finalizado' ? (
             <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-6 rounded-xl flex flex-col items-center text-center gap-3">
               <CheckCircle2 className="w-12 h-12 text-emerald-500" />
               <p className="font-bold">{sucessoLote}</p>
               <p className="text-xs">Redirecionando para o acervo...</p>
             </div>
          ) : faseLote === 'extraindo' || faseLote === 'comentando' ? (
             <div className="bg-[#09090b] border border-emerald-500/20 p-8 rounded-xl flex flex-col items-center text-center gap-4 shadow-sm">
               <RefreshCcw className="w-8 h-8 text-emerald-500 animate-spin" />
               <div className="space-y-1">
                 <p className="font-bold text-white text-lg">Processando...</p>
                 <p className="text-sm font-medium text-emerald-500">{progressoLote}</p>
               </div>
               <div className="w-full bg-white/5 rounded-full h-2 mt-2 overflow-hidden">
                 <div className={`h-2 bg-emerald-500 transition-all duration-500 ease-out ${faseLote === 'extraindo' ? 'w-1/4' : 'w-3/4 animate-pulse'}`}></div>
               </div>
             </div>
          ) : (
            <>
              <div className="flex items-center gap-3 text-emerald-400 mb-2">
                <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400"><Layers className="w-5 h-5" /></div>
                <div>
                  <h3 className="font-bold uppercase tracking-widest text-xs">Processamento em Lote (Massa)</h3>
                  <p className="text-xs text-emerald-400/60 mt-1">Cole as questões extraídas separadas pelos traços (-------).</p>
                </div>
              </div>
              <textarea value={textoBruto} onChange={(e) => setTextoBruto(e.target.value)} rows={12}
                placeholder="Cole as questões separadas pelos traços (-------) aqui..."
                className="w-full text-sm bg-[#09090b] border border-emerald-500/30 text-zinc-200 rounded-lg px-4 py-3 focus:ring-1 focus:ring-emerald-500 outline-none transition-all resize-y"
              />
              <div className="flex justify-end">
                <button type="button" onClick={processarLoteIA} disabled={!textoBruto.trim() || salvando}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-black text-xs font-black uppercase tracking-widest py-3 px-8 rounded-xl transition-all shadow-sm flex items-center gap-2">
                  <RefreshCcw className={`w-4 h-4 ${salvando ? 'animate-spin' : ''}`} /> {salvando ? "A iniciar automação..." : "Extrair e Salvar Tudo"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Formulário Principal */}
      {(modo === 'manual' || modo === 'ia_unica') && (
        <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in duration-500">
          
          {/* BLOCO 1: Classificação */}
          <div className="bg-[#131c2f]/30 p-6 rounded-2xl border border-white/5 space-y-5">
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-3">
              <BookOpen className="w-4 h-4" /> Classificação
            </h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Banca</label>
                  <input type="text" name="banca" value={formData.banca} onChange={handleChange} required
                    className="w-full text-sm bg-[#09090b] border border-white/10 text-white rounded-lg px-3 py-2.5 focus:border-blue-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Órgão</label>
                  <input type="text" name="orgao" value={formData.orgao} onChange={handleChange} placeholder="Ex: TJ-SP, TRT-2"
                    className="w-full text-sm bg-[#09090b] border border-white/10 text-white rounded-lg px-3 py-2.5 focus:border-blue-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Cargo</label>
                  <input type="text" name="cargo" value={formData.cargo} onChange={handleChange} placeholder="Ex: Analista Judiciário"
                    className="w-full text-sm bg-[#09090b] border border-white/10 text-white rounded-lg px-3 py-2.5 focus:border-blue-500 outline-none transition-all" />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Tipo</label>
                  <div className="relative">
                    <select name="tipo_questao" value={formData.tipo_questao} onChange={handleTipoChange} required
                      className="w-full text-sm bg-[#09090b] border border-white/10 text-white rounded-lg px-3 py-2.5 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer">
                      <option value="multipla_escolha">Múltipla Escolha</option>
                      <option value="certo_errado">Certo ou Errado</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 text-xs">▼</div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Matéria</label>
                  <input type="text" name="materia" value={formData.materia} onChange={handleChange} required
                    className="w-full text-sm bg-[#09090b] border border-white/10 text-white rounded-lg px-3 py-2.5 focus:border-blue-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Tópico</label>
                  <input type="text" name="topico" value={formData.topico} onChange={handleChange} required
                    className="w-full text-sm bg-[#09090b] border border-white/10 text-white rounded-lg px-3 py-2.5 focus:border-blue-500 outline-none transition-all" />
                </div>
              </div>
            </div>
          </div>

          {/* BLOCO 2: Enunciado e Alternativas */}
          <div className="bg-[#131c2f]/30 p-6 rounded-2xl border border-white/5 space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Enunciado / Texto Base</label>
              <textarea name="enunciado" value={formData.enunciado} onChange={handleChange} rows={5} required
                className="w-full text-sm bg-[#09090b] border border-white/10 text-zinc-200 rounded-lg px-4 py-3 focus:border-blue-500 outline-none transition-all resize-y" />
            </div>

            {formData.tipo_questao === 'multipla_escolha' ? (
              <div className="space-y-3 pt-4 border-t border-white/5">
                <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400">Alternativas</label>
                {['a', 'b', 'c', 'd', 'e'].map((letra) => (
                  <div key={letra} className="flex gap-3 items-start">
                    <span className="w-8 h-8 shrink-0 bg-white/5 border border-white/10 text-zinc-400 text-xs font-bold rounded flex items-center justify-center uppercase mt-1">{letra}</span>
                    <textarea name={`alternativa_${letra}`} value={(formData as any)[`alternativa_${letra}`]} onChange={handleChange} rows={2} required={letra === 'a' || letra === 'b'}
                      className="w-full text-sm bg-[#09090b] border border-white/10 text-zinc-200 rounded-lg px-4 py-2 focus:border-blue-500 outline-none transition-all resize-y" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="pt-4 border-t border-white/5">
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                  <Info className="w-5 h-5 text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-500/80 leading-relaxed uppercase tracking-widest">
                    Questões do tipo <strong className="font-bold text-amber-400">Certo ou Errado</strong> não possuem textos de alternativas.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* BLOCO 3: Gabarito e Comentários */}
          <div className="bg-[#131c2f]/30 p-6 rounded-2xl border border-white/5 space-y-5">
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Resolução
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-1">
                <label className="block text-xs font-bold uppercase tracking-widest text-emerald-500 mb-2">Gabarito Correto</label>
                <div className="relative">
                  <select name="gabarito" value={formData.gabarito} onChange={handleChange}
                    className="w-full text-sm bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold rounded-lg px-3 py-2.5 focus:border-emerald-500 outline-none transition-all appearance-none cursor-pointer">
                    {formData.tipo_questao === 'multipla_escolha' ? (
                      <>
                        <option value="A" className="bg-[#09090b]">Letra A</option>
                        <option value="B" className="bg-[#09090b]">Letra B</option>
                        <option value="C" className="bg-[#09090b]">Letra C</option>
                        <option value="D" className="bg-[#09090b]">Letra D</option>
                        <option value="E" className="bg-[#09090b]">Letra E</option>
                      </>
                    ) : (
                      <>
                        <option value="C" className="bg-[#09090b]">C (Certo)</option>
                        <option value="E" className="bg-[#09090b]">E (Errado)</option>
                      </>
                    )}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-500 text-xs">▼</div>
                </div>
              </div>

              <div className="md:col-span-3">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400">Comentário do Professor</label>
                  <button type="button" onClick={gerarComentarioComIA} disabled={gerandoComentario}
                    className="text-[10px] flex items-center gap-1.5 font-bold uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50 bg-indigo-500/10 px-3 py-1.5 rounded-md border border-indigo-500/20">
                    <Wand2 className={`w-3 h-3 ${gerandoComentario ? 'animate-pulse' : ''}`} /> {gerandoComentario ? "Gerando IA..." : "Refazer com IA"}
                  </button>
                </div>
                <textarea name="comentario_gabarito" value={formData.comentario_gabarito} onChange={handleChange} rows={5}
                  className="w-full text-sm bg-[#09090b] border border-white/10 text-zinc-200 rounded-lg px-4 py-3 focus:border-blue-500 outline-none transition-all resize-y" />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Link href="/admin/questoes" className="px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-zinc-500 hover:bg-white/5 hover:text-white transition-all">
              Cancelar
            </Link>
            <button type="submit" disabled={salvando} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest py-3 px-8 rounded-xl transition-all flex items-center gap-2">
              {salvando ? <span className="animate-pulse">Salvando...</span> : <><Save className="w-4 h-4" /> Salvar Questão</>}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}