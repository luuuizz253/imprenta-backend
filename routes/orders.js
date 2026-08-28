const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { nanoid } = require("nanoid");
const { PDFDocument } = require("pdf-lib");
const db = require("../db");
const { calcularPrecio } = require("../pricing");
const { estadoActual } = require("../horarios");

const router = express.Router();

const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${nanoid(12)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const permitidos = [".pdf", ".jpg", ".jpeg", ".png"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!permitidos.includes(ext)) {
      return cb(new Error("Formato no permitido. Solo PDF, JPG o PNG."));
    }
    cb(null, true);
  },
});

// --- Simular precio antes de subir ---
router.post("/cotizar", express.json(), (req, res) => {
  try {
    const { tipoPapel, tamanoPapel, tamanoFoto, color, copias, dobleFaz, paginas } = req.body;
    const resultado = calcularPrecio({
      tipoPapel,
      tamanoPapel,
      tamanoFoto,
      color: !!color,
      copias,
      dobleFaz: !!dobleFaz,
      paginas,
    });
    res.json(resultado);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

async function contarPaginas(rutaArchivo) {
  const ext = path.extname(rutaArchivo).toLowerCase();
  if (ext !== ".pdf") return 1;
  try {
    const bytes = fs.readFileSync(rutaArchivo);
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    return Math.max(1, pdfDoc.getPageCount());
  } catch (e) {
    console.error("No se pudo contar páginas del PDF, se asume 1:", e.message);
    return 1;
  }
}

// --- Crear pedido ---
router.post("/", upload.single("archivo"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Falta el archivo" });

    const {
      nombreCliente,
      telefonoCliente,
      tipoPapel,
      tamanoPapel,
      tamanoFoto,
      orientacion,
      color,
      copias,
      dobleFaz,
      metodoPago,
    } = req.body;

    // Chequeo de horario: se valida siempre en el servidor, no solo en el navegador,
    // para que nadie pueda saltearse el bloqueo.
    const estado = estadoActual(tipoPapel);
    if (!estado.permitido) {
      return res.status(403).json({ error: estado.motivo });
    }

    const esColor = color === "true" || color === true;
    const esDobleFaz = (dobleFaz === "true" || dobleFaz === true) && tipoPapel === "comun";
    const cantCopias = Math.max(1, parseInt(copias, 10) || 1);

    if (esDobleFaz && tipoPapel !== "comun") {
      return res.status(400).json({ error: "Doble faz solo disponible para papel común" });
    }

    const cantPaginas = (tipoPapel === "comun")
      ? await contarPaginas(path.join(uploadDir, req.file.filename))
      : 1;

    const { total, impresora } = calcularPrecio({
      tipoPapel,
      tamanoPapel,
      tamanoFoto,
      color: esColor,
      copias: cantCopias,
      dobleFaz: esDobleFaz,
      paginas: cantPaginas,
    });

    const id = nanoid(14);
    const estadoInicial = metodoPago === "efectivo" ? "pendiente_efectivo" : "pendiente_pago";
    const orientacionFinal = orientacion === "horizontal" ? "horizontal" : "vertical";

    db.prepare(`
      INSERT INTO pedidos (
        id, nombre_cliente, telefono_cliente, archivo_original, archivo_path,
        tipo_papel, tamano_papel, tamano_foto, orientacion, paginas, color, copias, doble_faz,
        impresora_destino, precio_total, metodo_pago, estado
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id,
      nombreCliente || null,
      telefonoCliente || null,
      req.file.originalname,
      req.file.filename,
      tipoPapel,
      tamanoPapel || null,
      tamanoFoto || null,
      orientacionFinal,
      cantPaginas,
      esColor ? 1 : 0,
      cantCopias,
      esDobleFaz ? 1 : 0,
      impresora,
      total,
      metodoPago,
      estadoInicial
    );

    res.json({ id, precioTotal: total, impresora, estado: estadoInicial });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

router.get("/:id", (req, res) => {
  const pedido = db.prepare("SELECT * FROM pedidos WHERE id = ?").get(req.params.id);
  if (!pedido) return res.status(404).json({ error: "No encontrado" });
  res.json(pedido);
});

router.get("/", (req, res) => {
  const { estado } = req.query;
  let pedidos;
  if (estado) {
    pedidos = db.prepare("SELECT * FROM pedidos WHERE estado = ? ORDER BY creado_en DESC").all(estado);
  } else {
    pedidos = db.prepare("SELECT * FROM pedidos ORDER BY creado_en DESC").all();
  }
  res.json(pedidos);
});

router.post("/:id/aprobar", express.json(), (req, res) => {
  const pedido = db.prepare("SELECT * FROM pedidos WHERE id = ?").get(req.params.id);
  if (!pedido) return res.status(404).json({ error: "No encontrado" });
  db.prepare("UPDATE pedidos SET estado = 'aprobado' WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

function checkAgentAuth(req, res, next) {
  const key = req.headers["x-agent-key"];
  if (key !== process.env.AGENT_API_KEY) {
    return res.status(401).json({ error: "No autorizado" });
  }
  next();
}

router.get("/agente/pendientes", checkAgentAuth, (req, res) => {
  const pedidos = db.prepare("SELECT * FROM pedidos WHERE estado = 'aprobado' ORDER BY creado_en ASC").all();
  res.json(pedidos);
});

router.get("/agente/:id/archivo", checkAgentAuth, (req, res) => {
  const pedido = db.prepare("SELECT * FROM pedidos WHERE id = ?").get(req.params.id);
  if (!pedido) return res.status(404).json({ error: "No encontrado" });
  const filePath = path.join(uploadDir, pedido.archivo_path);
  res.download(filePath, pedido.archivo_original);
});

router.post("/agente/:id/impreso", checkAgentAuth, express.json(), (req, res) => {
  db.prepare("UPDATE pedidos SET estado = 'impreso', impreso_en = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
