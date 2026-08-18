import { notFound } from "next/navigation";
import {
  carregarPainel,
  donoDaCarteira,
  podeVerCobrancas,
  projetoDaCarteira,
  type Filtro,
} from "@/server/cobrancas";
import { CobrancasPainel } from "@/components/cobrancas/painel";

export const metadata = { title: "Cobranças" };
export const dynamic = "force-dynamic";

const FILTROS: Filtro[] = ["abertas", "atrasadas", "pagas", "todas"];

export default async function CobrancasDoProjetoPage({
  params,
  searchParams,
}: PageProps<"/p/[projectId]/cobrancas">) {
  // mesma regra da caixa de feedback e da telemetria. `notFound()` corta antes
  // de qualquer consulta, então quem não administra não recebe **nenhum** dado
  // — nem nome de cliente, nem valor.
  //
  // O que ele ainda vê, se digitar a URL, é o título da aba: `metadata` é
  // estático e o Next resolve antes de a página rodar. Sumir com a existência
  // da rota exigiria middleware, e as outras duas páginas administrativas se
  // comportam exatamente assim — a inconsistência seria pior que o vazamento,
  // que é o nome de uma tela.
  if (!(await podeVerCobrancas())) notFound();

  const { projectId } = await params;
  const projeto = await projetoDaCarteira(projectId).catch(() => null);
  if (!projeto) notFound();

  const sp = await searchParams;
  const bruto = typeof sp.filtro === "string" ? sp.filtro : "abertas";
  const filtro = (FILTROS as string[]).includes(bruto)
    ? (bruto as Filtro)
    : "abertas";
  const clienteId = typeof sp.cliente === "string" ? sp.cliente : null;

  const dono = await donoDaCarteira();
  return (
    <CobrancasPainel
      dados={await carregarPainel(dono.id, projeto.id, filtro, clienteId)}
      projeto={projeto}
    />
  );
}
