"use server";

import { searchTasks } from "@/server/queries";
import type { TaskDTO } from "@/server/queries";

export async function searchAction(term: string): Promise<TaskDTO[]> {
  if (!term.trim()) return [];
  return searchTasks(term.trim());
}
