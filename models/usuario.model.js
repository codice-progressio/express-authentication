const mongoose = require("mongoose")
const uniqueValidator = require("mongoose-unique-validator")
const Schema = mongoose.Schema
const usuarioSchema = new Schema(require("../configuraciones").usuario.schema)

usuarioSchema.plugin(uniqueValidator, {
  message: " El email ya esta registrado.",
})

module.exports = mongoose.model(
  require("../configuraciones").usuario.nombre_bd,
  usuarioSchema
)
