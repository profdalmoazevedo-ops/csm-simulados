import React from 'react';
import Link from 'next/link';
import { Target, Sliders, BookOpen } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-[#09090b] text-[#e4e4e7] font-sans pb-20">
      {/* Aqui depois incluiremos sua Navbar padrão */}
      
      <div className="max-w-7xl mx-auto px-6 pt-24 space-y-12">
        <div>
          <h1 className="text-4xl font-serif text-white italic mb-2 uppercase">Área do Aluno</h1>
          <p className="text-zinc-400">Escolha como você deseja treinar hoje e direcione sua aprovação.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Módulo 1: Banco de Questões */}
          <div className="p-8 rounded-3xl bg-[#131c2f]/30 border border-emerald-500/20 hover:border-emerald-500/50 transition-all flex flex-col justify-between">
            <div>
              <Target className="w-8 h-8 mb-6 text-emerald-500" />
              <h3 className="text-xl font-bold text-white mb-2">Banco de Questões</h3>
              <p className="text-sm text-zinc-400 mb-8">
                Resolva questões avulsas do banco. Filtre por banca, disciplina, assunto e ano.
              </p>
            </div>
            <Link 
              href="/pratica" 
              className="block w-full py-4 bg-emerald-600 text-black text-center font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-emerald-500 transition-colors"
            >
              Iniciar Prática
            </Link>
          </div>

          {/* Módulo 2: Simulados Personalizados */}
          <div className="p-8 rounded-3xl bg-[#131c2f]/30 border border-blue-500/20 hover:border-blue-500/50 transition-all flex flex-col justify-between">
            <div>
              <Sliders className="w-8 h-8 mb-6 text-blue-500" />
              <h3 className="text-xl font-bold text-white mb-2">Simulado Personalizado</h3>
              <p className="text-sm text-zinc-400 mb-8">
                Monte sua própria prova. Escolha a quantidade de questões, regras e cronômetro.
              </p>
            </div>
            <Link 
              href="/gerador" 
              className="block w-full py-4 bg-blue-600 text-black text-center font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-blue-500 transition-colors"
            >
              Criar Simulado
            </Link>
          </div>

          {/* Módulo 3: Simulados Temáticos */}
          <div className="p-8 rounded-3xl bg-[#131c2f]/30 border border-purple-500/20 hover:border-purple-500/50 transition-all flex flex-col justify-between">
            <div>
              <BookOpen className="w-8 h-8 mb-6 text-purple-500" />
              <h3 className="text-xl font-bold text-white mb-2">Simulados Temáticos</h3>
              <p className="text-sm text-zinc-400 mb-8">
                Provas semanais montadas pela curadoria do professor. Mapeie seus pontos cegos.
              </p>
            </div>
            <Link 
              href="/simulados" 
              className="block w-full py-4 bg-purple-600 text-black text-center font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-purple-500 transition-colors"
            >
              Ver Acervo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}