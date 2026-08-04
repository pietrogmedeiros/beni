import { notFound } from "next/navigation";
import { loadPublicApproval } from "@/server/actions/approvals";
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

  return <ApprovalScreen token={token} approval={approval} />;
}
