"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { DEFAULT_STATUSES, PALETTE } from "@/lib/constants";

export type AuthState = { error?: string } | undefined;

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

const registerSchema = z.object({
  name: z.string().min(2, "Informe seu nome"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "A senha precisa de pelo menos 6 caracteres"),
});

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "E-mail ou senha incorretos" };
  }

  await createSession({ userId: user.id, email: user.email, name: user.name });
  redirect(String(formData.get("next") || "/"));
}

export async function registerAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const exists = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) return { error: "Já existe uma conta com esse e-mail" };

  const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];

  const user = await db.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
      avatarColor: color,
    },
  });

  // Cada novo usuário ganha um workspace com um projeto de exemplo
  const baseSlug = slugify(`${parsed.data.name}-workspace`) || "workspace";
  let slug = baseSlug;
  let n = 1;
  while (await db.workspace.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${++n}`;
  }

  const workspace = await db.workspace.create({
    data: {
      name: `Workspace de ${parsed.data.name.split(" ")[0]}`,
      slug,
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });

  const project = await db.project.create({
    data: {
      workspaceId: workspace.id,
      name: "Meu primeiro projeto",
      key: "PRJ",
      description: "Um espaço para começar a organizar suas entregas.",
      color: "#eab308",
      icon: "Rocket",
      order: 1000,
    },
  });

  await db.taskStatus.createMany({
    data: DEFAULT_STATUSES.map((s, i) => ({
      projectId: project.id,
      name: s.name,
      color: s.color,
      category: s.category,
      order: (i + 1) * 1000,
    })),
  });

  await createSession({ userId: user.id, email: user.email, name: user.name });
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
