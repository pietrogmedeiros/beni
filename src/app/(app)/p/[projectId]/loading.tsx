import { Skeleton } from "@/components/ui/skeleton";

/**
 * Trocar de visão dentro do projeto (Lista → Quadro → Gantt) é o movimento
 * mais repetido do app. Esta fronteira mantém o cabeçalho do projeto na tela
 * e troca só o miolo, então a navegação responde na hora mesmo quando o
 * servidor demora a devolver.
 */
export default function ProjectViewLoading() {
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex gap-2">
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="h-8 w-36 rounded-lg" />
        <Skeleton className="ml-auto h-8 w-24 rounded-lg" />
      </div>

      <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, col) => (
          <div key={col} className="space-y-2">
            <Skeleton className="h-6 w-28" />
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton
                key={i}
                className="h-20 w-full rounded-lg"
                style={{ opacity: 1 - (col * 3 + i) * 0.06 }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
