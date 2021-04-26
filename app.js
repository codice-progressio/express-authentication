require("dotenv").config()
const express = require("express")
const app = express()
const port = process.env.PORT ?? 3000
const log = require("./utilidades").log

//SEGURIDAD --------------------------------------

//Llamamos la libreria.
const codice_security = require("./index.js")
// Definimos el modo debugs para este demo
codice_security.configuraciones.debug = true
// Usamos la configuracion por defecto de cors, pero
// siempre la podemos sobreescribir. (TODO: Completar todas las opciones)
codice_security.configuraciones.cors.origin = process.env.ORIGIN
//TOKEN
codice_security.configuraciones.jwt.private_key = process.env.PRIVATE_KEY
//Llamamos la configuracion de configuracion
app.use(codice_security.basico())

//SEGURIDAD FIN ----------------------------------

//Disfrutamos de la vida...
app.use(express.json({ limit: "5MB" }))

app.get("/", (req, res) => {
  res.send("Hello World!")
})

app.post("/login", (req, res, next) => {
  const password = "password" === req.body?.password
  const usuario = "usuario" === req.body?.usuario

  if (password && usuario) {
    //Firmamos un token
    return codice_security.token
      .generar(req.body)
      .then(token => {
        res.send({ token })
      })
      .catch(err => next(err))
  }

  res.send({ error: "Credenciales incorrectas" })
})

app.use((err, req, res, next) => {
  log(err)
  // SEGURIDAD - captura de errores
  let errorJWT = codice_security.configuraciones.validaciones.errores.jwt(
    err,
    res
  )

  if (errorJWT) {
    res.status(errorJWT.status).send(errorJWT.send)
    return
  }
  // SEGURIDAD - captura de errores - fin

  res.status(500).send({ err })
})

app.listen(port, () => {
  console.log(`Ejemplo de app. Escuchando en el puerto ${port}`)
})
