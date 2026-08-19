import { db, schema } from "../db";

export async function logActivity(input: {
  action: string;
  details?: string;
  projectId?: number | null;
  clientId?: number | null;
  userId?: number | null;
}) {
  await db.insert(schema.activities).values({
    action: input.action,
    details: input.details ?? null,
    project_id: input.projectId ?? null,
    client_id: input.clientId ?? null,
    user_id: input.userId ?? null,
  });
}
