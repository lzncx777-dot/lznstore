const crypto = require("crypto");
const { json, sb } = require("./_lib");

function validSignature(req, paymentId) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return false;
  const signature = req.headers["x-signature"] || "";
  const requestId = req.headers["x-request-id"] || "";
  const parts = Object.fromEntries(signature.split(",").map(p => p.trim().split("=")));
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1 || !requestId || !paymentId) return false;
  const manifest = `id:${String(paymentId).toLowerCase()};request-id:${requestId};ts:${ts};`;
  const digest = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(v1));
  } catch { return false; }
}

module.exports = async (req, res) => {
  if (req.method !== "POST" && req.method !== "GET") return json(res, 405, { error: "Método não permitido." });
  try {
    const paymentId = req.query?.["data.id"] || req.body?.data?.id || req.body?.id;
    if (!paymentId) return json(res, 200, { received: true });

    // Mercado Pago pode enviar notificações de teste sem assinatura; em produção,
    // configure o segredo e valide a assinatura antes de aceitar a notificação.
    if (process.env.MERCADOPAGO_WEBHOOK_SECRET && !validSignature(req, paymentId)) {
      return json(res, 401, { error: "Assinatura inválida." });
    }

    const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` }
    });
    const payment = await response.json();
    if (!response.ok) return json(res, 200, { received: true });

    const orderId = payment.external_reference || payment.metadata?.order_id;
    if (!orderId) return json(res, 200, { received: true });

    const statusMap = {
      approved: ["paid", "approved"],
      pending: ["awaiting_payment", "pending"],
      in_process: ["awaiting_payment", "pending"],
      rejected: ["payment_failed", "rejected"],
      cancelled: ["cancelled", "cancelled"],
      refunded: ["refunded", "refunded"],
      charged_back: ["chargeback", "charged_back"]
    };
    const [status, payment_status] = statusMap[payment.status] || ["awaiting_payment", String(payment.status || "unknown")];

    await sb(`orders?id=eq.${encodeURIComponent(orderId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status,
        payment_status,
        payment_id: String(payment.id),
        payment_method: payment.payment_method_id || null
      })
    });
    return json(res, 200, { received: true });
  } catch (error) {
    console.error("Webhook:", error);
    return json(res, 200, { received: true });
  }
};
