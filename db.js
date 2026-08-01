const { DatabaseSync } = require("node:sqlite");
const path = require("path");

const db = new DatabaseSync(path.join(__dirname, "imprenta.db"));

db.exec(`
CREATE TABLE IF NOT EXISTS pedidos (
  id TEXT PRIMARY KEY,
  nombre_cliente TEXT,
  telefono_cliente TEXT,
  archivo_original TEXT NOT NULL,
  archivo_path TEXT NOT NULL,
  tipo_papel TEXT NOT NULL,        -- 'comun' | 'foto'
  tamano_papel TEXT,               -- A4 | Carta | Oficio (si es comun)
  tamano_foto TEXT,                -- 5x5 | 10x15 | 13x18 | 21x29 (si es foto)
  color INTEGER NOT NULL,          -- 1 = color, 0 = blanco y negro
  copias INTEGER NOT NULL,
  doble_faz INTEGER NOT NULL DEFAULT 0,
  impresora_destino TEXT NOT NULL, -- L380 | L6490
  precio_total INTEGER NOT NULL,
  metodo_pago TEXT NOT NULL,       -- 'mercadopago' | 'efectivo'
  estado TEXT NOT NULL DEFAULT 'pendiente_pago', 
  -- estados: pendiente_pago | pendiente_efectivo | aprobado | impreso | cancelado
  mp_payment_id TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  impreso_en TEXT
);
`);

module.exports = db;
