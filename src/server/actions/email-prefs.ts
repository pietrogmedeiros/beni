"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export type EmailPrefs = {
  emailOnAssign: boolean;
  emailOnApproval: boolean;
  emailDailyDigest: boolean;
  /** Se o servidor tem envio configurado — sem isso os controles não fazem nada. */
  ativo: boolean;
};

export async function getEmailPrefs(): Promise<EmailPrefs> {
  const user = await requireUser();
  const dados = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { emailOnAssign: true, emailOnApproval: true, emailDailyDigest: true },
  });
  return { ...dados, ativo: !!process.env.RESEND_API_KEY };
}

export async function setEmailPref(campo: keyof Omit<EmailPrefs, "ativo">, valor: boolean) {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { [campo]: valor } });
  revalidatePath("/settings");
}
