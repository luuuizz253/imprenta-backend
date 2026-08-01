// =========================================================
// TABLA DE PRECIOS - EDITÁ ESTOS VALORES SEGÚN TUS COSTOS
// Todos los precios están en ARS (pesos argentinos)
// =========================================================

// Papel común (documentos): precio por hoja
const PRECIO_PAPEL_COMUN = {
  A4:     { bn: 50,  color: 100 },
  Carta:  { bn: 50,  color: 100 },
  Oficio: { bn: 60,  color: 170 },
};

// Papel fotográfico: precio por copia (según tamaño)
// La foto en B&N normalmente casi no se usa, pero se deja habilitado por si acaso.
const PRECIO_PAPEL_FOTO = {
  "5x5":   { bn: 30,  color: 35 },
  "10x15": { bn: 120,  color: 130 },
  "13x18": { bn: 400,  color: 450 },
  "21x29": { bn: 500,  color: 500 }, // A4 fotográfico
};

// Descuento en la segunda cara cuando se imprime a doble faz (solo L6490)
const FACTOR_DOBLE_FAZ = 0.8; // la 2da cara sale al 80% del precio de una hoja

// Regla simple: fotos → L380. Documentos/papel común (y doble faz) → L6490.
function elegirImpresora({ tipoPapel }) {
  if (tipoPapel === "foto") return "L380";
  return "L6490";
}

function calcularPrecio({ tipoPapel, tamanoPapel, tamanoFoto, color, copias, dobleFaz }) {
  copias = Number(copias) || 1;
  let precioUnitario;

  if (tipoPapel === "foto") {
    const tabla = PRECIO_PAPEL_FOTO[tamanoFoto];
    if (!tabla) throw new Error("Tamaño de foto inválido");
    precioUnitario = color ? tabla.color : tabla.bn;
    // doble faz no aplica a fotos
    return { precioUnitario, total: precioUnitario * copias, impresora: elegirImpresora({ tipoPapel, tamanoFoto, dobleFaz: false }) };
  }

  // papel común / documento
  const tabla = PRECIO_PAPEL_COMUN[tamanoPapel];
  if (!tabla) throw new Error("Tamaño de papel inválido");
  precioUnitario = color ? tabla.color : tabla.bn;

  let total;
  if (dobleFaz) {
    // cada "copia" son 2 caras: 1 cara a precio normal + 1 cara al factor de descuento
    const precioParDeCaras = precioUnitario + precioUnitario * FACTOR_DOBLE_FAZ;
    total = precioParDeCaras * copias;
  } else {
    total = precioUnitario * copias;
  }

  const impresora = elegirImpresora({ tipoPapel, tamanoFoto: null, dobleFaz });
  return { precioUnitario, total: Math.round(total), impresora };
}

module.exports = { calcularPrecio, elegirImpresora, PRECIO_PAPEL_COMUN, PRECIO_PAPEL_FOTO };
