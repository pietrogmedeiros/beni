import { notFound } from "next/navigation";
import { currentVisitor, loadSharedGantt } from "@/server/actions/share";
import { SharedGanttScreen } from "./shared-gantt-screen";

export const metadata = {
  title: "Cronograma compartilhado",
  robots: { index: false, follow: false },
};

export default async function SharedGanttPage({
  params,
}: PageProps<"/compartilhar/[token]">) {
  const { token } = await params;
  const [data, visitor] = await Promise.all([
    loadSharedGantt(token),
    currentVisitor(),
  ]);
  if (!data) notFound();

  return <SharedGanttScreen token={token} data={data} visitor={visitor} />;
}
