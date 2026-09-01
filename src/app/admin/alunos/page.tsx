"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, Search, Award, Calendar, Eye, Loader2 } from 'lucide-react';
import Link from 'next/link'; 

export default function GestaoAlunos() {
  const [alunos, setAlunos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    async function carregarAlunos() {
      setLoading(true);
      try {
        // 1. Busca os dados básicos dos alunos (Nome, Email)
        const { data: usuarios, error: errPerfis } = await supabase
          .from('usuarios')
          .select('*');

        if (errPerfis) throw errPerfis;

        // 2. Busca as estatísticas de gamificação
        const { data: estatisticas, error: errEstat } = await supabase
          .from('estatisticas_alunos')
          .select('*');

        if (errEstat) throw errEstat;

        // 3. Mescla as duas tabelas usando o ID do aluno
        const alunosCompletos = (usuarios || []).map(usuarios => {
          const stats = (estatisticas || []).find(s => s.aluno_id === usuarios.id) || {};
          
          const precisao = stats.questoes_resolvidas > 0 
            ? Math.round((stats.acertos_totais / stats.questoes_resolvidas) * 100) 
            : 0;

          return {
            id: usuarios.id,
            nome: usuarios.nome || usuarios.full_name || 'Aluno Sem Nome',
            email: usuarios.email || 'Sem e-mail',
            nivel: stats.nivel_atual || 'Iniciante',
            questoes_resolvidas: stats.questoes_resolvidas || 0,
            precisao: precisao,
            ultima_atividade: stats.ultima_atividade || null
          };
        });

        // Ordena para mostrar os mais ativos primeiro
        alunosCompletos.sort((a, b) => b.questoes_resolvidas - a.questoes_resolvidas);
        setAlunos(alunosCompletos);

      } catch (error) {
        console.error("Erro ao carregar lista de alunos:", error);
      } finally {
        setLoading(false);
      }
    }

    carregarAlunos();
  }, []);

  const formatarData = (dataIso: string | null) => {
    if (!dataIso) return "Nunca acessou";
    const data = new Date(dataIso);
    return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Filtro de busca na tabela
  const alunosFiltrados = alunos.filter(aluno => 
    aluno.nome.toLowerCase().includes(busca.toLowerCase()) ||
    aluno.email.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-5">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white uppercase tracking-widest">
              Gestão de Alunos
            </h1>
            <p className="text-xs text-zinc-500 mt-1 uppercase tracking-widest">
              Acompanhe o desempenho e engajamento da turma.
            </p>
          </div>
        </div>
        
        {/* Barra de Busca */}
        <div className="relative w-full md:w-72">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-zinc-500" />
          </div>
          <input
            type="text"
            placeholder="Buscar aluno..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="block w-full pl-11 pr-4 py-3 bg-[#09090b] border border-white/10 text-sm text-white rounded-xl placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
      </div>

      {/* Tabela de Alunos */}
      <div className="bg-[#131c2f]/30 border border-white/5 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/5 text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                <th className="p-5 pl-8">Aluno</th>
                <th className="p-5 text-center">Nível Atual</th>
                <th className="p-5 text-center">Questões</th>
                <th className="p-5 text-center">Precisão</th>
                <th className="p-5 text-right pr-6">Última Atividade</th>
                <th className="p-5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <Loader2 className="w-6 h-6 text-emerald-500 animate-spin mx-auto mb-3" />
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                      Carregando registros...
                    </span>
                  </td>
                </tr>
              ) : alunosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-zinc-500">
                    <Users className="w-8 h-8 opacity-20 mx-auto mb-3" />
                    <span className="text-xs font-bold uppercase tracking-widest">
                      Nenhum aluno encontrado
                    </span>
                  </td>
                </tr>
              ) : (
                alunosFiltrados.map((aluno) => (
                  <tr key={aluno.id} className="hover:bg-white/5 transition-colors group">
                    <td className="p-5 pl-8">
                      <div className="font-bold text-white text-sm">{aluno.nome}</div>
                      <div className="text-xs text-zinc-500 mt-1">{aluno.email}</div>
                    </td>
                    <td className="p-5 text-center">
                      <span className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest border ${
                        aluno.nivel === 'Aprovado' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        aluno.nivel === 'Elite' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        aluno.nivel === 'Competitivo' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                      }`}>
                        <Award className="w-3.5 h-3.5" />
                        {aluno.nivel}
                      </span>
                    </td>
                    <td className="p-5 text-center font-bold text-white text-sm">
                      {aluno.questoes_resolvidas}
                    </td>
                    <td className="p-5 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`font-black text-sm mb-1.5 ${
                          aluno.precisao >= 70 ? 'text-emerald-400' : aluno.precisao >= 50 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          {aluno.precisao}%
                        </span>
                        <div className="w-16 h-1.5 bg-[#09090b] rounded-full overflow-hidden border border-white/5">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              aluno.precisao >= 70 ? 'bg-emerald-500' : aluno.precisao >= 50 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${aluno.precisao}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="p-5 text-right pr-6">
                      <div className="flex items-center justify-end gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatarData(aluno.ultima_atividade)}
                      </div>
                    </td>
                    <td className="p-5 text-center">
                      <Link 
                        href={`/admin/alunos/${aluno.id}`} 
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-black border border-emerald-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" /> Detalhes
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}