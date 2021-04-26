const app = require("express")()

require("../configuraciones").usuario.callbacks.forEach(x =>
  app[x.metodo](x.path, x.cb)
)
module.exports = app
