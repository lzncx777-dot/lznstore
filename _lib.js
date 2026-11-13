const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(res, status, data) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

async function sb(path, options = {}) {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Supabase não configurado na Vercel.");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const error = new Error(data?.message || data?.hint || "Erro ao acessar o banco de dados.");
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

async function requireAdmin(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;

  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: process.env.SUPABASE_ANON_KEY || SERVICE_KEY, Authorization: `Bearer ${token}` }
  });
  if (!userResponse.ok) return null;
  const user = await userResponse.json();

  const profiles = await sb(`profiles?id=eq.${encodeURIComponent(user.id)}&select=id,role&limit=1`);
  if (!profiles?.[0] || profiles[0].role !== "admin") return null;
  return user;
}

function methodNotAllowed(res, methods) {
  res.setHeader("Allow", methods.join(", "));
  return json(res, 405, { error: "Método não permitido." });
}

module.exports = { json, sb, requireAdmin, methodNotAllowed };
