import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { response, user, supabase } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  };

  // Área do cliente exige login.
  if (pathname.startsWith("/conta") && !user) return redirectTo("/login");

  // Admin: exige login E linha em admin_users (consulta no servidor, sujeita a RLS).
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (!user) return redirectTo("/admin/login");
    const { data } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!data) return redirectTo("/admin/login");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
