import "server-only";
import { db } from "@/lib/db";
import { appUrl, enviarUmaVez } from "@/server/email";
import { formatDate } from "@/lib/utils";

/**
 * Quais avisos viram e-mail, e quando.
 *
 * Fica separado do envio de propósito: aqui mora a regra de negócio — quem
 * recebe, sob que condição, com que texto —, e em `email.ts` mora o transporte.
 * Trocar de provedor não deveria obrigar a reler as regras.
 */

const PRIORIDADE: Record<string, string> = {
  URGENT: "urgente",
  HIGH: "alta",
  MEDIUM: "média",
  LOW: "baixa",
  NONE: "sem prioridade",
};

function linkDaTarefa(taskId: string) {
  return `${appUrl()}/t/${taskId}`;
}

/**
 * Alguém foi posto como responsável por uma tarefa.
 *
 * Ninguém é avisado de que atribuiu a si mesmo — o e-mail contaria à pessoa
 * algo que ela acabou de fazer.
 */
export async function avisarAtribuicao(taskId: string, quemAtribuiuId: string) {
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: {
      assignee: { select: { id: true, name: true, email: true, emailOnAssign: true } },
      project: { select: { key: true, name: true } },
      status: { select: { name: true } },
    },
  });

  if (!task?.assignee) return;
  if (task.assignee.id === quemAtribuiuId) return;
  if (!task.assignee.emailOnAssign) return;

  const quem = await db.user.findUnique({
    where: { id: quemAtribuiuId },
    select: { name: true },
  });

  const ref = `${task.project.key}-${task.number}`;
  const detalhes = [
    `Projeto: ${task.project.name}`,
    `Status: ${task.status.name}`,
    `Prioridade: ${PRIORIDADE[task.priority] ?? task.priority}`,
    task.dueDate ? `Prazo: ${formatDate(task.dueDate)}` : null,
  ].filter(Boolean);

  await enviarUmaVez(
    task.assignee.id,
    "assign",
    // a chave inclui quem atribuiu: reatribuir depois é um aviso novo
    `assign:${task.id}:${quemAtribuiuId}`,
    {
      para: task.assignee.email,
      assunto: `${ref}: ${task.title}`,
      titulo: `${quem?.name ?? "Alguém"} atribuiu uma tarefa a você`,
      corpo: [
        `<strong>${ref} · ${task.title}</strong>`,
        detalhes.join(" · "),
        task.description ? task.description.slice(0, 300) : "",
      ].filter(Boolean),
      botao: { texto: "Abrir a tarefa", url: linkDaTarefa(task.id) },
    },
  );
}

/** O stakeholder decidiu: quem pediu a aprovação precisa saber. */
export async function avisarDecisaoDeAprovacao(approvalId: string) {
  const approval = await db.approval.findUnique({
    where: { id: approvalId },
    include: {
      requestedBy: { select: { id: true, name: true, email: true, emailOnApproval: true } },
      task: { include: { project: { select: { key: true } } } },
    },
  });

  if (!approval?.requestedBy || !approval.decidedAt) return;
  if (!approval.requestedBy.emailOnApproval) return;

  const aprovado = approval.status === "APPROVED";
  const ref = `${approval.task.project.key}-${approval.task.number}`;

  await enviarUmaVez(
    approval.requestedBy.id,
    "approval",
    `approval:${approval.id}`,
    {
      para: approval.requestedBy.email,
      assunto: `${aprovado ? "Aprovado" : "Reprovado"} — ${ref}: ${approval.task.title}`,
      titulo: `${approval.approverName ?? "O aprovador"} ${aprovado ? "aprovou" : "reprovou"} sua entrega`,
      corpo: [
        `<strong>${ref} · ${approval.task.title}</strong>`,
        approval.approverComment
          ? `Comentário: “${approval.approverComment}”`
          : "Sem comentário.",
      ],
      botao: { texto: "Ver a tarefa", url: linkDaTarefa(approval.task.id) },
    },
  );
}

/**
 * Resumo diário: o que vence hoje e o que já passou do prazo.
 *
 * Um e-mail por pessoa, não um por tarefa. Dez tarefas atrasadas viram dez
 * e-mails ignorados; viram um, viram uma lista que se lê.
 */
export async function enviarResumoDiario() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);
  const dia = hoje.toISOString().slice(0, 10);

  const pessoas = await db.user.findMany({
    where: { emailDailyDigest: true },
    select: { id: true, name: true, email: true },
  });

  let enviados = 0;

  for (const pessoa of pessoas) {
    const tarefas = await db.task.findMany({
      where: {
        assigneeId: pessoa.id,
        archived: false,
        dueDate: { lt: amanha },
        status: { category: { notIn: ["DONE", "CANCELED"] } },
      },
      include: { project: { select: { key: true } } },
      orderBy: { dueDate: "asc" },
      take: 25,
    });

    if (tarefas.length === 0) continue;

    const atrasadas = tarefas.filter((t) => t.dueDate && t.dueDate < hoje);
    const paraHoje = tarefas.filter((t) => t.dueDate && t.dueDate >= hoje);

    const lista = (titulo: string, itens: typeof tarefas) =>
      itens.length
        ? `<strong>${titulo}</strong><br />` +
          itens
            .map(
              (t) =>
                `• ${t.project.key}-${t.number} — ${t.title}${
                  t.dueDate ? ` (${formatDate(t.dueDate)})` : ""
                }`,
            )
            .join("<br />")
        : "";

    const enviado = await enviarUmaVez(pessoa.id, "digest", `digest:${dia}`, {
      para: pessoa.email,
      assunto:
        atrasadas.length > 0
          ? `${atrasadas.length} tarefa(s) atrasada(s) no Beni`
          : `${paraHoje.length} tarefa(s) vencem hoje`,
      titulo: "Seu dia no Beni",
      corpo: [lista("Atrasadas", atrasadas), lista("Vencem hoje", paraHoje)].filter(Boolean),
      botao: { texto: "Ver minhas tarefas", url: `${appUrl()}/my-tasks` },
      rodape: "Resumo enviado uma vez por dia.",
    });

    if (enviado) enviados += 1;
  }

  return { pessoas: pessoas.length, enviados };
}
