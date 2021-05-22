const ExpressBrute = require("@codice-progressio/express-brute")
const MongooseStore = require("@codice-progressio/express-brute-mongoose")
const BruteForceSchema = require("@codice-progressio/express-brute-mongoose/dist/schema")
const mongoose = require("mongoose")

const model = mongoose.model(
  "bruteforce",
  new mongoose.Schema(BruteForceSchema)
)
const store = new MongooseStore(model)
const bruteforce = new ExpressBrute(store, {
  freeRetries: 5,
  failCallback: (req, res, next, nextValidDate) => {
    const { DateTime } = require("luxon")
    let proximaHoraValida = DateTime.fromISO(
      new Date(nextValidDate).toISOString()
    ).diffNow(["hours", "minutes", "seconds"])

    return res.send({
      mensaje: `Demasiados intentos en muy poco tiempo. Vuelve a intentarlo en ${proximaHoraValida.hours
        .toString()
        .padStart(2, "0")}:${proximaHoraValida.minutes
        .toString()
        .padStart(2, "0")}:${proximaHoraValida.seconds
        .toString()
        .padStart(2, "0")}`,
    })
  },
})

const msjError_codigo_no_valido = "El código no es valido"

function comprobarAdministradorMismoUsuario(req) {
  //Solo el mismo usuario se puede modificar estos datos
  // o si es administrador puede cambiar el de cualquiera
  const config = require("./configuraciones")
  // 1.- Saber si es administrador
  let usuarioLogueado = req[config.jwt.decode.requestProperty]
  let esAdministrador = usuarioLogueado.permissions.includes("administrador")

  if (!esAdministrador) {
    //2.- No es administrador, es mismo usuario?
    let esMismoUsuario = usuarioLogueado._id === req.params.id
    if (!esMismoUsuario) return false
  }

  return true
}

function enviarCorreoConfirmacionUsuario(us) {
  const configuraciones = require("./configuraciones")
  let html = require("./plantillas.email").correo_confirmacion({
    correo: us.email,
    link_confirmacion: configuraciones.correo.dominio + "/usuario/confirmar",
    codigo: us.email_validado.codigo + us._id,
    nombre: us.nombre,
    nombre_aplicacion: configuraciones.correo.nombre_aplicacion,
  })

  var mailOptions = {
    from: configuraciones.correo.mailOptions.from,
    to: us.email,
    subject:
      "Se ha creado un usuario con tu correo | " +
      configuraciones.correo.nombre_aplicacion,
    html,
  }
  const utilidades = require("./utilidades")
  return utilidades.correo(mailOptions)
}

function enviarCorreoRecuperacionContrasena(usuario) {
  const configuraciones = require("./configuraciones")
  let html = require("./plantillas.email").correo_recuperacion_password({
    link_confirmacion: configuraciones.correo.dominio_recuperacion,
    codigo: usuario.email_validado.codigo + usuario._id,
    nombre: usuario.nombre,
    nombre_aplicacion: configuraciones.correo.nombre_aplicacion,
  })

  var mailOptions = {
    from: configuraciones.correo.mailOptions.from,
    to: usuario.email,
    subject:
      "Recuperar contraseña | " + configuraciones.correo.nombre_aplicacion,
    html,
  }
  const utilidades = require("./utilidades")
  return utilidades.correo(mailOptions)
}

const generarCodigoDeActivacion_Recuperacion = () => {
  return Math.floor(100000 + Math.random() * 900000)
}

