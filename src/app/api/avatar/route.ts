import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { MAX_AVATAR_BYTES } from "@/lib/avatares";

export const dynamic = "force-dynamic";

/**
 * Envio da foto de perfil.
 *
 * Rota própria, e não Server Action, pelo mesmo motivo dos anexos: o corpo de
 * uma Server Action tem teto de 1 MB. A imagem já chega recortada em quadrado
 * e reduzida pelo navegador — aqui só se confere o que veio.
 */
export async function POST(request: Request) {
  const user = await requireUser();

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Nenhuma imagem enviada" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Envie uma imagem" }, { status: 415 });
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return NextResponse.json({ error: "Imagem grande demais" }, { status: 413 });
  }

  const data = new Uint8Array(await file.arrayBuffer());

  await db.$transaction([
    db.avatar.upsert({
      where: { userId: user.id },
      create: { userId: user.id, mimeType: file.type, data },
      update: { mimeType: file.type, data },
    }),
    // foto e mascote são excludentes: quem manda uma foto está trocando de
    // avatar, não acumulando dois
    db.user.update({ where: { id: user.id }, data: { avatarMascot: null } }),
  ]);

  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
