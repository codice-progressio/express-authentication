require("dotenv").config()
const express = require("express")
const app = express()
const port = process.env.PORT ?? 3000

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

//Disfrutamos de la vida...
app.use(express.json({ limit: "5MB" }))

app.get("/", (req, res) => {
  res.send("Hello World!")
})

app.post("/token", (req, res, next) => {
  //Firmamos un token

  codice_security.token
    .generar({ mi: "objeto" })
    .then(token => {
      res.send({ token })
    })
    .catch(err => next(err))
})

app.use((err, req, res, next) => {
  console.log(err)
  res.status(500).send({ err })
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
