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
  },

  validaciones: {
    jwt: validarJwt,
  },
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



