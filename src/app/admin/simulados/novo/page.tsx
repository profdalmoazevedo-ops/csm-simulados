"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Save, FileText, Calendar, Settings, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function NovoSimuladoAdmin() {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const [formData, setFormData] = useState({
    titulo: '',
    disciplina_foco: '',
    ciclo_numero: 1, 
    ciclo_nome: '',
    numero_semana: 1,
    tipo: 'ciclo', 
    visivel: false,
    e_gratis: false,
    regra_subtracao: false,
    data_liberacao: '',
    data_liberacao_mentoria: '',
    data_liberacao_caderno: '',
    pdf_url: '',
    url_mentoria_cirurgica: '',
    url_caderno_sobrevivencia: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as any;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
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
      const isCiclo = formData.tipo === 'ciclo';

      const insertData = {
        titulo: formData.titulo,
        disciplina_foco: formData.disciplina_foco,
        ciclo_numero: Number(formData.ciclo_numero), 
        ciclo_nome: formData.ciclo_nome,
        numero_semana: Number(formData.numero_semana),
        tipo: formData.tipo,
        visivel: formData.visivel,
        e_gratis: formData.e_gratis,
        regra_subtracao: formData.regra_subtracao,
        data_liberacao: formData.data_liberacao ? new Date(formData.data_liberacao).toISOString() : null,
        data_liberacao_mentoria: isCiclo && formData.data_liberacao_mentoria ? new Date(formData.data_liberacao_mentoria).toISOString() : null,
        data_liberacao_caderno: isCiclo && formData.data_liberacao_caderno ? new Date(formData.data_liberacao_caderno).toISOString() : null,
        pdf_url: null,
        url_mentoria_cirurgica: null,
        url_caderno_sobrevivencia: null,
        criado_em: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('simulados')
        .insert([insertData])
        .select('id')
        .single();

      if (error) throw error;

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
            Criar Novo Caderno de Prova
          </h1>
          <p className="text-xs text-zinc-500 mt-1 uppercase tracking-widest">
            Defina as configurações. Você adicionará as questões na próxima etapa.
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
              <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Título do Simulado</label>
              <input type="text" name="titulo" value={formData.titulo} onChange={handleChange} placeholder="Ex: Semana 1: Responsabilidade Civil do Estado" required
                className="w-full text-sm bg-[#09090b] border border-white/10 text-white rounded-lg px-4 py-3 focus:border-emerald-500 outline-none transition-all placeholder:text-zinc-700" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Nº do Ciclo</label>
              <input type="number" name="ciclo_numero" value={formData.ciclo_numero} onChange={handleChange} min="1" required
                className="w-full text-sm bg-[#09090b] border border-white/10 text-white rounded-lg px-4 py-3 focus:border-emerald-500 outline-none transition-all" />
            </div>

            <div className="md:col-span-6">
              <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Nome do Ciclo</label>
              <input type="text" name="ciclo_nome" value={formData.ciclo_nome} onChange={handleChange} placeholder="Ex: Fundação Estratégica"
                className="w-full text-sm bg-[#09090b] border border-white/10 text-white rounded-lg px-4 py-3 focus:border-emerald-500 outline-none transition-all placeholder:text-zinc-700" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Semana</label>
              <input type="number" name="numero_semana" value={formData.numero_semana} onChange={handleChange} min="1" required
                className="w-full text-sm bg-[#09090b] border border-white/10 text-white rounded-lg px-4 py-3 focus:border-emerald-500 outline-none transition-all" />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Tipo</label>
              <div className="relative">
                <select name="tipo" value={formData.tipo} onChange={handleChange}
                  className="w-full text-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold rounded-lg px-4 py-3 focus:border-emerald-500 outline-none transition-all appearance-none cursor-pointer">
                  <option value="ciclo" className="bg-[#09090b]">Ciclo</option>
                  <option value="revisao" className="bg-[#09090b]">Revisão</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-500 text-xs">▼</div>
              </div>
            </div>

            <div className="md:col-span-12">
              <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Disciplina Foco</label>
              <input type="text" name="disciplina_foco" value={formData.disciplina_foco} onChange={handleChange} placeholder="Ex: Direito Administrativo"
                className="w-full text-sm bg-[#09090b] border border-white/10 text-white rounded-lg px-4 py-3 focus:border-emerald-500 outline-none transition-all placeholder:text-zinc-700" />
            </div>

          </div>
        </div>

        {/* BLOCO 2: Regras e Permissões */}
        <div className="bg-[#131c2f]/30 p-6 rounded-2xl border border-white/5 space-y-5">
          <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-3">
            <Settings className="w-4 h-4" /> Acesso e Regras
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <label className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
              <input type="checkbox" name="visivel" checked={formData.visivel} onChange={handleChange} className="w-5 h-5 accent-emerald-500 cursor-pointer" />
              <div>
                <p className="text-sm font-bold text-white uppercase tracking-widest">Tornar Visível</p>
                <p className="text-xs text-zinc-500 mt-1">Exibir para os alunos</p>
              </div>
            </label>

            <label className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
              <input type="checkbox" name="e_gratis" checked={formData.e_gratis} onChange={handleChange} className="w-5 h-5 accent-emerald-500 cursor-pointer" />
              <div>
                <p className="text-sm font-bold text-white uppercase tracking-widest">Simulado Gratuito</p>
                <p className="text-xs text-zinc-500 mt-1">Isca de captação (Aberto)</p>
              </div>
            </label>

            <label className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
              <input type="checkbox" name="regra_subtracao" checked={formData.regra_subtracao} onChange={handleChange} className="w-5 h-5 accent-red-500 cursor-pointer" />
              <div>
                <p className="text-sm font-bold text-white uppercase tracking-widest">Regra Cebraspe</p>
                <p className="text-xs text-zinc-500 mt-1">Uma errada anula certa</p>
              </div>
            </label>

          </div>
        </div>

        {/* BLOCO 3: Cronograma de Liberação */}
        <div className="bg-[#131c2f]/30 p-6 rounded-2xl border border-white/5 space-y-5">
          <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-3">
            <Calendar className="w-4 h-4" /> Cronograma de Liberação
          </h2>
          
          <div className={`grid grid-cols-1 ${formData.tipo === 'ciclo' ? 'md:grid-cols-3' : 'max-w-xs'} gap-4`}>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2" style={{ colorScheme: 'dark' }}>
                {formData.tipo === 'ciclo' ? 'Data da Prova (Lançamento)' : 'Data da Revisão'}
              </label>
              <input type="datetime-local" name="data_liberacao" value={formData.data_liberacao} onChange={handleChange} required
                className="w-full text-sm bg-[#09090b] border border-white/10 text-white rounded-lg px-4 py-3 focus:border-emerald-500 outline-none transition-all" />
            </div>
            
            {formData.tipo === 'ciclo' && (
              <>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2" style={{ colorScheme: 'dark' }}>Liberação Mentoria</label>
                  <input type="datetime-local" name="data_liberacao_mentoria" value={formData.data_liberacao_mentoria} onChange={handleChange}
                    className="w-full text-sm bg-[#09090b] border border-white/10 text-white rounded-lg px-4 py-3 focus:border-emerald-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2" style={{ colorScheme: 'dark' }}>Liberação Caderno (PDF)</label>
                  <input type="datetime-local" name="data_liberacao_caderno" value={formData.data_liberacao_caderno} onChange={handleChange}
                    className="w-full text-sm bg-[#09090b] border border-white/10 text-white rounded-lg px-4 py-3 focus:border-emerald-500 outline-none transition-all" />
                </div>
              </>
            )}
          </div>
        </div>

        {/* AÇÕES */}
        <div className="flex justify-end gap-3 pt-4">
          <Link href="/admin/simulados" className="px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-zinc-500 hover:bg-white/5 hover:text-white transition-all">
            Cancelar
          </Link>
          <button type="submit" disabled={salvando} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-black text-xs font-black uppercase tracking-widest py-3 px-8 rounded-xl transition-all flex items-center gap-2 shadow-sm">
            {salvando ? <span className="animate-pulse">Criando Caderno...</span> : <><Save className="w-4 h-4" /> Criar Simulado e Avançar</>}
          </button>
        </div>

      </form>
    </div>
  );
}