import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

type AuditInput = {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
};

/** Registra operações importantes em audit_logs. Nunca derruba a operação principal. */
export async function audit(input: AuditInput) {
  try {
    await createAdminClient()
      .from("audit_logs")
      .insert({
        actor_id: input.actorId ?? null,
        action: input.action,
        entity: input.entity,
        entity_id: input.entityId ?? null,
        details: input.details ?? null,
      });
  } catch (error) {
    console.error("[audit] falha ao registrar log", error);
  }
}
