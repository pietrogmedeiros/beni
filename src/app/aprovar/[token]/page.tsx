import { notFound } from "next/navigation";
import { loadPublicApproval } from "@/server/actions/approvals";
import { publicAttachments } from "@/server/actions/attachments";
import { ApprovalScreen } from "./approval-screen";

export const metadata = {
  title: "Aprovação",
  robots: { index: false, follow: false },
};

export default async function ApprovalPage({
  params,
}: PageProps<"/aprovar/[token]">) {
  const { token } = await params;
  const approval = await loadPublicApproval(token);
  if (!approval) notFound();

  // o aprovador precisa ver o que está aprovando: fotos e vídeos entram na
  // própria página, sem conta e sem download
  const attachments = await publicAttachments(approval.task.id, token);

  return (
    <ApprovalScreen
      token={token}
      approval={approval}
      attachments={attachments}
    />
  );
}
