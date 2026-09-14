"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Target, TrendingUp, Award, Loader2, ArrowRight, Flame, BarChart2, Play, CalendarClock, PenLine, BookX, GraduationCap, LogIn, Sparkles } from 'lucide-react';
import Link from 'next/link';

type DadoSparkline = {
  acertos: number;
  questoes: number;
  pct: number;
  dataLabel: string;
};

type TentativaRegistro = {
  data_conclusao: string;
  total_acertos: number;
  total_questoes: number;
  simulado_id: string;
};

type BlocoContinuar =
  | { tipo: 'andamento'; id: string; titulo: string }
  | { tipo: 'disponivel'; id: string; titulo: string }
  | { tipo: 'agendado'; id: string; titulo: string; dataLiberacao: string; diasRestantes: number }
  | { tipo: 'nenhum' };

const chaveDataLocal = (data: Date) => {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
};

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [logado, setLogado] = useState(false);
  const [nomeAluno, setNomeAluno] = useState('');

  const [statsAluno, setStatsAluno] = useState({
    resolvidas: 0,
    acertos: 0,
    aproveitamento: 0
  });

  const [streakDias, setStreakDias] = useState(0);
  const [ultimos7Ativos, setUltimos7Ativos] = useState<boolean[]>([]);
  const [ultimasTentativas, setUltimasTentativas] = useState<DadoSparkline[]>([]);
  const [blocoContinuar, setBlocoContinuar] = useState<BlocoContinuar>({ tipo: 'nenhum' });

  useEffect(() => {
    async function carregarDashboard() {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        let conclusoesUsuario: TentativaRegistro[] = [];
        let simuladosTematicos: { id: string; titulo: string; data_liberacao: string; regra_subtracao: boolean | null }[] = [];

        // ids de provas em andamento salvos no navegador
        const idsEmAndamento: string[] = [];
        if (typeof window !== 'undefined') {
          for (let i = 0; i < localStorage.length; i++) {
            const chave = localStorage.key(i);
            if (chave && chave.startsWith('simulado_progresso_')) {
              idsEmAndamento.push(chave.replace('simulado_progresso_', ''));
            }
          }
        }

        // Dispara as consultas independentes em paralelo (sem efeito cascata)
        const [resStats, resTentativas, resTematicos, resAndamento] = await Promise.all([
          user
            ? supabase.rpc('obter_estatisticas_aluno', { p_aluno: user.id })
            : Promise.resolve({ data: null, error: null }),
          user
            ? supabase.from('historico_tentativas')
                .select('data_conclusao, total_acertos, total_questoes, simulado_id')
                .eq('aluno_id', user.id)
                .order('data_conclusao', { ascending: true })
            : Promise.resolve({ data: null, error: null }),
          supabase
            .from('simulados')
            .select('id, titulo, data_liberacao, regra_subtracao')
            .eq('tipo', 'tematico_professor')
            .eq('visivel', true)
            .order('data_liberacao', { ascending: false }),
          idsEmAndamento.length > 0
            ? supabase
                .from('simulados')
                .select('id, titulo')
                .in('id', idsEmAndamento)
            : Promise.resolve({ data: null, error: null }),
        ]);

        let bloco: BlocoContinuar = { tipo: 'nenhum' };

        if (user) {
          setLogado(true);
          const nome = user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'Aluno';
          setNomeAluno(nome.charAt(0).toUpperCase() + nome.slice(1));

          const stats = resStats.data as { total_respondidas?: number; total_acertos?: number }[] | null;

          const totalResolvidas = stats?.[0]?.total_respondidas || 0;
          const totalAcertos = stats?.[0]?.total_acertos || 0;

          if (totalResolvidas > 0) {
            const percentual = Math.round((totalAcertos / totalResolvidas) * 100);
            setStatsAluno({
              resolvidas: totalResolvidas,
              acertos: totalAcertos,
              aproveitamento: percentual
            });
          }

          conclusoesUsuario = (resTentativas.data || []) as TentativaRegistro[];

          if (conclusoesUsuario.length > 0) {
            const datasAtividade = new Set(conclusoesUsuario.map(t => chaveDataLocal(new Date(t.data_conclusao))));

            // Streak: conta os dias consecutivos terminando hoje (ou ontem, se hoje ainda não tem atividade)
            let streak = 0;
            const cursor = new Date();
            if (!datasAtividade.has(chaveDataLocal(cursor))) {
              cursor.setDate(cursor.getDate() - 1);
            }
            while (datasAtividade.has(chaveDataLocal(cursor))) {
              streak++;
              cursor.setDate(cursor.getDate() - 1);
            }
            setStreakDias(streak);

            // Bolinhas dos últimos 7 dias (índice 0 = 6 dias atrás, índice 6 = hoje)
            const ultimos7: boolean[] = [];
            for (let i = 6; i >= 0; i--) {
              const d = new Date();
              d.setDate(d.getDate() - i);
              ultimos7.push(datasAtividade.has(chaveDataLocal(d)));
            }
            setUltimos7Ativos(ultimos7);

            // Sparkline: últimas 10 entregas, mais recente à direita
            setUltimasTentativas(
              conclusoesUsuario.slice(-10).map(t => {
                const pct = t.total_questoes > 0 ? Math.round((t.total_acertos / t.total_questoes) * 100) : 0;
                return {
                  acertos: t.total_acertos,
                  questoes: t.total_questoes,
                  pct,
                  dataLabel: new Date(t.data_conclusao).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                };
              })
            );
          }
        }

        simuladosTematicos = (resTematicos.data || []) as typeof simuladosTematicos;

        // 1ª prioridade: prova em andamento
        const dadosAndamento = resAndamento.data as { id: string; titulo: string }[] | null;
        if (idsEmAndamento.length > 0) {
          const primeiro = dadosAndamento?.[0];
          if (primeiro) {
            bloco = { tipo: 'andamento', id: primeiro.id, titulo: primeiro.titulo };
          }
        }

        // 2ª prioridade: primeiro simulado já liberado e ainda não concluído
        if (bloco.tipo === 'nenhum' && user && simuladosTematicos.length > 0) {
          const agora = new Date();

          const concluidos = new Set(conclusoesUsuario.map(t => t.simulado_id));

          const disponivel = simuladosTematicos.find(s => new Date(s.data_liberacao) <= agora && !concluidos.has(s.id));
          if (disponivel) {
            bloco = { tipo: 'disponivel', id: disponivel.id, titulo: disponivel.titulo };
          } else {
            const agendado = simuladosTematicos.find(s => new Date(s.data_liberacao) > agora);
            if (agendado) {
              const diasRestantes = Math.max(0, Math.ceil((new Date(agendado.data_liberacao).getTime() - Date.now()) / 86400000));
              bloco = { tipo: 'agendado', id: agendado.id, titulo: agendado.titulo, dataLiberacao: agendado.data_liberacao, diasRestantes };
            }
          }
        }

        setBlocoContinuar(bloco);
      } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
      } finally {
        setLoading(false);
      }
    }

    carregarDashboard();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex justify-center items-center">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
      </div>
    );
  }

  const diasRestantes = blocoContinuar.tipo === 'agendado' ? blocoContinuar.diasRestantes : 0;

  const acoesRapidas = [
    { href: '/pratica', icone: PenLine, nome: 'Praticar Questões', desc: 'Banco de questões com filtros inteligentes', cor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    { href: '/gerador', icone: Sparkles, nome: 'Gerar Simulado', desc: 'Prova personalizada com suas preferências', cor: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    { href: '/simulados', icone: GraduationCap, nome: 'Simulados Temáticos', desc: 'Provas selecionadas pelo professor', cor: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
    { href: '/gerador?aba=erros', icone: BookX, nome: 'Caderno de Erros', desc: 'Ataque suas fraquezas de forma direta', cor: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
    { href: '/desempenho', icone: BarChart2, nome: 'Análise de Desempenho', desc: 'Relatório completo da sua evolução', cor: 'text-zinc-400 bg-white/5 border-white/10' },
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-[#e4e4e7] font-sans pb-20">
      <div className="max-w-7xl mx-auto px-6 pt-12">

        {/* Saudação */}
        <div className="mb-12">
          <div className="flex items-center gap-4 mb-2 flex-wrap">
            <h1 className="text-4xl font-serif text-white italic">
              {logado ? `Bem-vindo(a) de volta, ${nomeAluno}.` : 'Bem-vindo(a) à plataforma.'}
            </h1>
            {logado && streakDias > 0 && (
              <span className="inline-flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/25 text-orange-400 text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-lg">
                <Flame className="w-4 h-4 fill-orange-500/40" /> {streakDias} dia{streakDias > 1 ? 's' : ''} em sequência
              </span>
            )}
          </div>
          <p className="text-zinc-400">Acompanhe sua evolução e continue sua jornada rumo à aprovação.</p>
        </div>

        {/* CONTINUE SEU ESTUDO */}
        <div className="mb-16">
          {blocoContinuar.tipo === 'andamento' && (
            <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-[#131c2f]/30 p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Play className="w-6 h-6 fill-current" />
                </div>
                <div>
                  <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-1">Prova em andamento</p>
                  <h3 className="text-white font-bold text-lg md:text-xl leading-snug">{blocoContinuar.titulo}</h3>
                </div>
              </div>
              <Link
                href={`/simulado/${blocoContinuar.id}`}
                className="w-full md:w-auto shrink-0 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-black font-black uppercase tracking-widest text-xs px-8 py-4 rounded-xl transition-colors"
              >
                Continuar Prova <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {blocoContinuar.tipo === 'disponivel' && (
            <div className="relative overflow-hidden rounded-3xl border border-purple-500/30 bg-gradient-to-r from-purple-500/10 to-[#131c2f]/30 p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                  <Play className="w-6 h-6 fill-current" />
                </div>
                <div>
                  <p className="text-purple-400 text-[10px] font-black uppercase tracking-widest mb-1">Novo simulado disponível</p>
                  <h3 className="text-white font-bold text-lg md:text-xl leading-snug">{blocoContinuar.titulo}</h3>
                </div>
              </div>
              <Link
                href={`/simulado/${blocoContinuar.id}`}
                className="w-full md:w-auto shrink-0 inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-black uppercase tracking-widest text-xs px-8 py-4 rounded-xl transition-colors"
              >
                Iniciar Prova <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {blocoContinuar.tipo === 'agendado' && (
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#131c2f]/30 p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-white/5 text-zinc-300 flex items-center justify-center shrink-0">
                  <CalendarClock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mb-1">
                    Próximo simulado em {diasRestantes} dia{diasRestantes > 1 ? 's' : ''}
                  </p>
                  <h3 className="text-white font-bold text-lg md:text-xl leading-snug">{blocoContinuar.titulo}</h3>
                </div>
              </div>
              <Link
                href="/simulados"
                className="w-full md:w-auto shrink-0 inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 font-black uppercase tracking-widest text-xs px-8 py-4 rounded-xl transition-colors"
              >
                Ver Simulados <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {blocoContinuar.tipo === 'nenhum' && logado && (
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#131c2f]/30 p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                  <PenLine className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-1">Pronto para treinar?</p>
                  <h3 className="text-white font-bold text-lg md:text-xl leading-snug">Resolva questões e monte sua jornada de aprovação.</h3>
                </div>
              </div>
              <Link
                href="/pratica"
                className="w-full md:w-auto shrink-0 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-black font-black uppercase tracking-widest text-xs px-8 py-4 rounded-xl transition-colors"
              >
                Praticar Agora <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {blocoContinuar.tipo === 'nenhum' && !logado && (
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#131c2f]/30 p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                  <LogIn className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest mb-1">Comece agora</p>
                  <h3 className="text-white font-bold text-lg md:text-xl leading-snug">Entre para salvar seu progresso e acompanhar sua evolução.</h3>
                </div>
              </div>
              <Link
                href="/auth"
                className="w-full md:w-auto shrink-0 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-xs px-8 py-4 rounded-xl transition-colors"
              >
                Fazer Login <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>

        {/* Painel de Desempenho do Aluno */}
        <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6">Seu Desempenho</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">

          <div className="bg-[#131c2f]/30 border border-emerald-500/20 p-8 rounded-3xl relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-emerald-500/5 rounded-full group-hover:scale-110 transition-transform blur-2xl"></div>
            <Target className="w-8 h-8 text-emerald-500 mb-6" />
            <span className="block text-4xl font-black text-white mb-2">{statsAluno.resolvidas}</span>
            <span className="text-xs uppercase tracking-widest text-zinc-400 font-bold">Questões Resolvidas</span>
          </div>

          <div className="bg-[#131c2f]/30 border border-blue-500/20 p-8 rounded-3xl relative overflow-hidden group hover:border-blue-500/50 transition-colors">
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-blue-500/5 rounded-full group-hover:scale-110 transition-transform blur-2xl"></div>
            <Award className="w-8 h-8 text-blue-500 mb-6" />
            <span className="block text-4xl font-black text-white mb-2">{statsAluno.acertos}</span>
            <span className="text-xs uppercase tracking-widest text-zinc-400 font-bold">Respostas Certas</span>
          </div>

          <div className="bg-[#131c2f]/30 border border-purple-500/20 p-8 rounded-3xl relative overflow-hidden group hover:border-purple-500/50 transition-colors flex flex-col justify-between">
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-purple-500/5 rounded-full group-hover:scale-110 transition-transform blur-2xl"></div>

            <div>
              <TrendingUp className="w-8 h-8 text-purple-500 mb-6" />
              <div className="flex items-baseline gap-1 mb-2">
                <span className="block text-4xl font-black text-white">{statsAluno.aproveitamento}</span>
                <span className="text-xl text-zinc-500 font-bold">%</span>
              </div>
              <span className="text-xs uppercase tracking-widest text-zinc-400 font-bold">Taxa de Acerto Geral</span>
            </div>

            <div className="mt-8 z-10 relative">
              <Link
                href="/desempenho"
                className="w-full inline-flex items-center justify-center gap-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-400 font-black text-[10px] uppercase tracking-widest py-3 px-4 rounded-xl transition-all"
              >
                Análise de Desempenho <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Evolução Recente + Consistência */}
        {logado && (
          <>
            <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6">Evolução Recente</h2>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-16">

              {/* Sparkline */}
              <div className="bg-[#131c2f]/30 p-8 rounded-3xl border border-white/5 lg:col-span-3">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-500" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Últimas provas concluídas</h3>
                  </div>
                  <Link href="/desempenho" className="text-[10px] font-black uppercase tracking-widest text-purple-400 hover:text-purple-300 inline-flex items-center gap-1.5">
                    Ver análise <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                {ultimasTentativas.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-sm text-zinc-500">Conclua provas para acompanhar sua evolução aqui.</p>
                  </div>
                ) : (
                  <div className="flex items-end justify-between gap-2 h-40 pt-4 px-2 border-b border-white/5">
                    {ultimasTentativas.map((t, index) => {
                      const corBarra = t.pct >= 80 ? 'bg-emerald-500/40 hover:bg-emerald-500' : t.pct >= 50 ? 'bg-amber-500/40 hover:bg-amber-500' : 'bg-red-500/40 hover:bg-red-500';
                      return (
                        <div key={index} className="flex flex-col items-center gap-2 flex-1 h-full justify-end">
                          <span className="text-[10px] font-black text-zinc-400">{t.pct}%</span>
                          <div
                            className={`w-full max-w-[2.5rem] ${corBarra} rounded-t-lg transition-all`}
                            style={{ height: `${Math.max(t.pct, 8)}%` }}
                            title={`${t.acertos}/${t.questoes} acertos`}
                          />
                          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                            {t.dataLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Streak / Consistência */}
              <div className="bg-[#131c2f]/30 p-8 rounded-3xl border border-white/5 lg:col-span-2">
                <div className="flex items-center gap-2 mb-8">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Consistência</h3>
                </div>

                <div className="mb-8">
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black text-white">{streakDias}</span>
                    <span className="text-xs uppercase tracking-widest text-zinc-500 font-bold">dias em sequência</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {ultimos7Ativos.map((ativo, index) => {
                    const d = new Date();
                    d.setDate(d.getDate() - (6 - index));
                    return (
                      <div key={index} className="flex flex-col items-center gap-1.5 flex-1">
                        <span
                          title={d.toLocaleDateString('pt-BR')}
                          className={`w-full aspect-square rounded-full border ${
                            ativo
                              ? 'bg-emerald-500 border-emerald-400'
                              : 'bg-white/5 border-white/10'
                          }`}
                        />
                        <span className="text-[9px] font-black uppercase text-zinc-600">
                          {d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').slice(0, 3)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-zinc-500 mt-6 leading-relaxed">
                  Sequência conta os dias em que você concluiu pelo menos uma prova.
                </p>
              </div>
            </div>
          </>
        )}

        {/* Ações Rápidas */}
        <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6">Ações Rápidas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {acoesRapidas.map((acao) => {
            const Icone = acao.icone;
            return (
              <Link
                key={acao.href}
                href={acao.href}
                className="group bg-[#131c2f]/30 border border-white/5 hover:border-white/20 p-6 rounded-3xl transition-all hover:-translate-y-1"
              >
                <div className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-4 ${acao.cor}`}>
                  <Icone className="w-6 h-6" />
                </div>
                <h3 className="text-white font-bold text-sm mb-1 flex items-center gap-1.5">
                  {acao.nome}
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-300 transition-colors" />
                </h3>
                <p className="text-xs text-zinc-500">{acao.desc}</p>
              </Link>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <Link
            href="/central"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black hover:bg-zinc-200 font-black uppercase text-xs tracking-widest rounded-xl transition-colors"
          >
            Ir para Central do Aluno
          </Link>
        </div>

      </div>
    </div>
  );
}