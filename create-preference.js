const { json, sb } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Use POST." });

  try {
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return json(res, 503, { error: "Mercado Pago ainda não foi configurado." });
    }

    const { items, buyer, shipping } = req.body || {};
    if (!Array.isArray(items) || items.length < 1 || items.length > 30) {
      return json(res, 400, { error: "Carrinho inválido." });
    }
    if (!buyer?.name || !buyer?.email || !buyer?.phone || !shipping?.postal_code ||
        !shipping?.street || !shipping?.number || !shipping?.city || !shipping?.state) {
      return json(res, 400, { error: "Preencha seus dados e endereço de entrega." });
    }

    const ids = [...new Set(items.map(x => String(x.id || "")))];
    if (ids.some(id => !/^[0-9a-f-]{36}$/i.test(id))) {
      return json(res, 400, { error: "Produto inválido no carrinho." });
    }

    const products = await sb(
      `products?select=id,name,price,stock,active& id=in.(${ids.join(",")})`.replace("& ", "&")
    );
    if (!products || products.length !== ids.length) {
      return json(res, 400, { error: "Um ou mais produtos não estão disponíveis." });
    }

    const normalized = [];
    for (const item of items) {
      const product = products.find(p => p.id === item.id);
      const qty = Math.floor(Number(item.quantity));
      if (!product || product.active !== true || !Number.isInteger(qty) || qty < 1 || qty > 20) {
        return json(res, 400, { error: "Quantidade ou produto inválido." });
      }
      if (Number(product.stock) < qty) {
        return json(res, 409, { error: `Estoque insuficiente para ${product.name}.` });
      }
      normalized.push({ product, quantity: qty });
    }

    const total = normalized.reduce((sum, x) => sum + Number(x.product.price) * x.quantity, 0);
    if (!Number.isFinite(total) || total <= 0) return json(res, 400, { error: "Total inválido." });

    const siteUrl = (process.env.SITE_URL || `https://${req.headers.host}`).replace(/\/$/, "");
    const orderRows = await sb("orders", {
      method: "POST",
      body: JSON.stringify([{
        customer_id: null,
        customer_name: String(buyer.name).slice(0, 120),
        customer_email: String(buyer.email).slice(0, 180),
        customer_phone: String(buyer.phone).slice(0, 40),
        shipping_address: shipping,
        total,
        status: "awaiting_payment",
        payment_status: "pending"
      }])
    });
    const order = orderRows[0];

    await sb("order_items", {
      method: "POST",
      body: JSON.stringify(normalized.map(x => ({
        order_id: order.id,
        product_id: x.product.id,
        product_name: x.product.name,
        quantity: x.quantity,
        unit_price: Number(x.product.price),
        subtotal: Number(x.product.price) * x.quantity
      })))
    });

    const preference = {
      external_reference: order.id,
      notification_url: `${siteUrl}/api/mercadopago-webhook`,
      back_urls: {
        success: `${siteUrl}/?pagamento=sucesso`,
        pending: `${siteUrl}/?pagamento=pendente`,
        failure: `${siteUrl}/?pagamento=falhou`
      },
      auto_return: "approved",
      payer: {
        name: String(buyer.name).slice(0, 120),
        email: String(buyer.email).slice(0, 180),
        phone: { number: String(buyer.phone).replace(/\D/g, "") }
      },
      items: normalized.map(x => ({
        id: x.product.id,
        title: x.product.name,
        quantity: x.quantity,
        currency_id: "BRL",
        unit_price: Number(x.product.price)
      })),
      metadata: { order_id: order.id }
    };

    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(preference)
    });
    const mpData = await mpResponse.json();
    if (!mpResponse.ok || !mpData.init_point) {
      await sb(`orders?id=eq.${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "payment_error" })
      });
      console.error("Mercado Pago:", mpData);
      return json(res, 502, { error: "Não foi possível iniciar o pagamento. Confira as credenciais do Mercado Pago." });
    }

    await sb(`orders?id=eq.${order.id}`, {
      method: "PATCH",
      body: JSON.stringify({ payment_preference_id: mpData.id })
    });

    return json(res, 200, { checkout_url: mpData.init_point, order_id: order.id });
  } catch (error) {
    console.error(error);
    return json(res, error.status || 500, { error: error.message || "Erro interno ao criar pedido." });
  }
};
