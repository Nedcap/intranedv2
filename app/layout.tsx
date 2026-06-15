/* eslint-disable @typescript-eslint/no-explicit-any */
import "./globals.css"; // 🛡️ OBRIGATÓRIO: Injeta o Tailwind no ecossistema inteiro
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
    <html lang="pt-BR">
      <body className={inter.className}>{children}</body>
    </html>
  );
}