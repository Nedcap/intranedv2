import { NextResponse } from "next/server";

const RESEND_API_KEY = "re_WmeXNjdd_97NXwjjkUJc5prK4KfNF3xvA";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Erro ao disparar e-mail" }, { status: 500 });
  }
}