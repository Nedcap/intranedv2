import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "Esta rota de integração com o Google Sheets foi descontinuada na Infraestrutura V2." },
    { status: 410 } // 410 Gone: Indica que o recurso sumiu permanentemente
  );
}

export async function POST() {
  return NextResponse.json(
    { success: false, error: "Integração descontinuada. Use o painel nativo do Supabase V2." },
    { status: 410 }
  );
}