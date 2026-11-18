import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente com service role: IGNORA RLS. Use apenas em rotas de servidor
 * que já validaram a entrada (checkout, webhook). Nunca importe em componentes de cliente.
 */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