async function comprobarIntentos(
  opciones = {
    codigo: undefined,
    esLogin: true,
    esValidacion: false,
    usuario: undefined,
  }
) {
  //Ningun usuario bloqueado se comprueba

  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const Usuario = require("./models/usuario.model")
    async function reiniciarContadores() {
      try {
        // Reiniciamos los contadores.
        await Usuario.updateOne(
          { _id: opciones.usuario._id },
          {
            "email_validado.intentos": 0,
            "email_validado.bloqueado": false,
            "email_validado.intento_hora": null,
          }
        ).exec()
      } catch (error) {
        reject(error)
      }
    }

    try {
      //Si el usuario esta bloqueado, debe de tener una hora a la que se bloqueo.
      if (opciones.usuario.email_validado.bloqueado) {
        // Para desbloquearlo deben pasar los mínutos definidos.
        const { DateTime } = require("luxon")
        let minutosFaltantes = DateTime.fromISO(
          new Date(opciones.usuario.email_validado.intento_hora).toISOString()
        )
          .plus({ minutes: 5 })
          .diffNow(["minutes", "seconds"])

        // Si los minutos son 0 ó negativos desbloqueamos para el siguiente intento
        if (minutosFaltantes <= 0) {
          await reiniciarContadores()
          // Modificamos minutos faltantes para que muestre solo 0 en caso de que
          // sea mayor, esto con fines de estilo.
          minutosFaltantes = 0
        }

        throw `Demasiados intentos. Vuelve a intentar en ${minutosFaltantes.minutes
          .toString()
          .padStart(2, "0")}:${minutosFaltantes.seconds
          .toFixed(0)
          .toString()
          .padStart(2, "0")} minutos`
      }

      if (opciones.esValidacion) {
        // El codigo de verificacion debe ser igual
        //Si el contador va arriba de 2 BLOQUEAMOS
        if (opciones.usuario.email_validado.intentos > 1) {
          await Usuario.updateOne(
            { _id: opciones.usuario._id },
            {
              "email_validado.bloqueado": true,
              "email_validado.intento_hora": new Date(),
            }
          ).exec()
        }

        if (opciones.usuario.email_validado.codigo != opciones.codigo) {
          //Si el contador no va arriba sumamos +1 intentos
          await Usuario.updateOne(
            { _id: opciones.usuario._id },
            { $inc: { "email_validado.intentos": 1 } }
          ).exec()
          throw msjError_codigo_no_valido
        }
      }

      //Si todo fue bien, pues devolvemos todas las opciones
      // y de paso reiniciamos todos los valores de intentos.
      await reiniciarContadores()
      resolve(opciones)
    } catch (error) {
      reject(error)
    }
  })
}

