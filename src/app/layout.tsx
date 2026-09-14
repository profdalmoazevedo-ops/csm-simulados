import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar"; // Importe a NavBar aqui
import AutoLogout from "@/components/AutoLogout";
import ProtegerRota from "@/components/ProtegerRota"; // Redireciona visitantes para /auth

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Simulados - Prof. Dalmo Azevedo",
  description: "Plataforma sob demanda de simulados",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        {/* A NavBar ficará fixa no topo */}
        <Navbar />
        {/* Encerra a sessão por inatividade */}
        <AutoLogout />
        {/* Redireciona visitantes para /auth (exceto rotas públicas) */}
        <ProtegerRota>
          {/* O conteúdo das páginas será renderizado aqui embaixo */}
          {children}
        </ProtegerRota>
      </body>
    </html>
  );
}