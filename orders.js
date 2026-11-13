const { json, sb, requireAdmin } = require("../_lib");

const allowed = ["awaiting_payment", "paid", "processing", "shipped", "delivered", "cancelled", "payment_failed", "refunded", "chargeback"];

module.exports = async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return json(res, 401, { error: "Acesso administrativo não autorizado." });

    if (req.method === "GET") {
      const rows = await sb("orders?select=*&order=created_at.desc&limit=100");
      return json(res, 200, rows);
    }
    if (req.method === "PATCH") {
      const { id, status } = req.body || {};
      if (!id || !allowed.includes(status)) return json(res, 400, { error: "Pedido ou status inválido." });
      const rows = await sb(`orders?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      return json(res, 200, rows);
    }
    res.setHeader("Allow", "GET, PATCH");
    return json(res, 405, { error: "Método não permitido." });
  } catch (error) {
    console.error(error);
    return json(res, error.status || 500, { error: error.message || "Erro interno." });
  }
};
