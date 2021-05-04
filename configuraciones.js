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
      unless: [
        "/usuario/login",
        "/usuario/crear-administrador",
        "/usuario/confirmar",
        "/usuario/recuperar-contraseña",
      ],
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
  usuario: {
    nombre_bd: "Usuario",
    schema: {
      nombre: { type: String, min: 4 },
      email: {
        type: String,
        unique: true,
        required: [true, "El correo es necesario."],
      },
      password: {
        type: String,
        required: [true, "La contraseña es necesaria."],
        select: false,
        min: 8,
      },
      permissions: {
        type: [String],
        default: ["login"],
        select: false,
      },
      eliminado: { type: Boolean, default: false },
      email_validado: {
        type: {
          codigo: String,
          validado: { type: Boolean, default: false },
        },
        select: false,
      },
    },
  },

  correo: {
    transport: {
      host: undefined,
      port: undefined,
      auth: {
        user: "",
        pass: "",
      },
    },
    mailOptions: {
      from: undefined,
    },
    dominio: undefined,
    nombre_aplicacion: undefined,
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
