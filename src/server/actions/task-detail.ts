"use server";

import { getTaskDetail } from "@/server/queries";

export async function loadTaskDetail(taskId: string) {
  return getTaskDetail(taskId);
}
