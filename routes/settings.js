const express = require("express");
const {
  leerConfig,
  guardarConfig,
  estadoActual,
  HORARIO_GENERAL_DEFAULT,
  HORARIO_ADHESIVO_DEFAULT,
} = require("../horarios");

const router = express.Router();
router.use(express.json());

// El cliente consulta esto antes de dejar confirmar un pedido.
// ?tipoPapel=adhesivo para chequear también el horario específico de adhesivo.
router.get("/estado", (req, res) => {
  const resultado = estadoActual(req.query.tipoPapel || null);
  res.json(resultado);
});

// Para mostrar los valores actuales en el panel admin
router.get("/horarios", (req, res) => {
  res.json({
    general: leerConfig("horario_general", HORARIO_GENERAL_DEFAULT),
    adhesivo: leerConfig("horario_adhesivo", HORARIO_ADHESIVO_DEFAULT),
  });
});

// El dueño guarda los horarios nuevos desde el panel admin
router.post("/horarios", (req, res) => {
  try {
    const { general, adhesivo } = req.body;
    if (general) guardarConfig("horario_general", general);
    if (adhesivo) guardarConfig("horario_adhesivo", adhesivo);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
