const colores = require("colors");

let _RUTA_USUARIO = "/usuario";
let _UNLESS = [
  "/login",
  "/crear-administrador",
  "/confirmar",
  "/recuperar-password-email",
  "/generar-link-recuperar-password",
]

const configuraciones = {
  ruta_usuario: (ruta) => {
    if (ruta) _RUTA_USUARIO = ruta;
    return _RUTA_USUARIO;
  },
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
      _unless: _UNLESS,
      get unless()
      {
        return this._unless.map(p=> _RUTA_USUARIO + p)
      },
      set unless(value)
      {
        this._unless = value;
      },
      /*
      Es posible que desee utilizar este módulo para identificar a los usuarios 
      registrados y, al mismo tiempo, brindar acceso a los usuarios no 
      registrados.Puede hacer esto usando la opción credentialsRequired:
      */
      credentialsRequired: true,
      requestProperty: "user",
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
        select: false,
      },
      inhabilitado: { type: Boolean, default: false },
      email_validado: {
        type: {
          codigo: String,
          validado: { type: Boolean, default: false },
          recuperar_contrasena: { type: Boolean, default: false },
          intentos: { type: Number, default: 0 },
          intento_hora: Date,
          bloqueado: { default: false, type: Boolean },
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
    dominio_recuperacion: undefined,
    nombre_aplicacion: undefined,
  },

  permisos: {
    leer_todo: {
      permiso: "usuario:leer:todo",
      descripcion: "Leer todos los usuarios registrados en el sistema. ",
    },

    login: {
      permiso: "login",
      descripcion: "Iniciar sesión en el sistema",
    },
    crear_usuario: {
      permiso: "usuario:crear",
      descripcion: "Crear un nuevo usuario",
    },

    agregar_permiso: {
      permiso: "usuario:modificar:agregar-permiso",
      descripcion: "Crea un nuevo permiso al usuario",
    },

    eliminar_permiso: {
      permiso: "usuario:modificar:eliminar-permiso",
      descripcion: "Elimina un permiso del usuario",
    },

    inhabilitar_usuario: {
      permiso: "usuario:modificar:inhabilitar",
      descripcion: "Deshabilita al usuario ",
    },

    administrador: {
      permiso: "administrador",
      descripcion: "Permisos de administrador",
    },
  },

  easy_permissions: require("@codice-progressio/easy-permissions"),
  easy_permissions_path: {
    fichero_permiso_descripcion: () => obtenerPathFicheroPermisos(""),
    fichero_permiso_permiso: () => obtenerPathFicheroPermisos("_"),
  },
};

function obtenerPathFicheroPermisos(n) {
  let config = configuraciones.easy_permissions.configuraciones;
  let path = config.path;
  let carpeta = config.nombreCarpetaPermisos;
  let archivo = n + config.nombreArchivoPermisos;
  return `${path}/${carpeta}/${archivo}`;
}

function validaciones(err) {
  if (err.name === "UnauthorizedError")
    return { status: 401, send: { error: "No autorizado" } };
  return null;
}

function validarJwt() {
  //Debe estar definida la private_key
  if (!configuraciones.jwt.private_key) {
    var msj = [
      "[ codice-security ] ",
      " No se ha definido la clave privada. Debes hacerlo en las configuraciones: `configuraciones.jwt.private_key`",
      " IMPOSIBLE GENERAR TOKEN",
    ];

    var texto = colores.bgRed(msj[0]) + msj[1] + colores.yellow(msj[2]);
    throw new Error(texto);
  }
}

module.exports = configuraciones;
