// =========================================================
// TABLA DE PRECIOS - EDITÁ ESTOS VALORES SEGÚN TUS COSTOS
// Todos los precios están en ARS (pesos argentinos)
// =========================================================

const PRECIO_PAPEL_COMUN = {
  A4:     { bn: 50,  color: 150 },
  Carta:  { bn: 50,  color: 150 },
  Oficio: { bn: 60,  color: 170 },
};

const PRECIO_PAPEL_FOTO = {
  "5x5":   { bn: 300,  color: 350 },
  "10x15": { bn: 450,  color: 550 },
  "13x18": { bn: 700,  color: 850 },
  "21x29": { bn: 500,  color: 500 }, // A4 fotográfico
};

// Papel adhesivo: precio por hoja
const PRECIO_PAPEL_ADHESIVO = {
  A4: { bn: 300, color: 450 },
};

const FACTOR_DOBLE_FAZ = 0.8;

// Regla simple: fotos y adhesivo → L380. Documentos/papel común → L6490.
function elegirImpresora({ tipoPapel }) {
  if (tipoPapel === "foto" || tipoPapel === "adhesivo") return "L380";
  return "L6490";
}

function calcularPrecio({ tipoPapel, tamanoPapel, tamanoFoto, color, copias, dobleFaz, paginas }) {
  copias = Number(copias) || 1;
  paginas = Number(paginas) || 1;
  let precioUnitario;

  if (tipoPapel === "foto") {
    const tabla = PRECIO_PAPEL_FOTO[tamanoFoto];
    if (!tabla) throw new Error("Tamaño de foto inválido");
    precioUnitario = color ? tabla.color : tabla.bn;
    return { precioUnitario, total: precioUnitario * copias, impresora: elegirImpresora({ tipoPapel }) };
  }

  if (tipoPapel === "adhesivo") {
    const tabla = PRECIO_PAPEL_ADHESIVO[tamanoPapel] || PRECIO_PAPEL_ADHESIVO.A4;
    precioUnitario = color ? tabla.color : tabla.bn;
    return { precioUnitario, total: precioUnitario * copias, impresora: elegirImpresora({ tipoPapel }) };
  }

  // papel común / documento
  const tabla = PRECIO_PAPEL_COMUN[tamanoPapel];
  if (!tabla) throw new Error("Tamaño de papel inválido");
  precioUnitario = color ? tabla.color : tabla.bn;

  let costoPorCopia;
  if (dobleFaz) {
    const paresCompletos = Math.floor(paginas / 2);
    const hojaImpar = paginas % 2;
    const precioParDeCaras = precioUnitario + precioUnitario * FACTOR_DOBLE_FAZ;
    costoPorCopia = paresCompletos * precioParDeCaras + hojaImpar * precioUnitario;
  } else {
    costoPorCopia = paginas * precioUnitario;
  }

  const total = costoPorCopia * copias;
  const impresora = elegirImpresora({ tipoPapel });
  return { precioUnitario, total: Math.round(total), impresora };
}

module.exports = { calcularPrecio, elegirImpresora, PRECIO_PAPEL_COMUN, PRECIO_PAPEL_FOTO, PRECIO_PAPEL_ADHESIVO };
﻿

