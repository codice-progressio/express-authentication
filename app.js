require("dotenv").config()
const express = require("express")
const app = express()
const port = 3000 || process.env.PORT

const codice_security = require("./index.js")

codice_security.configuraciones.debug = true
codice_security.configuraciones.cors.origin = process.env.ORIGIN

app.use(codice_security.basico())

app.get("/", (req, res) => {
  res.send("Hello World!")
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
