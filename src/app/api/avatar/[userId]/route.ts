import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Entrega a foto de perfil.
 *
 * Só para quem tem sessão: foto de rosto é dado pessoal, e a alternativa —
 * servir por URL adivinhável a partir do id — deixaria qualquer um coletar os
 * rostos de um workspace inteiro.
 *
 * O cache é longo porque o endereço carrega `?v=` com o carimbo da última
 * troca: o navegador guarda à vontade e ainda assim vê a foto nova no
 * instante em que ela muda.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  if (!(await getSession())) {
    return new NextResponse("Sem permissão", { status: 403 });
  }

  const { userId } = await params;
  const avatar = await db.avatar.findUnique({ where: { userId } });
  if (!avatar) return new NextResponse("Não encontrado", { status: 404 });

  return new NextResponse(new Uint8Array(avatar.data), {
    headers: {
      "Content-Type": avatar.mimeType,
      "Content-Length": String(avatar.data.length),
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
