const app = require("express")()
const cors = require("cors")
const configuraciones = require("./configuraciones")
const log = require("./utilidades").log
const jwt = require("jsonwebtoken")

/**
 *
 * Configuracion básica para funcionamiento con cors.
 * @param {*} conf
 * @returns Libreria cors configurada para aplicar a un middleware directamente
 */
module.exports.basico = function (conf = configuraciones) {
  let c = conf?.cors ?? {}

  log("Seguridad establecida: ", c)
  app.use(cors(c))
  return app
}

module.exports.token = {
  generar: objeto => {
    return new Promise((resolve, reject) => {
      configuraciones.validaciones.jwt()
      jwt.sign(
        objeto,
        configuraciones.jwt.private_key,
        { expiresIn: configuraciones.jwt.expiresIn },
        function (err, token) {
          if (err) return reject(err)
          resolve(token)
        }
      )
    })
  },
}

module.exports.configuraciones = configuraciones
