"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Search, Edit, Trash2, FileText, CheckCircle2, Clock, AlertCircle, Layers, Printer } from 'lucide-react';
import Link from 'next/link';

export default function GestaoSimuladosAdmin() {
  const [simulados, setSimulados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "ciclo" | "revisao">("todos");

  useEffect(() => {
    carregarSimulados();
  }, []);

  async function carregarSimulados() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('simulados')
        .select('*')
        .in('tipo', ['ciclo', 'revisao'])
        .order('criado_em', { ascending: false });

      if (error) throw error;
      setSimulados(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar simulados:", error);
    } finally {
      setLoading(false);
    }
  }

  async function excluirSimulado(id: string) {
    if (!confirm("Tem certeza que deseja excluir este simulado? Os alunos não poderão mais acessá-lo.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from('simulados')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setSimulados(prev => prev.filter(s => s.id !== id));
    } catch (error: any) {
      alert("Erro ao excluir: " + error.message);
    }
  }

  const simuladosFiltrados = simulados.filter(s => {
    const matchBusca = (s.titulo || "").toLowerCase().includes(busca.toLowerCase()) ||
                       (s.descricao || "").toLowerCase().includes(busca.toLowerCase());
    const matchTipo = filtroTipo === "todos" ? true : s.tipo === filtroTipo;
    
    return matchBusca && matchTipo;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div>
          <h1 className="text-3xl font-serif italic text-white flex items-center gap-2 uppercase">
            <FileText className="w-8 h-8 text-emerald-500" /> Gestão de Simulados
          </h1>
          <p className="text-zinc-400 mt-2 text-sm">
            Crie cadernos de prova e gerencie o que está visível para seus alunos.
          </p>
        </div>
        
        <Link 
          href="/admin/simulados/novo" 
          className="bg-emerald-600 hover:bg-emerald-500 text-black font-black py-3 px-6 rounded-xl transition-all flex items-center gap-2 text-xs uppercase tracking-widest shadow-sm"
        >
          <Plus className="w-4 h-4" /> Novo Simulado
        </Link>
      </div>

      <Link 
        href="/admin/auditoria" 
        className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 text-amber-400 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all w-fit"
      >
        <AlertCircle className="w-4 h-4" /> Auditoria de Questões
      </Link>

      {/* Controles de Filtro e Busca */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        
        <div className="flex bg-[#09090b] p-1 rounded-xl w-full md:w-auto border border-white/5">
          <button 
            onClick={() => setFiltroTipo("todos")}
            className={`flex-1 md:flex-none px-6 py-2.5 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${filtroTipo === "todos" ? "bg-white/10 text-white shadow-sm" : "text-zinc-600 hover:text-zinc-300"}`}
          >
            Todos
          </button>
          <button 
            onClick={() => setFiltroTipo("ciclo")}
            className={`flex-1 md:flex-none px-6 py-2.5 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${filtroTipo === "ciclo" ? "bg-blue-500/20 text-blue-400 shadow-sm border border-blue-500/30" : "text-zinc-600 hover:text-zinc-300"}`}
          >
            Ciclos
          </button>
          <button 
            onClick={() => setFiltroTipo("revisao")}
            className={`flex-1 md:flex-none px-6 py-2.5 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${filtroTipo === "revisao" ? "bg-orange-500/20 text-orange-400 shadow-sm border border-orange-500/30" : "text-zinc-600 hover:text-zinc-300"}`}
          >
            Revisão
          </button>
        </div>

        {/* Barra de Pesquisa */}
        <div className="bg-[#131c2f]/30 rounded-xl border border-white/5 flex items-center gap-3 w-full md:w-96 px-4 py-2">
          <Search className="w-5 h-5 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Buscar pelo título..." 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-transparent border-none text-zinc-200 text-sm focus:ring-0 outline-none placeholder:text-zinc-600 py-2"
          />
        </div>

      </div>

      {/* Lista de Simulados */}
      <div className="bg-[#131c2f]/30 rounded-2xl border border-white/5 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-zinc-500 font-medium animate-pulse uppercase tracking-widest text-xs">
            Carregando seus cadernos de prova...
          </div>
        ) : simuladosFiltrados.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-zinc-500 text-center">
            <AlertCircle className="w-12 h-12 mb-3 text-zinc-600" />
            <p className="font-bold text-sm uppercase tracking-widest text-zinc-400">Nenhum simulado encontrado.</p>
            <p className="text-xs mt-2">Ajuste os filtros ou crie uma nova prova.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-400">
              <thead className="bg-black/20 border-b border-white/5 text-xs uppercase font-bold tracking-widest text-zinc-500">
                <tr>
                  <th className="px-6 py-4">Caderno de Prova</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {simuladosFiltrados.map((simulado) => (
                  <tr key={simulado.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 align-middle">
                      <div className="flex flex-col gap-2">
                        
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-white text-base">
                            {simulado.titulo || "Simulado sem título"}
                          </span>
                          
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${
                            simulado.tipo === 'ciclo' 
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                              : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                          }`}>
                            <Layers className="w-3 h-3" />
                            {simulado.tipo}
                          </span>
                        </div>
                        
                        <span className="text-zinc-500 text-xs font-medium">
                          {simulado.descricao || "Sem descrição"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle text-center">
                      {simulado.visivel === true ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] uppercase tracking-widest font-bold border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Público
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] uppercase tracking-widest font-bold border border-amber-500/20">
                          <Clock className="w-3.5 h-3.5" /> Rascunho
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 align-middle text-right">
                      <div className="flex justify-end gap-2">
                        
                        <Link 
                          href={`/admin/simulados/imprimir/${simulado.id}`}
                          target="_blank"
                          className="p-2 text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors inline-block" 
                          title="Visualizar / Imprimir Simulado"
                        >
                          <Printer className="w-4 h-4" />
                        </Link>

                        <Link 
                          href={`/admin/simulados/editar/${simulado.id}`}
                          className="p-2 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors inline-block" 
                          title="Gerenciar Questões / Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        
                        <button 
                          onClick={() => excluirSimulado(simulado.id)}
                          className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" 
                          title="Excluir Simulado"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}