const app = require("express")()
const crud = require("../crud_usuario")

Object.keys(crud).forEach(key => {
  const x = crud[key]
  app[x.metodo](x.path, x.cb)
})
module.exports = app
