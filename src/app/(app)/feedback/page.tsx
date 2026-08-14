import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/server/queries";
import { listarFeedbacks, podeTriar } from "@/server/actions/feedback";
import { FeedbackInbox } from "@/components/feedback/feedback-inbox";

export const metadata = { title: "Feedback recebido" };

export default async function FeedbackPage() {
  // quem não tria não descobre nem que a página existe
  if (!(await podeTriar())) notFound();

  const [itens, ctx] = await Promise.all([listarFeedbacks(), getWorkspaceContext()]);

  return (
    <FeedbackInbox
      itens={itens}
      projetos={ctx.projects.map((p) => ({ id: p.id, name: p.name, key: p.key }))}
    />
  );
}
