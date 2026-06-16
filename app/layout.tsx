/* eslint-disable @typescript-eslint/no-explicit-any */
import "./globals.css"; 
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "IntraNed - Ned Capital",
  description: "Controle e Gestão Operacional",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // 🎯 Fix: suppressHydrationWarning evita quebras e logs de erro causados por extensões de navegadores
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>{children}</body>
    </html>
  );
}