---
sidebar_position: 1
---

# Arquitectura C4

## C1 — Contexto del sistema

Muestra los actores que interactúan con Thot y los sistemas externos con los que se conecta.

```mermaid
C4Context
  title C1 — Contexto del sistema Thot

  Person(residente, "Residente", "Captura el folio diario vía WhatsApp")
  Person(supervisor, "Supervisor", "Firma y revisa folios vía Web / WhatsApp")
  Person(gerente, "Gerente", "Consulta y exporta reportes vía Web")
  Person_Ext(admin, "Super Admin", "Gestiona tenants y accesos desde panel interno")

  System(thot, "Thot", "Bitácora de obra digital")

  System_Ext(whatsapp, "WhatsApp", "Meta Business API — canal de mensajería")
  System_Ext(openai, "OpenAI", "Generación de embeddings semánticos")
  System_Ext(s3, "Storage S3", "Almacenamiento de fotos de folios")

  Rel(residente,  thot,     "Registra folios", "WhatsApp")
  Rel(supervisor, thot,     "Firma y rechaza folios", "Web / WhatsApp")
  Rel(gerente,    thot,     "Consulta y exporta", "Web")
  Rel(admin,      thot,     "Gestiona tenants", "Panel interno")

  Rel(thot, whatsapp, "Envía y recibe mensajes", "Meta API")
  Rel(thot, openai,   "Genera embeddings", "API REST")
  Rel(thot, s3,       "Almacena fotos", "S3 API")
```

> **Nota:** El C1 muestra el sistema Thot como una caja negra. Los detalles internos
> (Nginx, Agent, API, DB) se detallan en el C2.



## C2 — Contenedores del sistema

Abre la caja negra de Thot y muestra los contenedores internos con sus responsabilidades y conexiones.

> **Decisión clave:** PostgreSQL y pgvector son bases de datos separadas.
> El API es el único que escribe en ambas. El Agent solo lee de pgvector para búsquedas semánticas.

```mermaid
C4Container
  title C2 — Contenedores del sistema Thot

  Person(residente,  "Residente",  "vía WhatsApp")
  Person(supervisor, "Supervisor", "vía Web / WhatsApp")
  Person(gerente,    "Gerente",    "vía Web")

  System_Ext(whatsapp, "WhatsApp",    "Meta Business API")
  System_Ext(openai,   "OpenAI",      "Embeddings semánticos")
  System_Ext(s3,       "Storage S3",  "Fotos de folios")

  Boundary(thot, "Thot [Sistema]") {
    Container(gateway, "Gateway",  "Nginx :8080",     "Punto de entrada. Enrutamiento, SSL, rate limiting")
    Container(webapp,  "Web App",  "Angular", "Portal admin — dashboard, folios, reportes")
    Container(agent,   "Agent",    "Python :8081",   "Orquestador. Conv. + Job Scheduler. Dueño de comunicación con Meta")
    Container(api,     "API",      "NestJS :8082",   "Business logic. Tools para Agent. Auth. Exportaciones")
    ContainerDb(db,    "PostgreSQL", ":5432",          "Datos relacionales — folios, users, companies, places")
    ContainerDb(pgv,   "pgvector",  "Vector DB",       "Embeddings de folios — solo lectura para Agent")
  }

  Rel(residente,  gateway, "Envía mensajes",     "WhatsApp → webhook")
  Rel(supervisor, gateway, "Firma folios",        "Web / WhatsApp")
  Rel(gerente,    gateway, "Consulta reportes",   "Web")

  Rel(gateway, webapp, "Sirve portal",         "HTTP")
  Rel(gateway, agent,  "Reenvía webhooks",     "/webhook/whatsapp")
  Rel(gateway, api,    "Reenvía requests web", "/api")

  Rel(agent, api,      "Invoca tools",           "HTTP interno")
  Rel(api,   agent,    "Retorna resultados",     "HTTP interno")

  Rel(agent, whatsapp, "Envía mensajes",          "Meta API")
  Rel(whatsapp, agent, "Webhooks entrantes",      "HTTPS POST")
  Rel(agent, openai,   "Genera embeddings del query", "API REST")
  Rel(agent, pgv,      "Búsqueda semántica",      "Solo lectura")

  Rel(api, db,  "CRUD datos relacionales",            "SQL")
  Rel(api, pgv, "Escribe embeddings al cerrar folio", "INSERT")
  Rel(api, s3,  "Sube y descarga fotos",              "S3 API")
```

### Reglas de comunicación

| Regla | Descripción |
|---|---|
| Agent → Meta | El Agent es el **único** que habla con WhatsApp/Meta |
| API → PostgreSQL | El API es el **único** que accede a datos relacionales |
| API → pgvector | El API **escribe** embeddings cuando un folio cambia a `closed` |
| Agent → pgvector | El Agent **solo lee** de pgvector para búsquedas semánticas |
| API → S3 | El API es el **único** que toca el Storage de fotos |
| Agent → DB | El Agent **nunca** accede directo a PostgreSQL |