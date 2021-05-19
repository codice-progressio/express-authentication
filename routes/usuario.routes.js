const app = require("express")()
const crud = require("../crud_usuario")
const $ = require("../configuraciones").easy_permissions.$

Object.keys(crud).forEach(key => {
  const x = crud[key]

  let middlewares = x.pre_middlewares ?? []

  if (x.permiso) middlewares.push($(x.permiso.permiso, x.permiso.descripcion))

  if (x.pre_middlewares) app[x.metodo](x.path, ...middlewares, x.cb)
  else app[x.metodo](x.path, x.cb)
})
module.exports = app
