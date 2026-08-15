"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, hashPassword, requireUser } from "@/lib/auth";
import { appUrl, emailEnabled, enviar } from "@/server/email";
import {
  consumirToken,
  criarToken,
  invalidarTokens,
} from "@/server/auth-tokens";

/**
 * Recuperação de senha e confirmação de e-mail.
 *
 * Vieram juntas porque usam a mesma engrenagem, mas resolvem coisas de peso
 * bem diferente: sem recuperação, esquecer a senha trancava a pessoa para
 * fora **para sempre** — não havia caminho de volta em lugar nenhum do app.
 */

// ------------------------------------------------------- recuperar a senha

/**
 * Pede o link de recuperação.
 *
 * Responde a mesma coisa exista a conta ou não. Um formulário que diz
 * "não encontrei esse e-mail" vira consulta pública de quem tem conta aqui.
 */
export async function pedirRecuperacao(email: string) {
  const alvo = z.string().email().safeParse(email.trim().toLowerCase());
  const generico = {
    ok: true as const,
    mensagem: "Se existe uma conta com esse e-mail, o link acabou de sair.",
  };
  if (!alvo.success) return generico;

  if (!emailEnabled()) {
    return {
      ok: false as const,
      mensagem: "O envio de e-mail não está configurado neste servidor.",
    };
  }

  const user = await db.user.findUnique({
    where: { email: alvo.data },
    select: { id: true, name: true, email: true },
  });
  if (!user) return generico;

  const raw = await criarToken(user.id, "RESET_SENHA");
  // null = pedido repetido dentro da janela de espera; a resposta é a mesma
  if (!raw) return generico;

  await enviar({
    para: user.email,
    assunto: "Redefinir sua senha do Beni",
    titulo: "Vamos trocar sua senha",
    corpo: [
      `Alguém — esperamos que você — pediu para redefinir a senha de <strong>${user.email}</strong>.`,
      "O link vale por uma hora e só funciona uma vez.",
      "Se não foi você, pode ignorar: a senha atual continua valendo.",
    ],
    botao: {
      texto: "Escolher nova senha",
      url: `${appUrl()}/redefinir/${encodeURIComponent(raw)}`,
    },
  });

  return generico;
}

const senhaForte = z
  .string()
  .min(8, "A senha precisa de pelo menos 8 caracteres");

/**
 * Troca a senha e derruba as sessões antigas.
 *
 * Quem redefine às pressas costuma estar tentando expulsar alguém. Sem mexer
 * no `sessionEpoch`, o intruso continuaria dentro com o cookie que já tinha —
 * e a troca de senha seria teatro.
 */
export async function redefinirSenha(raw: string, senha: string) {
  const parsed = senhaForte.safeParse(senha);
  if (!parsed.success) {
    return { ok: false as const, erro: parsed.error.issues[0]!.message };
  }

  const token = await consumirToken(raw, "RESET_SENHA");
  if (!token) {
    return {
      ok: false as const,
      erro: "Este link já foi usado ou expirou. Peça outro.",
    };
  }

  await db.user.update({
    where: { id: token.userId },
    data: {
      passwordHash: await hashPassword(parsed.data),
      sessionEpoch: { increment: 1 },
      // quem provou ter acesso à caixa de entrada confirmou o endereço no
      // mesmo ato — pedir de novo seria burocracia sem ganho
      emailVerifiedAt: new Date(),
    },
  });

  await invalidarTokens(token.userId, "RESET_SENHA");

  await enviar({
    para: token.user.email,
    assunto: "Sua senha do Beni foi alterada",
    titulo: "Senha alterada",
    corpo: [
      "A senha desta conta acabou de ser trocada, e as sessões abertas foram encerradas.",
      "Se não foi você, redefina a senha agora mesmo — quem trocou tem acesso à sua caixa de e-mail.",
    ],
    botao: { texto: "Entrar no Beni", url: `${appUrl()}/login` },
  });

  return { ok: true as const };
}

// ------------------------------------------------------- confirmar e-mail

/** Manda (ou remanda) o link de confirmação para quem está logado. */
export async function reenviarConfirmacao() {
  const user = await requireUser();
  if (user.emailVerifiedAt) return { ok: true as const };
  if (!emailEnabled()) {
    return { ok: false as const, erro: "O envio de e-mail não está configurado." };
  }

  const raw = await criarToken(user.id, "CONFIRMAR_EMAIL");
  if (!raw) {
    return {
      ok: false as const,
      erro: "Acabamos de enviar um link. Confira a caixa de entrada e o spam.",
    };
  }

  await enviarConfirmacao(user.email, user.name, raw);
  return { ok: true as const };
}

/** Usado também no cadastro, onde ainda não há sessão para consultar. */
export async function enviarConfirmacao(email: string, nome: string, raw: string) {
  await enviar({
    para: email,
    assunto: "Confirme seu e-mail no Beni",
    titulo: `Boas-vindas, ${nome.split(" ")[0]}`,
    corpo: [
      "Falta um passo: confirmar que este endereço é seu.",
      "Sua conta já funciona normalmente — a confirmação libera os avisos por e-mail e garante que você consiga recuperar a senha depois.",
    ],
    botao: {
      texto: "Confirmar meu e-mail",
      url: `${appUrl()}/confirmar/${encodeURIComponent(raw)}`,
    },
  });
}

/**
 * Consome o link de confirmação.
 *
 * Cria sessão quando não há: o caminho comum é abrir o e-mail no celular, sem
 * estar logado ali — e mandar a pessoa para a tela de login depois de ela ter
 * provado quem é seria pedir a mesma prova duas vezes.
 */
export async function confirmarEmail(raw: string) {
  const token = await consumirToken(raw, "CONFIRMAR_EMAIL");
  if (!token) return { ok: false as const };

  const user = await db.user.update({
    where: { id: token.userId },
    data: { emailVerifiedAt: new Date() },
    select: { id: true, email: true, name: true, sessionEpoch: true },
  });

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    epoch: user.sessionEpoch,
  });

  revalidatePath("/", "layout");
  redirect("/");
}
