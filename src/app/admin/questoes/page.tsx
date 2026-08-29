"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Search, Edit, Trash2, Database, BookOpen, AlertCircle, Filter, Wand2, RefreshCcw } from 'lucide-react';
import Link from 'next/link';

export default function BancoDeQuestoesAdmin() {
  const [questoes, setQuestoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroTopico, setFiltroTopico] = useState("Todos");

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
        .order('id', { ascending: false }); // Usando ID temporariamente caso não tenha criado_em

      if (error) throw error;
      setQuestoes(data || []);
    } catch (error: any) {
      console.error("Erro interno ao carregar questões:", error);
    } finally {
      setLoading(false);
    }
  }

  async function gerarComentariosEmLote() {
    const pendentes = questoes.filter(q => !q.comentario_gabarito || q.comentario_gabarito === "Gerando comentário..." || q.comentario_gabarito === "");
    
    if (pendentes.length === 0) {
      alert("Todas as questões já possuem comentários gerados!");
      return;
    }

    if (!confirm(`Deseja iniciar a geração de comentários para ${pendentes.length} questões pendentes? O processo será feito de forma segura e progressiva.`)) return;

    setGerandoLote(true);
    let processadas = 0;

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      for (const q of pendentes) {
        processadas++;
        setProgressoLote(`Processando (${processadas}/${pendentes.length})...`);

        try {
          const res = await fetch('/api/gerar-comentario', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              enunciado: q.enunciado,
              tipo_questao: q.tipo_questao,
              gabarito: q.gabarito,
              alternativas: { A: q.alternativa_a, B: q.alternativa_b, C: q.alternativa_c, D: q.alternativa_d, E: q.alternativa_e }
            })
          });

          const data = await res.json();
          
          if (res.ok && data.comentario) {
            const { data: updatedData, error: updateError } = await supabase
              .from('questoes')
              .update({ comentario_gabarito: data.comentario })
              .eq('id', q.id)
              .select(); 

            if (updateError) {
              console.error(`Erro RLS/Supabase na questão ${q.id}:`, updateError);
              throw updateError;
            }
            
            if (!updatedData || updatedData.length === 0) {
              console.error(`O RLS bloqueou o update da questão ${q.id} silenciosamente.`);
            }

          } else {
            console.warn(`Aviso na questão ${q.id}:`, data.error || "Sem comentário gerado.");
          }
        } catch (err) {
          console.error(`Falha ao processar/salvar a questão ${q.id}:`, err);
        }

        await sleep(5000);
      }

      alert("🎉 Processo finalizado!");
      carregarQuestoes(); 
    } catch (err: any) {
      alert("Erro ao processar lote: " + err.message);
    } finally {
      setGerandoLote(false);
      setProgressoLote("");
    }
  }

  async function excluirQuestao(id: string) {
    if (!confirm("Tem certeza absoluta que deseja remover esta questão permanentemente do acervo?")) return;

    try {
      const { error } = await supabase.from('questoes').delete().eq('id', id);
      if (error) throw error;
      setQuestoes(prev => prev.filter(q => q.id !== id));
    } catch (error: any) {
      alert("Não foi possível excluir a questão: " + error.message);
    }
  }

  const topicosUnicos = Array.from(new Set(questoes.map(q => q.topico).filter(Boolean))).sort();

  const questoesFiltradas = questoes.filter(q => {
    const matchBusca = (q.materia || "").toLowerCase().includes(busca.toLowerCase()) ||
                       (q.topico || "").toLowerCase().includes(busca.toLowerCase()) ||
                       (q.enunciado || "").toLowerCase().includes(busca.toLowerCase());
    const matchTopico = filtroTopico === "Todos" || q.topico === filtroTopico;
    return matchBusca && matchTopico;
  });

  return (
    <div className="min-h-screen bg-[#09090b] text-[#e4e4e7] font-sans pb-20">
      <div className="max-w-7xl mx-auto px-6 pt-12 space-y-6 animate-in fade-in duration-500">
        
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <h1 className="text-3xl font-serif italic text-white flex items-center gap-2 uppercase">
              <Database className="w-8 h-8 text-emerald-500" /> Gestão do Acervo
            </h1>
            <p className="text-zinc-400 mt-2 text-sm">
              Gerencie questões, simulados e lotes de IA. Total de {questoes.length} questões carregadas.
            </p>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            <button 
              onClick={gerarComentariosEmLote}
              disabled={gerandoLote}
              className="bg-[#131c2f]/80 hover:bg-[#131c2f] border border-blue-500/30 text-blue-400 disabled:opacity-50 font-bold py-3 px-5 rounded-xl transition-all flex items-center gap-2 text-xs uppercase tracking-widest"
            >
              {gerandoLote ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              {gerandoLote ? progressoLote : "Gerar Comentários (IA)"}
            </button>

            <Link 
              href="/admin/questoes/nova" 
              className="bg-emerald-600 hover:bg-emerald-500 text-black font-black py-3 px-6 rounded-xl transition-all flex items-center gap-2 text-xs uppercase tracking-widest"
            >
              <Plus className="w-4 h-4" /> Nova Questão
            </Link>
          </div>
        </div>

        {/* ÁREA DE FILTROS */}
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
              <option value="Todos" className="bg-[#09090b]">Todos os Tópicos</option>
              {topicosUnicos.map(topico => (
                <option key={topico as string} value={topico as string} className="bg-[#09090b]">{topico as string}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabela de Questões */}
        <div className="bg-[#131c2f]/30 rounded-2xl border border-white/5 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-zinc-500 font-medium animate-pulse">Carregando acervo...</div>
          ) : questoesFiltradas.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-zinc-500 text-center">
              <AlertCircle className="w-12 h-12 mb-3 text-zinc-600" />
              <p className="font-medium text-sm">Nenhuma questão passou nos filtros aplicados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-zinc-400">
                <thead className="bg-black/20 border-b border-white/5 text-xs uppercase font-bold tracking-widest text-zinc-500">
                  <tr>
                    <th className="px-6 py-4">Matéria / Tópico</th>
                    <th className="px-6 py-4">Prévia do Enunciado</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {questoesFiltradas.map((questao) => (
                    <tr key={questao.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 align-top w-1/4">
                        <div className="flex flex-col gap-2">
                          <span className="font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-md text-[10px] uppercase tracking-widest inline-block w-fit">
                            {questao.materia || "Sem Matéria"}
                          </span>
                          <span className="text-zinc-500 text-xs font-medium flex items-center gap-1.5">
                            <BookOpen className="w-3 h-3 shrink-0" /> {questao.topico || "Sem Tópico"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top w-2/4">
                        <div className="text-zinc-300 line-clamp-2 leading-relaxed">
                          {questao.enunciado ? questao.enunciado.replace(/<[^>]+>/g, '') : "Enunciado vazio"}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top w-1/4 text-right">
                        <div className="flex justify-end gap-2">
                          <Link 
                            href={`/admin/questoes/editar/${questao.id}`}
                            className="p-2 text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors inline-block" 
                            title="Editar Questão"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          <button 
                            onClick={() => excluirQuestao(questao.id)}
                            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" 
                            title="Excluir Questão"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="bg-black/20 border-t border-white/5 p-4 text-right text-[10px] uppercase tracking-widest font-bold text-zinc-500">
                Mostrando {questoesFiltradas.length} {questoesFiltradas.length === 1 ? 'questão' : 'questões'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}