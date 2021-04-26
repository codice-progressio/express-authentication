const app = require("express")()
const cors = require("cors")
const configuraciones = require("./configuraciones")
const log = require("./utilidades").log
const jsonwebtoken = require("jsonwebtoken")
const express_jwt = require("express-jwt")

/**
 *
 * Configuracion básica para funcionamiento con cors.
 * @param {*} configuraciones
 * @returns Libreria cors configurada para aplicar a un middleware directamente
 */
module.exports.basico = function () {
  log("Seguridad establecida: ", configuraciones.cors)
  app.use(cors(configuraciones.cors))

  log("Decodificacion de token", configuraciones.jwt.decode)
  configuraciones.validaciones.jwt()
  
  app.use(
    express_jwt({
      secret: configuraciones.jwt.private_key,
      credentilsRequired: configuraciones.jwt.decode.credentialsRequired,
      algorithms: ["HS256"],
    }).unless({
      path: configuraciones.jwt.decode.unless,
    })
  )

  return app
}

module.exports.token = {
  generar: objeto => {
    return new Promise((resolve, reject) => {
      configuraciones.validaciones.jwt()
      jsonwebtoken.sign(
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