module.exports = {
  create_administrador: {
    metodo: "post",
    path: "/crear-administrador",
    pre_middlewares: [bruteforce.prevent],
    // No requiere permiso
    permiso: null,
    cb: async (req, res, next) => {
      let Usuario = require("./models/usuario.model")
      let configuraciones = require("./configuraciones")
      let permisos = configuraciones.permisos

      let administrador = await Usuario.find({
        permissions: permisos.administrador.permiso,
      }).countDocuments()
      if (administrador > 0) return next("Ya existe el administrador")

      let codice_security = require("./index")

      if (!req.body?.password) return next("No definiste el password")
      let us = null
      codice_security.hash
        .crypt(req.body.password)
        .then(async password => {
          let usuario = new Usuario(req.body)
          usuario.email = usuario.email.toLowerCase()
          usuario.password = password

          // Agregamos todos los permisos al usuario administrador
          usuario.permissions.push(...obtenerTodosLosPermisosEnArrayString())

          usuario["email_validado"] = {
            codigo: generarCodigoDeActivacion_Recuperacion(),
          }
          return usuario.save()
        })
        .then(usuario => {
          const utilidades = require("./utilidades")
          us = usuario
          us.password = utilidades.emoticones.random()
          return enviarCorreoConfirmacionUsuario(us)
        })
        .then(() => {
          res.send({ usuario: us })
        })
        .catch(_ => next(_))
    },
  },

  update_permisos_administrador: {
    metodo: "put",
    path: "/restaurar-permisos-administrador",
    pre_middlewares: [bruteforce.prevent],
    permiso: require("./configuraciones").permisos.administrador,
    cb: (req, res, next) => {
      let Usuario = require("./models/usuario.model")
      let configuraciones = require("./configuraciones")
      let permisos = configuraciones.permisos
      let _id = req.body._id

      Usuario.findOne({
        _id,
        permissions: permisos.administrador.permiso,
      })
        .select(" permissions ")

        .then(usuario => {
          if (!usuario) throw "No existe el id"
          let permisosFicheroSeguridad = obtenerTodosLosPermisosEnArrayString()

          while (usuario.permissions.length > 0) usuario.permissions.pop()
          // Agregamos todos los permisos
          usuario.permissions.push(...permisosFicheroSeguridad)
          return usuario.save()
        })

        .then(usuario =>
          res.send({
            mensaje: "Se restauraron los permisos de administrador del usuario",
            usuario,
          })
        )
        .catch(_ => next(_))
    },
  },

  login: {
    metodo: "post",
    path: "/login",
    permiso: null,
    pre_middlewares: [bruteforce.prevent],
    cb: (req, res, next) => {
      const password = req.body?.password
      const email = req.body?.email
      const credencialesError = "Credenciales incorrectas"
      const codice_security = require("./index")

      let usuarioBD = null
      // El usuario debe existir.
      const Usuario = require("./models/usuario.model")
      Usuario.findOne({ email })
        .select("+password +permissions +email_validado")
        .lean()
        .exec()
        .then(usuario => {
          if (!usuario) throw credencialesError
          usuarioBD = usuario
          //Debe estaer validado para hacer login
          if (!usuario.email_validado.validado)
            throw "El usuario no ha sido validado"
          if (usuario.inhabilitado) throw "El usuario está inhabilitado"
          // Comprobamos el password
          return codice_security.hash.compare(password, usuario.password)
        })
        .then(passwordCorrecto => {
          if (!passwordCorrecto) throw credencialesError
          delete usuarioBD.password
          delete usuarioBD.email_validado
          //Firmamos un token
          console.log(usuarioBD)
          return codice_security.token.generar(usuarioBD)
        })
        .then(token => {
          console.log(token)
          res.send({ token })
        })
        .catch(err => next(err))
    },
  },

  read: {
    metodo: "get",
    path: "/",
    permiso: require("./configuraciones").permisos.leer_todo,
    cb: async (req, res, next) => {
      // Obtener y filtrar todos los usuarios
      const limit = (req.params.limit ?? 10) * 1
      const skip = (req.params.skip ?? 0) * 1

      const busqueda = {}

      const termino = req.query?.termino
      if (termino) {
        // Si hay un termino se lo aplicamos a los campos necesarios
        busqueda["$or"] = ["nombre", "email"].map(x => {
          return { [x]: { $regex: termino, $options: "i" } }
        })
      }

      let Usuario = require("./models/usuario.model")
      try {
        let usuarios = await Usuario.find(busqueda)
          .limit(limit)
          .skip(skip)
          .exec()
        let total = await Usuario.find(busqueda).countDocuments()

        return res.send({ usuarios, total })
      } catch (error) {
        next(error)
      }
    },
  },

  read_id: {
    metodo: "get",
    path: "/id/:id",
    permiso: require("./configuraciones").permisos.login,
    cb: (req, res, next) => {
      // Un usuario diferente no puede leer los datos de otro usuario
      let paso = comprobarAdministradorMismoUsuario(req, res, next)

      if (!paso)
        throw next({ error: "No puedes leer los datos de otro usuario" })

      let Usuario = require("./models/usuario.model")
      Usuario.findById(req.params.id)
        .exec()
        .then(usuario => res.send({ usuario }))
        .catch(_ => next(_))
    },
  },

  read_confirmar: {
    metodo: "get",
    path: "/confirmar",
    pre_middlewares: [bruteforce.prevent],
    permiso: null,
    cb: (req, res, next) => {
      // Debemos resibir un query
      const codigoCompleto = req.query?.codigo
      if (!codigoCompleto) throw next("Codigo no valido")

      // El código es de 6 digitos.
      const codigo = codigoCompleto.slice(0, 6)
      // Y despues debe incluir el id del usuario.
      const _id = codigoCompleto.slice(6)

      const Usuario = require("./models/usuario.model")
      // Comprobamos que el usuario este esperando un codigo de
      // de confirmacion.
      Usuario.findById(_id)
        // Cargamos la propiedad en el modelo.
        .select("+email_validado")
        .exec()
        .then(async usuario => {
          if (!usuario) throw msjError_codigo_no_valido
          if (usuario.email_validado?.validado) throw "El link caduco"

          return comprobarIntentos({
            usuario,
            codigo,
            esValidacion: true,
          })
        })
        .then(opciones => {
          // La comprobacion salio correcta, por lo tanto hacemos lo que tenemos
          // que hacer.
          return Usuario.updateOne(
            { _id: opciones.usuario._id },
            {
              "email_validado.validado": true,
            }
          ).exec()
        })
        .then(usuario => {
          if (usuario.nModified !== 1)
            throw "Hubo un problema validando al usuario"
          res.send({ mensaje: "Usuario habilitado" })
        })
        .catch(_ => next(_))
    },
  },

  create: {
    metodo: "post",
    path: "/",
    permiso: require("./configuraciones").permisos.crear_usuario,
    cb: async (req, res, next) => {
      let Usuario = require("./models/usuario.model")
      let codice_security = require("./index")
      let us = null

      if (!req.body?.password) throw next("No definiste el password")
      codice_security.hash
        .crypt(req.body.password)
        .then(async password => {
          let usuario = new Usuario(req.body)
          usuario.email = usuario.email.toLowerCase()
          usuario.password = password
          //Permiso por defecto
          usuario.permissions.push(
            require("./configuraciones").permisos.login.permiso
          )
          usuario["email_validado"] = {
            codigo: generarCodigoDeActivacion_Recuperacion(),
          }
          return usuario.save()
        })
        .then(usuario => {
          usuario.password = require("./utilidades").emoticones.random()
          us = usuario
          return enviarCorreoConfirmacionUsuario(us)
        })
        .then(() => {
          res.send({ usuario: us })
        })
        .catch(_ => next(_))
    },
  },

  /**
   * Actualizamos solo nombre y correo
   */
  update: {
    metodo: "put",
    path: "/id/:id",
    permiso: require("./configuraciones").permisos.login,
    cb: async (req, res, next) => {
      let puedeModificar = comprobarAdministradorMismoUsuario(req, res, next)

      if (!puedeModificar)
        throw next({ error: "No puedes modificar a otro usuario" })

      let Usuario = require("./models/usuario.model")

      let id = req.params.id
      let usuario = await Usuario.findById(id).select("nombre email").exec()
      if (!usuario) throw next("No existe el id")

      if (req.body?.nombre) usuario.nombre = req.body.nombre
      if (req.body?.email) usuario.email = req.body.email

      usuario
        .save()
        .then(usuario => res.send({ usuario }))
        .catch(_ => next(_))
    },
  },

  update_password: {
    metodo: "put",
    path: "/password/:id",
    permiso: require("./configuraciones").permisos.login,
    cb: async (req, res, next) => {
      let password = req.body?.password
      if (!password) throw next("No definiste el password")

      let puedeModificar = comprobarAdministradorMismoUsuario(req, res, next)
      if (!puedeModificar)
        throw next({ error: "No puedes modificar el password de otro usuario" })

      let Usuario = require("./models/usuario.model")

      let id = req.params.id
      let usuario = await Usuario.findById(id).select("password").exec()
      if (!usuario) throw next("No existe el id")

      let codice_security = require("./index")
      codice_security.hash
        .crypt(password)
        .then(pass => {
          usuario.password = pass
          return usuario.save()
        })
        .then(() => res.send())
        .catch(_ => next(_))
    },
  },

  // Generamos un link de recuperacion de password para el usaurio
  update_generar_link_recuperar_password: {
    metodo: "get",
    path: "/generar-link-recuperar-password",
    pre_middlewares: [bruteforce.prevent],
    permisos: null,
    cb: (req, res, next) => {
      let Usuario = require("./models/usuario.model")

      if (!req?.query?.email) return next("Es necesario el correo")

      Usuario.findOne({ email: req.query.email })
        .select("email_validado email nombre")
        .exec()
        .then(async usuario => {
          //Debe estar validado
          if (!usuario.email_validado.validado)
            return next("Usuario no validado")
          if (!usuario) return
          // no retornamos naa
          else {
            // Modificamos al usuario
            usuario.email_validado.recuperar_contrasena = true
            usuario.email_validado.codigo =
              generarCodigoDeActivacion_Recuperacion()
            usuario.markModified("email_validado.recuperar_contrasena")

            let us = await usuario.save()
            return enviarCorreoRecuperacionContrasena(us)
          }
        })
        .then(() =>
          // Si no exite el email, no se va a enviar nada,pero shhhh!
          res.send({ mensaje: `Se envío un correo a ${req.query.email}` })
        )
        .catch(_ => next(_))
    },
  },

  update_recuperar_password_email: {
    metodo: "post",
    path: "/recuperar-password-email",
    pre_middlewares: [bruteforce.prevent],
    permiso: null,
    cb: async (req, res, next) => {
      //Debemos obtener el password nuevo
      let password = req.body?.password
      if (!password) throw next("No definiste el password")
      let Usuario = require("./models/usuario.model")

      let codigoCompleto = req.body.codigo
      // El código es de 6 digitos.
      let codigo = codigoCompleto.slice(0, 6)
      // Y despues debe incluir el id del usuario.
      let id = codigoCompleto.slice(6)

      //Buscamos al usuario.
      let usuario = await Usuario.findById(id)
        .select("password email_validado")
        .exec()
      // El usuario debe de existir y debe estar esperando para recuperar contraseña

      let msjError = "Usuario no valido"
      if (!usuario || !usuario.email_validado?.recuperar_contrasena || !codigo)
        return next(msjError)

      //Comprobamos el codigo
      comprobarIntentos({
        usuario,
        codigo,
        esValidacion: false,
      })
        .then(() => {
          let codice_security = require("./index")
          return codice_security.hash.crypt(password)
        })

        .then(pass => {
          usuario.password = pass
          usuario.email_validado.recuperar_contrasena = false
          usuario.email_validado.codigo = null
          usuario.markModified("email_validado.recuperar_contrasena")

          return usuario.save()
        })
        .then(() =>
          res.send({ mensaje: "Se modifico la contraseña correctamente" })
        )
        .catch(_ => next(_))
    },
  },
  update_agregar_permiso: {
    metodo: "put",
    path: "/agregar-permiso",
    pre_middlewares: null,
    permiso: require("./configuraciones").permisos.agregar_permiso,
    cb: (req, res, next) => {
      let Usuario = require("./models/usuario.model")

      let permiso = req.body.permiso
      if (!permiso) return next("No se recibio ningún permiso")
      // El permiso debe existir en la lista.
      let permisos = Object.keys(require("./seguridad/permisos.seguridad"))
      if (!permisos.includes(permiso))
        return next("El permiso enviado no es válido")

      //Buscamos al usuario.
      Usuario.findById(req.body._id)
        .select("permissions")
        .exec()
        .then(usuario => {
          if (!usuario) throw "No existee el id"
          if (usuario.permissions.includes(permiso))
            throw "El usuario ya tiene el permiso"
          usuario.permissions.push(permiso)
          return usuario.save()
        })
        .then(usuario => res.send({ usuario }))
        .catch(_ => next(_))
    },
  },
  update_eliminar_permiso: {
    metodo: "put",
    path: "/eliminar-permiso",
    pre_middlewares: null,
    permiso: require("./configuraciones").permisos.eliminar_permiso,
    cb: (req, res, next) => {
      let Usuario = require("./models/usuario.model")

      let permiso = req.body.permiso
      if (!permiso) return next("No se recibio ningún permiso")
      //Buscamos al usuario.
      Usuario.findById(req.body._id)
        .select("permissions")
        .exec()
        .then(usuario => {
          if (!usuario) throw "No existe el id"
          usuario.permissions.pull(permiso)
          return usuario.save()
        })
        .then(usuario => res.send({ usuario }))
        .catch(_ => next(_))
    },
  },

  // Elimina completamente un usuario
  delete_eliminar_usuario: {
    metodo: "delete",
    path: "/:id",
    pre_middlewares: null,
    permiso: require("./configuraciones").permisos.administrador,
    cb: (req, res, next) => {
      let Usuario = require("./models/usuario.model")

      let id = req.params.id

      Usuario.findById(id)
        .then(usuario => {
          if (!usuario) throw "No existe el id"
          return usuario.remove()
        })
        .then(usuario => {
          res.send({ usuario })
        })
        .catch(_ => next(_))
    },
  },
  // Inhabilita al usuario
  delete_inhabilitar_usuario: {
    metodo: "delete",
    path: "/inhabilitar/:id",
    pre_middlewares: null,
    permiso: require("./configuraciones").permisos.inhabilitar_usuario,
    cb: (req, res, next) => {
      let Usuario = require("./models/usuario.model")
      let id = req.params.id
      Usuario.findById(id)
        .select("inhabilitado")
        .then(usuario => {
          if (!usuario) throw "No existe el id"
          usuario.inhabilitado = true
          return usuario.save()
        })
        .then(usuario => {
          res.send({ usuario })
        })
        .catch(_ => next(_))
    },
  },
  // Inhabilita al usuario
  update_inhabilitar_usuario: {
    metodo: "put",
    path: "/habilitar/:id",
    pre_middlewares: null,
    permiso: require("./configuraciones").permisos.inhabilitar_usuario,
    cb: (req, res, next) => {
      let Usuario = require("./models/usuario.model")
      let id = req.params.id
      Usuario.findById(id)
        .select("inhabilitado")
        .then(usuario => {
          if (!usuario) throw "No existe el id"
          usuario.inhabilitado = false
          return usuario.save()
        })
        .then(usuario => {
          res.send({ usuario })
        })
        .catch(_ => next(_))
    },
  },

  read_todos_los_permisos: {
    metodo: "get",
    path: "/info/permisos-existentes",
    pre_middlewares: null,
    permiso: require("./configuraciones").permisos.agregar_permisos,
    cb: (req, res) => {
      let cEasy = require("@codice-progressio/easy-permissions").configuraciones

      let path =
        cEasy.path +
        cEasy.nombreCarpetaPermisos +
        "/" +
        cEasy.nombreArchivoPermisos
      let permisos = require(path)

      res.send({ permisos })
    },
  },
}

/**
 *Obtenemos todos los permisos existentes creados actualmente.
 *
 * @returns
 */
function obtenerTodosLosPermisosEnArrayString() {
  let permisos = []

  //Obtenemos las configuraciones de easy_permissions desde
  // las configuraciones generales.
  let easy_permissions_configuraciones =
    require("./configuraciones").easy_permissions.configuraciones

  // Convertimos cada dato para la construcción de los archivos en
  // variables más cortas.
  let path = easy_permissions_configuraciones.path
  let nombreCarpetaPermisos =
    easy_permissions_configuraciones.nombreCarpetaPermisos
  let nombreArchivoPermisos =
    easy_permissions_configuraciones.nombreArchivoPermisos
  // Recreamos la ruta completa
  let rutaDePermisos = `${path}${nombreCarpetaPermisos}/${nombreArchivoPermisos}`
  // Llamamos al archivo de permisos
  let permisosDeApp = require(rutaDePermisos)
  // Obtenemos las claves
  console.log(permisosDeApp)
  permisos.push(...Object.keys(permisosDeApp))
  // Si hay repetidos los eliminamos.
  permisos = Array.from(new Set(permisos))

  return permisos
}
