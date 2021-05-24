const app = require("express")()
const cors = require("cors")
const configuraciones = require("./configuraciones")
const log = require("./utilidades").log
const jsonwebtoken = require("jsonwebtoken")
const express_jwt = require("express-jwt")

module.exports.configuraciones = configuraciones

let usuarioModel = null

function generarModeloDeUsuario() {
  const mongoose = require("mongoose")
  const uniqueValidator = require("mongoose-unique-validator")
  const Schema = mongoose.Schema
  const usuarioSchema = new Schema(configuraciones.usuario.schema)

  usuarioSchema.plugin(uniqueValidator, {
    message: " El email ya esta registrado.",
  })
  usuarioModel = mongoose.model(
    configuraciones.usuario.nombre_bd,
    usuarioSchema
  )
}

/**
 *
 * Configuracion básica para funcionamiento con cors.
 * @param {*} configuraciones
 * @returns Libreria cors configurada para aplicar a un middleware directamente
 */
module.exports.basico = function () {
  // Quitamos el heder x-powered-by:express
  app.disable("x-powered-by")

  // Importa la libreria
  const easyPermissions = configuraciones.easy_permissions
  log("easy-permissions: ", easyPermissions.configuraciones)

  log("CORS: ", configuraciones.cors)
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

  generarModeloDeUsuario()

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
  crypt: password => require("bcrypt").hash(password, 10),
  compare: (password, hash) => require("bcrypt").compare(password, hash),
}

module.exports.usuarioModel = usuarioModel

module.exports.utilidades = require("./utilidades")
