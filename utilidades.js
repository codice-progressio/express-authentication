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
