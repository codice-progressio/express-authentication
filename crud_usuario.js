const codice_security = require("./index")

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
      codice_security.hash
        .crypt(req.body.password)
        .then(async password => {
          let usuario = new Usuario(req.body)
          usuario.password = password
          usuario.permissions.push("administrador")
          return usuario.save()
        })
        .then(usuario => {
          usuario.password = require("./utilidades").emoticones.random()
          res.send({ usuario })
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
      console.log(req.usuario)
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

  create: {
    metodo: "post",
    path: "/administrador",
    permiso: "administrador",
    cb: async (req, res, next) => {
      let Usuario = require("./models/usuario.model")
      let codice_security = require("./index")

      // Si es el primer usuario, entonces lo hacemos administrador.

      if (!req.body?.password) throw next("No definiste el password")
      codice_security.hash
        .crypt(req.body.password)
        .then(async password => {
          let usuario = new Usuario(req.body)
          usuario.password = password
          return usuario.save()
        })
        .then(usuario => {
          usuario.password = require("./utilidades").emoticones.random()
          res.send({ usuario })
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

      require("./index")
        .utilidades.hash.crypt(password)
        .then(pass => {
          usuario.password = pass
          return usuario.save()
        })
        .then(usuario => res.send())
        .catch(_ => next(_))
    },
  },
}
