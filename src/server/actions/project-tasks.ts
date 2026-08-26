"use server";

import { db } from "@/lib/db";
import { filtroDeProjetos } from "@/server/escopo";
import { } from "@/lib/auth";

export async function listProjectTasks(projectId: string) {
  const tasks = await db.task.findMany({
    where: {
      projectId,
      archived: false,
      project: await filtroDeProjetos(),
    },
    select: { id: true, title: true, number: true },
    orderBy: { number: "asc" },
    take: 200,
  });
  return tasks;
}
