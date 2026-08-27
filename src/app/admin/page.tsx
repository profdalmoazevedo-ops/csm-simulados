"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function AdminAtualizarQuestoes() {
  const [questaoAtual, setQuestaoAtual] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [restantes, setRestantes] = useState(0);

  // Estados dos inputs
  const [orgao, setOrgao] = useState('');
  const [cargo, setCargo] = useState('');

  // Busca uma questão que não tenha órgão ou cargo preenchido
  const buscarProximaQuestao = async () => {
    setLoading(true);
    setOrgao('');
    setCargo('');
    
    try {
      // Conta quantas faltam
      const { count } = await supabase
        .from('questoes')
        .select('*', { count: 'exact', head: true })
        .or('orgao.is.null,cargo.is.null,orgao.eq."",cargo.eq.""');

      setRestantes(count || 0);

      if (count === 0) {
        setQuestaoAtual(null);
        setLoading(false);
        return;
      }

      // Puxa 1 questão incompleta
      const { data, error } = await supabase
        .from('questoes')
        .select('id, enunciado, banca, ano, materia, orgao, cargo')
        .or('orgao.is.null,cargo.is.null,orgao.eq."",cargo.eq.""')
        .limit(1)
        .single();

      if (error) throw error;
      
      setQuestaoAtual(data);
      // Preenche os inputs caso um dos dois já exista na questão
      if (data.orgao) setOrgao(data.orgao);
      if (data.cargo) setCargo(data.cargo);

    } catch (error) {
      console.error("Erro ao buscar questão:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    buscarProximaQuestao();
  }, []);

  // Salva os dados e chama a próxima
  const salvarEAvancar = async () => {
    if (!questaoAtual) return;
    setSalvando(true);

    try {
      const { error } = await supabase
        .from('questoes')
        .update({ 
          orgao: orgao.trim() || null, 
          cargo: cargo.trim() || null 
        })
        .eq('id', questaoAtual.id);

      if (error) throw error;
      
      // Busca a próxima automaticamente
      await buscarProximaQuestao();
    } catch (error) {
      console.error("Erro ao atualizar:", error);
      alert("Erro ao salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  // Ignora a questão atual e pula para a próxima (caso não saiba preencher agora)
  const pularQuestao = async () => {
    setLoading(true);
    // Para não cair num loop infinito na mesma questão ao pular, 
    // buscamos uma diferente pegando um offset aleatório baseado nas restantes.
    const offset = Math.floor(Math.random() * (restantes > 10 ? 10 : restantes));
    
    const { data } = await supabase
      .from('questoes')
      .select('id, enunciado, banca, ano, materia, orgao, cargo')
      .or('orgao.is.null,cargo.is.null,orgao.eq."",cargo.eq.""')
      .range(offset, offset)
      .single();

    if (data) {
      setQuestaoAtual(data);
      setOrgao(data.orgao || '');
      setCargo(data.cargo || '');
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="min-h-screen bg-[#09090b] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-[#e4e4e7] p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        
        <div className="flex items-center justify-between border-b border-white/10 pb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Atualização em Massa</h1>
            <p className="text-zinc-400 text-sm mt-1">Preencha Órgão e Cargo das questões pendentes.</p>
          </div>
          <div className="bg-blue-500/10 text-blue-500 px-4 py-2 rounded-lg font-bold text-sm">
            Faltam: {restantes}
          </div>
        </div>

        {!questaoAtual ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-8 rounded-2xl text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white">Tudo atualizado!</h2>
            <p className="text-zinc-400 mt-2">Não há mais questões com Órgão ou Cargo em branco.</p>
          </div>
        ) : (
          <div className="bg-[#131c2f]/30 border border-white/5 p-8 rounded-2xl space-y-8">
            
            <div className="flex gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
              <span className="bg-white/5 px-2 py-1 rounded">{questaoAtual.ano}</span>
              <span className="bg-white/5 px-2 py-1 rounded">{questaoAtual.banca}</span>
              <span className="bg-white/5 px-2 py-1 rounded">{questaoAtual.materia}</span>
            </div>

            <div className="text-zinc-200 text-sm leading-relaxed bg-black/20 p-6 rounded-xl border border-white/5 h-64 overflow-y-auto">
              {questaoAtual.enunciado}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Órgão</label>
                <input 
                  type="text" 
                  placeholder="Ex: TJ-SP, Polícia Federal"
                  value={orgao}
                  onChange={(e) => setOrgao(e.target.value.toUpperCase())}
                  className="w-full bg-[#09090b] border border-white/10 rounded-lg px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Cargo</label>
                <input 
                  type="text" 
                  placeholder="Ex: Analista, Soldado"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value.toUpperCase())}
                  className="w-full bg-[#09090b] border border-white/10 rounded-lg px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t border-white/5">
              <button 
                onClick={pularQuestao}
                className="w-1/3 py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold uppercase text-[10px] tracking-widest rounded-xl transition-colors"
              >
                Pular
              </button>
              <button 
                onClick={salvarEAvancar}
                disabled={salvando}
                className="w-2/3 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase text-[10px] tracking-widest rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar e Próxima'}
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}