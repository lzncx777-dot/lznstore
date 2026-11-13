const { json, sb, requireAdmin } = require("../_lib");

module.exports = async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return json(res, 401, { error: "Acesso administrativo não autorizado." });

    if (req.method === "GET") {
      const rows = await sb("products?select=*&order=created_at.desc");
      return json(res, 200, rows);
    }

    if (req.method === "POST" || req.method === "PATCH") {
      const p = req.body || {};
      if (!p.name || !Number.isFinite(Number(p.price)) || Number(p.price) <= 0) {
        return json(res, 400, { error: "Informe nome e preço válido." });
      }
      const data = {
        name: String(p.name).slice(0, 140),
        description: String(p.description || "").slice(0, 2000),
        category: String(p.category || "Geral").slice(0, 80),
        price: Number(p.price),
        image_url: p.image_url ? String(p.image_url).slice(0, 1000) : null,
        stock: Math.max(0, Math.floor(Number(p.stock || 0))),
        active: p.active !== false,
        supplier_url: p.supplier_url ? String(p.supplier_url).slice(0, 1000) : null
      };
      const result = req.method === "POST"
        ? await sb("products", { method: "POST", body: JSON.stringify([data]) })
        : await sb(`products?id=eq.${encodeURIComponent(p.id)}`, { method: "PATCH", body: JSON.stringify(data) });
      return json(res, 200, result);
    }

    if (req.method === "DELETE") {
      const id = req.query.id;
      if (!id) return json(res, 400, { error: "ID do produto ausente." });
      await sb(`products?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ active: false }) });
      return json(res, 200, { success: true });
    }

    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return json(res, 405, { error: "Método não permitido." });
  } catch (error) {
    console.error(error);
    return json(res, error.status || 500, { error: error.message || "Erro interno." });
  }
};
