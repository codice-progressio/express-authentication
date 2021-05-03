const msjError_codigo_no_valido = "El código no es valido"

function comprobarAdministradorMismoUsuario(req, res, next) {
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
      configuraciones.correo.mailOptions.from +
      " - Se ha creado un usuario con tu correo",
    html,
  }
  const utilidades = require("./utilidades")
  return utilidades.correo(mailOptions)
}

const generarCodigoDeActivacion = () => {
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
          console.log(opciones)
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
    // No requiere permiso
    permiso: "",
    cb: async (req, res, next) => {
      let Usuario = require("./models/usuario.model")

      let administrador = await Usuario.find({
        permissions: "administrador",
      }).countDocuments()
      if (administrador > 0) return next("Ya existe el administrador")

      let codice_security = require("./index")

      if (!req.body?.password) throw next("No definiste el password")
      let us = null
      codice_security.hash
        .crypt(req.body.password)
        .then(async password => {
          let usuario = new Usuario(req.body)
          usuario.password = password
          usuario.permissions.push("administrador")
          usuario["email_validado"] = { codigo: generarCodigoDeActivacion() }
          return usuario.save()
        })
        .then(usuario => {
          const utilidades = require("./utilidades")
          us = usuario
          us.password = utilidades.emoticones.random()
          return enviarCorreoConfirmacionUsuario(us)
        })
        .then(mail => {
          res.send({ usuario: us })
        })
        .catch(_ => next(_))
    },
  },
  login: {
    metodo: "post",
    path: "/login",
    permiso: "",
    cb: (req, res, next) => {
      const password = req.body?.password
      const email = req.body?.email
      const credencialesError = "Credenciales incorrectas"
      const codice_security = require("./index")

      let usuarioBD = null
      // El usuario debe existir.
      const Usuario = require("./models/usuario.model")
      Usuario.findOne({ email })
        .select("+password +permissions")
        .lean()
        .exec()
        .then(usuario => {
          if (!usuario) throw credencialesError
          usuarioBD = usuario
          // Comprobamos el password
          return codice_security.hash.compare(password, usuario.password)
        })
        .then(passwordCorrecto => {
          if (!passwordCorrecto) throw credencialesError
          delete usuarioBD.password
          //Firmamos un token
          return codice_security.token.generar(usuarioBD)
        })
        .then(token => {
          res.send({ token })
        })
        .catch(err => next(err))
    },
  },

  read: {
    metodo: "get",
    path: "/",
    permiso: "administrador",
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
    permiso: "login",
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
    permiso: "",
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

      console.log({ codigo, _id })
      Usuario.findById(_id)
        // Cargamos la propiedad en el modelo.
        .select("+email_validado")
        .exec()
        .then(async usuario => {
          if (!usuario) throw msjError_codigo_no_valido

          return comprobarIntentos({
            usuario,
            codigo,
            esValidacion: true,
          })
        })
        .then(opciones => {
          // La comprobacion salio correcta, por lo tanto hacemos lo que tenemos
          // que hacer.
          let usuario = opciones.usuario
          usuario.email_validado.validado = true
          usuario.email_validado.codigo = null
          return usuario.save()
        })
        .then(usuario => res.send({ usuario }))
        .catch(_ => next(_))
    },
  },

  create: {
    metodo: "post",
    path: "/",
    permiso: "administrador",
    cb: async (req, res, next) => {
      let Usuario = require("./models/usuario.model")
      let codice_security = require("./index")
      let us = null
      // Si es el primer usuario, entonces lo hacemos administrador.

      if (!req.body?.password) throw next("No definiste el password")
      codice_security.hash
        .crypt(req.body.password)
        .then(async password => {
          let usuario = new Usuario(req.body)
          usuario.password = password
          usuario["email_validado"] = { codigo: generarCodigoDeActivacion() }
          return usuario.save()
        })
        .then(usuario => {
          usuario.password = require("./utilidades").emoticones.random()
          us = usuario
          return enviarCorreoConfirmacionUsuario(us)
        })
        .then(email => {
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
    permiso: "login",
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
}
