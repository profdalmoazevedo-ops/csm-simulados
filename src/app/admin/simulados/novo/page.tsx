"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Save, FileText, Settings, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function NovoSimuladoAdmin() {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  // Estado limpo, mantendo apenas o necessário para a nova arquitetura
  const [formData, setFormData] = useState({
    titulo: '',
    disciplina_foco: '',
    visivel: false,
    regra_subtracao: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro("");

    if (!formData.titulo) {
      setErro("O título do simulado é obrigatório.");
      setSalvando(false);
      return;
    }

    try {
      // Montagem enxuta do payload de inserção
      const insertData = {
        titulo: formData.titulo,
        disciplina_foco: formData.disciplina_foco,
        tipo: 'simulado_tematico', // Padrão fixo conforme solicitado
        visivel: formData.visivel,
        regra_subtracao: formData.regra_subtracao,
        criado_em: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('simulados')
        .insert([insertData])
        .select('id')
        .single();

      if (error) throw error;

      // Redireciona para a página de edição (onde as questões serão inseridas)
      router.push(`/admin/simulados/editar/${data.id}`);
      router.refresh();

    } catch (err: any) {
      console.error("Erro ao criar simulado:", err);
      setErro(err.message || "Houve um erro ao criar a base do simulado no banco de dados.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 border-b border-white/5 pb-4">
        <Link href="/admin/simulados" className="p-2 bg-white/5 hover:bg-white/10 text-zinc-400 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white uppercase tracking-widest">
            Criar Simulado Temático
          </h1>
          <p className="text-xs text-zinc-500 mt-1 uppercase tracking-widest">
            Defina as configurações básicas. Você adicionará as questões na próxima etapa.
          </p>
        </div>
      </div>

      {erro && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3 text-xs font-bold uppercase tracking-widest">
          <AlertCircle className="w-5 h-5 shrink-0" /> {erro}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* BLOCO 1: Informações Básicas */}
        <div className="bg-[#131c2f]/30 p-6 rounded-2xl border border-white/5 space-y-5">
          <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-3">
            <FileText className="w-4 h-4" /> Informações Básicas
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-12">
              <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">
                Título do Simulado
              </label>
              <input 
                type="text" 
                name="titulo" 
                value={formData.titulo} 
                onChange={handleChange} 
                placeholder="Ex: Simulado IBFC - Raciocínio Lógico" 
                required
                className="w-full text-sm bg-[#09090b] border border-white/10 text-white rounded-lg px-4 py-3 focus:border-emerald-500 outline-none transition-all placeholder:text-zinc-700" 
              />
            </div>

            <div className="md:col-span-12">
              <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">
                Disciplina Foco <span className="text-zinc-600">(Opcional)</span>
              </label>
              <input 
                type="text" 
                name="disciplina_foco" 
                value={formData.disciplina_foco} 
                onChange={handleChange} 
                placeholder="Ex: Raciocínio Lógico Matemático"
                className="w-full text-sm bg-[#09090b] border border-white/10 text-white rounded-lg px-4 py-3 focus:border-emerald-500 outline-none transition-all placeholder:text-zinc-700" 
              />
            </div>
          </div>
        </div>

        {/* BLOCO 2: Regras e Permissões */}
        <div className="bg-[#131c2f]/30 p-6 rounded-2xl border border-white/5 space-y-5">
          <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-3">
            <Settings className="w-4 h-4" /> Acesso e Regras
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
              <input 
                type="checkbox" 
                name="visivel" 
                checked={formData.visivel} 
                onChange={handleChange} 
                className="w-5 h-5 accent-emerald-500 cursor-pointer" 
              />
              <div>
                <p className="text-sm font-bold text-white uppercase tracking-widest">Tornar Visível</p>
                <p className="text-xs text-zinc-500 mt-1">Exibir este simulado para os alunos</p>
              </div>
            </label>

            <label className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
              <input 
                type="checkbox" 
                name="regra_subtracao" 
                checked={formData.regra_subtracao} 
                onChange={handleChange} 
                className="w-5 h-5 accent-emerald-500 cursor-pointer" 
              />
              <div>
                <p className="text-sm font-bold text-white uppercase tracking-widest">Regra Cebraspe</p>
                <p className="text-xs text-zinc-500 mt-1">Um erro elimina um acerto na nota final</p>
              </div>
            </label>
          </div>
        </div>

        {/* AÇÕES */}
        <div className="flex justify-end gap-3 pt-4">
          <Link href="/admin/simulados" className="px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-zinc-500 hover:bg-white/5 hover:text-white transition-all">
            Cancelar
          </Link>
          <button 
            type="submit" 
            disabled={salvando} 
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest py-3 px-8 rounded-xl transition-all flex items-center gap-2 shadow-sm"
          >
            {salvando ? (
              <span className="animate-pulse">Criando Caderno...</span>
            ) : (
              <><Save className="w-4 h-4" /> Criar Simulado e Avançar</>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}