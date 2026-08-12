import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Diz qual build está no ar.
 *
 * Existe por necessidade prática: sem isto, a única forma de saber se uma
 * implantação pegou era procurar alguma mudança visível na tela — e quando a
 * mudança era sutil, dava para gastar meia hora depurando um problema que já
 * estava corrigido, só que ainda não publicado.
 */
export async function GET() {
  const build = await readFile("/app/.build-stamp", "utf8")
    .then((v) => v.trim())
    .catch(() => process.env.BUILD_STAMP ?? "desenvolvimento");

  return NextResponse.json({
    build,
    startedAt: new Date(Date.now() - Math.round(process.uptime() * 1000)).toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  });
}
