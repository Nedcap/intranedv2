/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/lib/supabase";

export function simplificarNome(nome: string): string {
  if (!nome) return "";
  let n = nome.trim().toUpperCase();
  n = n.replace(/\b(LTDA|SA|S\/A|EIRELI|ME|EPP|MEI|CIA|SS|INC|CORP)\b/g, "");
  return n.replace(/\s+/g, " ").trim();
}

export function parseValorReal(valor: any): number {
  if (!valor) return 0;
  if (typeof valor === "number") return valor;
  const str = String(valor).replace(/[R$\s]/g, "").trim();
  if (str.includes(",")) return parseFloat(str.replace(/\./g, "").replace(",", ".")) || 0;
  return parseFloat(str) || 0;
}

export function formatarMesAno(str: string) {
  if (!str) return "";
  const partes = str.split("/");
  if (partes.length === 2) {
    return `${partes[0].padStart(2, "0")}/${partes[1]}`;
  }
  return str;
}

export function extrairMesAnoDeDataBR(dataStr: string): string {
  if (!dataStr) return "";
  const partes = dataStr.split("/");
  if (partes.length === 3) {
    return `${partes[1].padStart(2, "0")}/${partes[2]}`;
  }
  if (partes.length === 2) {
    return `${partes[0].padStart(2, "0")}/${partes[1]}`;
  }
  return dataStr;
}

export function parseDataSegura(dataStr: string) {
  if (!dataStr) return null;
  const apenasData = dataStr.trim().split("T")[0];
  return new Date(`${apenasData}T12:00:00`);
}

export function calcularDiasUteis(dInicio: Date, dFim: Date) {
  let count = 0;
  const atual = new Date(dInicio.getTime());
  atual.setHours(12, 0, 0, 0);
  const fim = new Date(dFim.getTime());
  fim.setHours(12, 0, 0, 0);
  if (fim < atual) return 0;
  while (atual < fim) {
    atual.setDate(atual.getDate() + 1);
    const diaSemana = atual.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) {
      count++;
    }
  }
  return count;
}

export const fetchGoogleSheet = async (sheetName: string) => {
  try {
    const sheetId = "1uJ_BysO5VW6DLxoDuoy2ZKzEtRBcptydAa87Ih8cRCw";
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${sheetName}`;
    const res = await fetch(url);
    const text = await res.text();
    const jsonString = text.substring(text.indexOf("({") + 1, text.lastIndexOf("})") + 1);
    const jsonData = JSON.parse(jsonString);
    const headers = jsonData.table.cols.map((c: any) => c?.label?.trim().toLowerCase() || "");
    
    return jsonData.table.rows.map((r: any) => {
      const rowData: any = {};
      r.c.forEach((cell: any, i: number) => {
        if (headers[i]) {
          rowData[headers[i]] = cell ? ((cell.f || cell.v) ?? null) : null;
        }
      });
      return rowData;
    });
  } catch (error) {
    console.error(`Erro ao buscar aba ${sheetName}:`, error);
    return [];
  }
};