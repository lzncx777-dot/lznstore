import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Autorização de admin verificada no servidor. Chame no início de TODA
 * página, Server Action e rota do /admin. O middleware é só a primeira barreira.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!data) redirect("/admin/login");

  return { user, supabase };
}
