const app = require("express")()
const crud = require("../crud_usuario")

Object.keys(crud).forEach(key => {
  const x = crud[key]

  if (x.pre_middlewares) app[x.metodo](x.path, ...x.pre_middlewares, x.cb)
  else app[x.metodo](x.path, x.cb)
})
module.exports = app
