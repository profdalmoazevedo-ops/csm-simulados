import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar"; // Importe a NavBar aqui

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
        {/* O conteúdo das páginas será renderizado aqui embaixo */}
        {children}
      </body>
    </html>
  );
}