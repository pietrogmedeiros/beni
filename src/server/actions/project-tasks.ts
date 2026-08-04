"use server";

import { db } from "@/lib/db";
import { currentWorkspace } from "@/lib/auth";

export async function listProjectTasks(projectId: string) {
  const workspace = await currentWorkspace();
  const tasks = await db.task.findMany({
    where: {
      projectId,
      archived: false,
      project: { workspaceId: workspace.id },
    },
    select: { id: true, title: true, number: true },
    orderBy: { number: "asc" },
    take: 200,
  });
  return tasks;
}
