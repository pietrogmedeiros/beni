import { db } from "@/lib/db";
import { filtroDeMembrosDoChamador } from "@/server/escopo";
import { handler } from "@/server/api-core";

export const dynamic = "force-dynamic";

/** Quem sou eu, onde estou e quem é o time — o primeiro passo de qualquer integração. */
export const GET = handler(async (caller) => {
  const [workspace, members] = await Promise.all([
    db.workspace.findUnique({
      where: { id: caller.workspaceId },
      select: { id: true, name: true, slug: true },
    }),
    db.membership.findMany({
      where: await filtroDeMembrosDoChamador(caller),
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return {
    workspace,
    you: { name: caller.userName, id: caller.userId },
    members: members.map((m) => ({
      name: m.user.name,
      email: m.user.email,
      role: m.role,
    })),
  };
});
