"use client";
import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Save, BookOpen, AlertCircle, CheckCircle2, Wand2, Info } from 'lucide-react';
import Link from 'next/link';

export default function EditarQuestaoAdmin() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [gerandoComentario, setGerandoComentario] = useState(false);
  const [erro, setErro] = useState("");

  // 🚀 ADICIONADO ORGÃO E CARGO AQUI
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

  useEffect(() => {
    async function buscarQuestao() {
      if (!id) return;
      try {
        const { data, error } = await supabase.from('questoes').select('*').eq('id', id).single();
        if (error) throw error;
        if (data) {
          setFormData({
            banca: data.banca || 'FGV',
            orgao: data.orgao || '', // 🚀 PUXA DO BANCO
            cargo: data.cargo || '', // 🚀 PUXA DO BANCO
            tipo_questao: data.tipo_questao || 'multipla_escolha',
            materia: data.materia || '',
            topico: data.topico || '',
            enunciado: data.enunciado || '',
            alternativa_a: data.alternativa_a || '',
            alternativa_b: data.alternativa_b || '',
            alternativa_c: data.alternativa_c || '',
            alternativa_d: data.alternativa_d || '',
            alternativa_e: data.alternativa_e || '',
            gabarito: data.gabarito || 'A',
            comentario_gabarito: data.comentario_gabarito ? data.comentario_gabarito.replace(/<br\s*\/?>/gi, '\n') : ''
          });
        }
      } catch (err: any) {
        setErro("Erro ao carregar os dados da questão: " + err.message);
      } finally {
        setLoading(false);
      }
    }
    buscarQuestao();
  }, [id]);

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
          alternativas: { A: formData.alternativa_a, B: formData.alternativa_b, C: formData.alternativa_c, D: formData.alternativa_d, E: formData.alternativa_e }
        })
      });

      const data = await response.json();
      if (!response.ok || !data.comentario) throw new Error(data.error || "Falha ao gerar o novo comentário.");

      const comentarioLimpoParaEdicao = data.comentario.replace(/<br\s*\/?>/gi, '\n');
      setFormData(prev => ({ ...prev, comentario_gabarito: comentarioLimpoParaEdicao }));
      alert("✅ Comentário gerado com sucesso! Não esqueça de clicar em 'Atualizar Questão' no final da página para salvar no banco.");
    } catch (err: any) {
      setErro(err.message || "Não foi possível gerar o comentário agora.");
    } finally {
      setGerandoComentario(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro("");

    try {
      const comentarioProntoProBanco = formData.comentario_gabarito ? formData.comentario_gabarito.replace(/\n/g, '<br/>') : '';

      const updateData: any = {
        banca: formData.banca,
        orgao: formData.orgao, // 🚀 SALVA NO BANCO
        cargo: formData.cargo, // 🚀 SALVA NO BANCO
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

      const { error } = await supabase.from('questoes').update(updateData).eq('id', id);
      if (error) throw error;

      router.push('/admin/questoes');
      router.refresh();
    } catch (err: any) {
      setErro(err.message || "Houve um erro ao atualizar a questão.");
    } finally {
      setSalvando(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-zinc-500 font-medium animate-pulse uppercase tracking-widest text-xs">Carregando dados da questão...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 border-b border-white/5 pb-4">
        <Link href="/admin/questoes" className="p-2 bg-white/5 hover:bg-white/10 text-zinc-400 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-white uppercase tracking-widest">
          Editar Questão do Acervo
        </h1>
      </div>

      {erro && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3 text-xs font-bold uppercase tracking-widest">
          <AlertCircle className="w-5 h-5 shrink-0" /> {erro}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* BLOCO 1: Classificação */}
        <div className="bg-[#131c2f]/30 p-6 rounded-2xl border border-white/5 space-y-5">
          <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-3">
            <BookOpen className="w-4 h-4" /> Classificação
          </h2>
          
          {/* 🚀 NOVA GRADE COM ÓRGÃO E CARGO AQUI */}
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
                  Questões do tipo <strong className="font-bold text-amber-400">Certo ou Errado</strong> não possuem alternativas.
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
            {salvando ? <span className="animate-pulse">Salvando...</span> : <><Save className="w-4 h-4" /> Atualizar Questão</>}
          </button>
        </div>
      </form>
    </div>
  );
}