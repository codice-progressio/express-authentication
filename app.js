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

//Llamamos la configuracion de configuracion
app.use(codice_security.basico())

//Disfrutamos de la vida...
app.use(express.json({ limit: "5MB" }))

app.get("/", (req, res) => {
  res.send("Hello World!")
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
