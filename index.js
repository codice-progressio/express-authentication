const app = require("express")()
const cors = require("cors")
const colores = require("colors")

const configuraciones = {
  cors: {
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    preflightContinue: false,
    optionsSuccessStatus: 204,
  },

  debug: false,
}

/**
 *Arreglo de mensajes
 *
 * @param {*} mensajes
 */
function log(mensajes) {
  if (configuraciones.debug)
    console.log(
      colores.cyan("[ codice-security ]"),
      ...mensajes.map(x => colores.green(x))
    )
}

/**
 *
 * Configuracion básica para funcionamiento con cors.
 * @param {*} conf
 * @returns Libreria cors configurada para aplicar a un middleware directamente
 */
module.exports.basico = function (conf = configuraciones) {
  let c = conf?.cors ?? {}

  log(["Seguridad establecida: ", c])
  app.use(cors(c))
  return app
}

module.exports.configuraciones = configuraciones
