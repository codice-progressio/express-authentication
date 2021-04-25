const colores = require("colors")
const configuraciones = require("./configuraciones")
/**
 *Arreglo de mensajes
 *
 * @param {*} mensajes
 */
module.exports.log = function (...mensajes) {
  if (configuraciones.debug)
    console.log(
      colores.cyan("[ codice-security ]"),
      ...mensajes.map(x => colores.green(x))
    )
}
