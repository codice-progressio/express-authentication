const colores = require("colors")
const configuraciones = {
  cors: {
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    preflightContinue: false,
    optionsSuccessStatus: 204,
  },
  debug: false,
  jwt: {
    private_key: undefined,
    //Expresado en segundos
    expiresIn: 3600,
    decode: {
      unless: ["/login"],
      /*
      Es posible que desee utilizar este módulo para identificar a los usuarios 
      registrados y, al mismo tiempo, brindar acceso a los usuarios no 
      registrados.Puede hacer esto usando la opción credentialsRequired:
      */
      credentialsRequired: true,
      requestProperty: "usuario",
    },
  },

  validaciones: {
    jwt: validarJwt,
    errores: { jwt: validaciones },
  },
}

function validaciones(err, res) {
  if (err.name === "UnauthorizedError")
    return { status: 401, send: { error: "No autorizado" } }
  return null
}

function validarJwt() {
  //Debe estar definida la private_key
  if (!configuraciones.jwt.private_key) {
    var msj = [
      "[ codice-security ] ",
      " No se ha definido la clave privada. Debes hacerlo en las configuraciones: `configuraciones.jwt.private_key`",
      " IMPOSIBLE GENERAR TOKEN",
    ]

    var texto = colores.bgRed(msj[0]) + msj[1] + colores.yellow(msj[2])
    throw new Error(texto)
  }
}

module.exports = configuraciones
