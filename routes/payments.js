const express = require("express");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const db = require("../db");

const router = express.Router();

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

// Crea una preferencia de pago para un pedido ya creado (estado pendiente_pago)
router.post("/crear-preferencia/:pedidoId", express.json(), async (req, res) => {
  try {
    const pedido = db.prepare("SELECT * FROM pedidos WHERE id = ?").get(req.params.pedidoId);
    if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });

    const preference = new Preference(client);
    const result = await preference.create({
      body: {
        items: [
          {
            title: `Pedido de impresión #${pedido.id.slice(0, 6)}`,
            quantity: 1,
            unit_price: pedido.precio_total,
            currency_id: "ARS",
          },
        ],
        external_reference: pedido.id,
        back_urls: {
          success: `${process.env.FRONTEND_URL}/gracias.html?id=${pedido.id}`,
          failure: `${process.env.FRONTEND_URL}/error.html?id=${pedido.id}`,
          pending: `${process.env.FRONTEND_URL}/pendiente.html?id=${pedido.id}`,
        },
        auto_return: "approved",
        notification_url: `${process.env.BACKEND_URL}/api/payments/webhook`,
      },
    });

    res.json({ init_point: result.init_point, preferenceId: result.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Webhook: Mercado Pago notifica cuando cambia el estado de un pago
router.post("/webhook", express.json(), async (req, res) => {
  try {
    const topic = req.query.topic || req.query.type;
    const id = req.query.id || req.body?.data?.id;

    if (topic === "payment" && id) {
      const payment = new Payment(client);
      const info = await payment.get({ id });

      if (info.status === "approved") {
        const pedidoId = info.external_reference;
        db.prepare(`
          UPDATE pedidos
          SET estado = 'aprobado', mp_payment_id = ?
          WHERE id = ? AND estado != 'impreso'
        `).run(String(info.id), pedidoId);
      }
    }
    res.sendStatus(200);
  } catch (e) {
    console.error("Error en webhook MP:", e);
    res.sendStatus(200); // igual respondemos 200 para que MP no reintente en loop
  }
});

module.exports = router;
