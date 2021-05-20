require("dotenv").config()

const express = require("express")
const app = express()
const port = process.env.PORT ?? 3001
const log = require("./utilidades").log

const mongoose = require("mongoose")
mongoose.connect("mongodb://localhost/prueba-seguridad", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
})

const db = mongoose.connection
db.on("error", console.error.bind(console, "connection error:"))
db.once("open", () => {
  console.log("BD en linea")

  app.use(express.json({ limit: "5MB" }))
  //Esta configurcion es para poder hacer pruebas de creación.

  //SEGURIDAD --------------------------------------

  //Llamamos la libreria.
  const codice_security = require("./index.js")
  //Establecemos las configuraciones de easy-permissions
  codice_security.configuraciones.easy_permissions.config({
    // Para mejor rendimiento establecer en false
    generarPermisos: true,
    // En modo producción no se generan permisos
    modoProduccion: false,
    //Definimos el path para la ruta donde se creara la carpeta
    // y los ficheros de permisos
    path: require("path").resolve(__dirname).concat("/"),
  })
  // Definimos el modo debugs para este demo
  codice_security.configuraciones.debug = true
  // Usamos la configuracion por defecto de cors, pero
  // siempre la podemos sobreescribir. (TODO: Completar todas las opciones)
  codice_security.configuraciones.cors.origin = process.env.ORIGIN
  //TOKEN
  codice_security.configuraciones.jwt.private_key = process.env.PRIVATE_KEY

  //  CORREO

  codice_security.configuraciones.correo.dominio = process.env.CORREO_DOMINIO
  codice_security.configuraciones.correo.dominio_recuperacion =
    process.env.CORREO_DOMINIO_RECUPERACION
  codice_security.configuraciones.correo.nombre_aplicacion =
    process.env.CORREO_NOMBRE_APLICACION
  codice_security.configuraciones.correo.transport.host =
    process.env.CORREO_TRANSPORT_HOST
  codice_security.configuraciones.correo.transport.port =
    process.env.CORREO_TRANSPORT_PORT
  codice_security.configuraciones.correo.transport.auth.user =
    process.env.CORREO_TRANSPORT_AUTH_USER
  codice_security.configuraciones.correo.transport.auth.pass =
    process.env.CORREO_TRANSPORT_AUTH_PASS

  codice_security.configuraciones.correo.mailOptions.from =
    process.env.CORREO_MAILOPTIONS_FROM

  //Llamamos la configuracion de configuracion
  app.use(codice_security.basico())

  //SEGURIDAD FIN ----------------------------------

  //Disfrutamos de la vida...

  app.get("/", (req, res) => {
    res.send("Hello World!")
  })

  app.use((error, req, res, next) => {
    log(error)
    // SEGURIDAD - captura de errores
    let errorJWT = codice_security.configuraciones.validaciones.errores.jwt(
      error,
      res
    )

    if (errorJWT) {
      res.status(errorJWT.status).send(errorJWT.send)
      return
    }
    // SEGURIDAD - captura de errores - fin

    res.status(500).send({ error })
  })

  app.listen(port, () => {
    console.log(`Ejemplo de app. Escuchando en el puerto ${port}`)
  })
})
