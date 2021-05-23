const colores = require("colors")
const configuraciones = require("./configuraciones")
/**
 *Arreglo de mensajes
 *
 * @param {*} mensajes
 */
module.exports.log = function (...mensajes) {
  if (configuraciones.debug)
    console.log(
      colores.cyan("[ codice-security ]"),
      ...mensajes.map(x => colores.green(x))
    )
}

const emoticones = [
  "┬──┬ ¯_(ツ) (╯°□°）╯︵ ┻━┻ ",
  "┻━┻︵ヽ(`Д´)ﾉ︵ ┻━┻",
  "┬─┬ノ( º _ ºノ) (ノಠ益ಠ)ノ彡┻━┻",
]

module.exports.emoticones = {
  lista: emoticones,
  random: () => {
    let numeroRandom = (Math.random() * emoticones.length).toFixed(0)
    let emoticon = emoticones[numeroRandom]
    return emoticon
  },
}

/**
 * Permite enviar un correo
 * @param {*} mailOptions 
 * @returns 
 */
module.exports.correo = (
  mailOptions = {
    from: "",
    to: "",
    subject: "",
    html: "",
  }
) => {
  const nodemailer = require("nodemailer")
  var transport = nodemailer.createTransport(configuraciones.correo.transport)
  return transport.sendMail(mailOptions)
}


/**
 *Comprueba que si el usuario es administrador, o el mismo que esta
 * logueado.
 *
 * @param {*} req
 * @returns
 */
module.exports.comprobarAdministradorMismoUsuario=function (req) {
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

