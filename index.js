const app = require("express")()
const cors = require("cors")
const configuraciones = require("./configuraciones")
const log = require("./utilidades").log
const jsonwebtoken = require("jsonwebtoken")
const express_jwt = require("express-jwt")
const usuarioModel = require("./models/usuario.model")

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
      requestProperty: configuraciones.jwt.decode.requestProperty,
      algorithms: ["HS256"],
    }).unless({
      path: configuraciones.jwt.decode.unless,
    })
  )

  log("Cargando rutas de usuario")
  app.use("/usuario", require("./routes/usuario.routes"))

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

module.exports.hash = {
  crypt: password => {
    return new Promise((resolve, reject) => {
      const bcrypt = require("bcrypt")
      const saltRounds = 10

      bcrypt.hash(password, saltRounds, function (err, hash) {
        if (err) return reject(err)
        resolve(hash)
      })
    })
  },
}

module.exports.configuraciones = configuraciones
module.exports.usuarioModel = usuarioModel
