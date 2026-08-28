const db = require("./db");

// Configuración por defecto si el dueño todavía no configuró nada:
// abierto siempre, sin restricción (para no romper nada antes de configurarlo).
const HORARIO_GENERAL_DEFAULT = {
  activo: false,       // false = sin restricción de horario general
  dias: [1, 2, 3, 4, 5], // 1=Lunes ... 7=Domingo
  horaInicio: 9,
  horaFin: 20,
};

const HORARIO_ADHESIVO_DEFAULT = {
  activo: false,       // false = papel adhesivo disponible siempre (dentro del horario general)
  dias: [1, 2, 3, 4, 5],
  horaInicio: 9,
  horaFin: 12,
};

function leerConfig(clave, porDefecto) {
  const fila = db.prepare("SELECT valor FROM configuracion WHERE clave = ?").get(clave);
  if (!fila) return porDefecto;
  try {
    return JSON.parse(fila.valor);
  } catch (e) {
    return porDefecto;
  }
}

function guardarConfig(clave, valorObjeto) {
  db.prepare(`
    INSERT INTO configuracion (clave, valor) VALUES (?, ?)
    ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor
  `).run(clave, JSON.stringify(valorObjeto));
}

// Devuelve { diaISO, hora } en la hora de Argentina, sin importar en qué
// servidor (con qué zona horaria) esté corriendo el backend.
function obtenerFechaArgentina(fecha = new Date()) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(fecha);

  const mapaDias = { Sun: 7, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  let diaISO = null;
  let hora = null;
  for (const p of partes) {
    if (p.type === "weekday") diaISO = mapaDias[p.value];
    if (p.type === "hour") hora = parseInt(p.value, 10);
  }
  return { diaISO, hora };
}

function dentroDeHorario(horario, diaISO, hora) {
  if (!horario.activo) return true; // sin restricción configurada = siempre abierto
  if (!horario.dias.includes(diaISO)) return false;
  return hora >= horario.horaInicio && hora < horario.horaFin;
}

const NOMBRES_DIA = { 1: "lunes", 2: "martes", 3: "miércoles", 4: "jueves", 5: "viernes", 6: "sábado", 7: "domingo" };

function textoHorario(horario) {
  if (!horario.activo) return "sin restricción de horario";
  const dias = horario.dias.slice().sort();
  const nombres = dias.map((d) => NOMBRES_DIA[d]);
  return `${nombres.join(", ")} de ${horario.horaInicio} a ${horario.horaFin} hs`;
}

// Chequea si el local está abierto en general Y (si corresponde) si el
// papel adhesivo está disponible en este momento. Devuelve un resultado
// listo para usar tanto en el front como para bloquear en el backend.
function estadoActual(tipoPapelPedido) {
  const horarioGeneral = leerConfig("horario_general", HORARIO_GENERAL_DEFAULT);
  const horarioAdhesivo = leerConfig("horario_adhesivo", HORARIO_ADHESIVO_DEFAULT);
  const { diaISO, hora } = obtenerFechaArgentina();

  const abiertoGeneral = dentroDeHorario(horarioGeneral, diaISO, hora);
  if (!abiertoGeneral) {
    return {
      permitido: false,
      motivo: `Estamos cerrados en este momento. Atendemos ${textoHorario(horarioGeneral)}.`,
    };
  }

  if (tipoPapelPedido === "adhesivo") {
    const abiertoAdhesivo = dentroDeHorario(horarioAdhesivo, diaISO, hora);
    if (!abiertoAdhesivo) {
      return {
        permitido: false,
        motivo: `El papel adhesivo solo se imprime ${textoHorario(horarioAdhesivo)}. Fuera de ese horario podés pedir fotos o documentos igual.`,
      };
    }
  }

  return { permitido: true, motivo: null };
}

module.exports = {
  leerConfig,
  guardarConfig,
  estadoActual,
  HORARIO_GENERAL_DEFAULT,
  HORARIO_ADHESIVO_DEFAULT,
  textoHorario,
};
