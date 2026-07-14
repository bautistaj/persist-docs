---
sidebar_position: 2
---
# Thot — Diagramas de Secuencia
**Versión:** 1.2
**Arquitectura:** Microservicios — Agent como orquestador

---

## Arquitectura de referencia

```
WhatsApp (Meta)  ←→  Gateway :8080  ←→  Agent :8081  ←→  API :8082  ←→  PostgreSQL :5432
Web Portal       ←→  Gateway :8080  ←→  API :8082    ←→  PostgreSQL :5432
Agent            ←→  pgvector       (solo lectura — búsqueda semántica)
API              →   pgvector       (escritura de embeddings al cerrar folio)
Job Scheduler    →   Agent :8081    (interno — cron de recordatorios y escalamientos)
```

### Responsabilidades por microservicio

| Servicio | Puerto | Responsabilidad |
|---|---|---|
| **Gateway** | 8080 | Punto de entrada único. Enrutamiento, SSL, rate limiting |
| **Agent** | 8081 | Orquestador de conversaciones. Decide el flujo, invoca tools del API. Dueño de comunicación con Meta. Job Scheduler interno |
| **API** | 8082 | Tools del agente + endpoints del portal web. CRUD, business logic, exportaciones, auth |
| **PostgreSQL** | 5432 | Datos relacionales. Acceso exclusivo desde API |
| **pgvector** | — | Embeddings de folios. API escribe, Agent lee para búsqueda semántica |

### Tools que Agent invoca del API

| Tool | Descripción |
|---|---|
| `get_user_by_phone` | Busca usuario por número de WhatsApp |
| `get_conversation_state` | Recupera estado de conversación activo del usuario |
| `get_active_folio` | Verifica si existe folio del día para un place |
| `create_folio` | Crea un nuevo folio en estado `draft` |
| `save_conversation_state` | Persiste el paso actual y contexto parcial |
| `update_folio_field` | Actualiza un campo del folio con la respuesta del residente |
| `submit_folio` | Cambia estado a `pending_signature` y dispara notificación |
| `get_supervisor_by_place` | Obtiene supervisor asignado al place |
| `send_whatsapp_message` | Envía mensaje de texto libre (ventana de 24h activa) |
| `send_hsm_template` | Envía plantilla aprobada por Meta (inicio de conversación) |
| `upload_photo` | Comprime y sube foto a storage S3-compatible |
| `get_places_without_folio` | Lista places activos sin folio del día (para recordatorio) |
| `sign_folio` | Registra firma, genera embedding y cambia estado a `closed` |
| `reject_folio` | Incrementa `rejection_count`, cambia estado a `rejected` |
| `escalate_folio` | Notifica al gerente por folio sin firma > 48h |

---

## Flujo A — Residente inicia espontáneamente

El residente escribe al bot en cualquier momento del día sin haber recibido recordatorio.

```mermaid
sequenceDiagram
  autonumber
  participant R  as Residente
  participant WA as WhatsApp (Meta)
  participant GW as Gateway :8080
  participant AG as Agent :8081
  participant AP as API :8082
  participant DB as PostgreSQL

  R->>WA: Escribe mensaje
  WA->>GW: Webhook POST /webhook/whatsapp
  GW->>AG: Reenvía evento (teléfono, mensaje)

  AG->>AP: tool → get_user_by_phone(phone)
  AP->>DB: SELECT users WHERE phone = ? AND company_id = ?
  DB-->>AP: Usuario + company + proyectos
  AP-->>AG: {user_id, company_id, role}

  alt Usuario no registrado
    AG->>AP: tool → send_whatsapp_message(phone, "No encontrado")
    AP->>WA: POST API Meta
    WA-->>R: "Tu número no está registrado. Contacta a tu administrador."
  else Usuario válido
    AG->>AP: tool → get_conversation_state(user_id)
    AP->>DB: SELECT conversation_state WHERE user_id = ?
    DB-->>AP: Estado actual o null

    AG->>AP: tool → get_active_folio(place_id, date)
    AP->>DB: SELECT folios WHERE place_id = ? AND date = today
    DB-->>AP: Folio existente o null

    alt Sin folio del día y sin conversación activa
      AG->>AP: tool → create_folio(place_id, user_id, date)
      AP->>DB: INSERT folios (status = draft, company_id = ?)
      DB-->>AP: folio_id
      AG->>AP: tool → save_conversation_state(user_id, folio_id, step="weather")
      AP->>DB: INSERT conversation_state
      AG->>AP: tool → send_whatsapp_message(phone, "Saludo + pregunta clima")
      AP->>WA: POST API Meta
      WA-->>R: "Buenos días [nombre] 👷 Iniciemos el folio de hoy para [place]. ¿Cómo estuvo el clima?"
    else Conversación activa — retomar flujo
      AG->>AP: tool → send_whatsapp_message(phone, "Retomar en paso pendiente")
      AP->>WA: POST API Meta
      WA-->>R: "Continuamos donde lo dejaste. [Pregunta del paso pendiente]"
    end
  end
```

---

## Flujo B — Recordatorio automático → residente responde

El job scheduler interno del Agent detecta a las 17:00 que un place no tiene folio del día.

```mermaid
sequenceDiagram
  autonumber
  participant JB as Job Scheduler (Agent interno)
  participant AG as Agent :8081
  participant AP as API :8082
  participant DB as PostgreSQL
  participant WA as WhatsApp (Meta)
  participant R  as Residente
  participant GW as Gateway :8080

  Note over JB,AG: Cron dispara a las 17:00 hora local (configurable por place)

  JB->>AG: trigger → daily_reminder_check()
  AG->>AP: tool → get_places_without_folio(date=today)
  AP->>DB: SELECT places sin folio hoy y active = true
  DB-->>AP: Lista de places sin folio
  AP-->>AG: [{place_id, name, resident_phone, reminder_time}]

  loop Por cada place sin folio
    AG->>AP: tool → send_hsm_template(phone, template="recordatorio_folio", params)
    AP->>WA: POST API Meta (plantilla HSM aprobada)
    WA-->>R: "Hola [nombre], aún no tienes folio del día para [place]. ¿Iniciamos? ✅"

    R->>WA: Responde "Sí" o cualquier mensaje
    WA->>GW: Webhook POST /webhook/whatsapp
    GW->>AG: Reenvía evento (teléfono, respuesta)

    AG->>AP: tool → get_user_by_phone(phone)
    AP-->>AG: {user_id, company_id, role}

    AG->>AP: tool → create_folio(place_id, user_id, date)
    AP->>DB: INSERT folios (status = draft, company_id = ?)
    DB-->>AP: folio_id

    AG->>AP: tool → save_conversation_state(user_id, folio_id, step="weather")
    AP->>DB: INSERT conversation_state

    AG->>AP: tool → send_whatsapp_message(phone, "Flujo iniciado")
    AP->>WA: POST API Meta
    WA-->>R: "Perfecto 👷 Empecemos. ¿Cómo estuvo el clima hoy en [place]?"
  end
```

---

## Flujo C — Llenado del folio (flujo conversacional completo)

Aplica tanto para Flujo A como B una vez iniciado el folio.

```mermaid
sequenceDiagram
  autonumber
  participant R  as Residente
  participant WA as WhatsApp (Meta)
  participant GW as Gateway :8080
  participant AG as Agent :8081
  participant AP as API :8082
  participant DB as PostgreSQL
  participant PGV as pgvector

  Note over AG: paso actual = weather

  R->>WA: "Soleado ☀️"
  WA->>GW: Webhook
  GW->>AG: Evento (phone, "Soleado")

  AG->>AP: tool → update_folio_field(folio_id, field="weather", value="Soleado")
  AP->>DB: UPDATE folios SET weather = 'Soleado'
  AG->>AP: tool → save_conversation_state(user_id, step="workers")
  AG->>AP: tool → send_whatsapp_message(phone, "Pregunta personal activo")
  WA-->>R: "¿Cuántas personas trabajaron hoy en obra?"

  Note over AG: ... pasos workers → machinery → activities → materials → sst → observations ...

  Note over AG: paso actual = confirm

  AG->>AP: tool → send_whatsapp_message(phone, "Resumen del folio + confirmación")
  WA-->>R: "Resumen: clima Soleado, 12 trabajadores... ¿Confirmamos el folio?"

  R->>WA: "Confirmar ✅"
  WA->>GW: Webhook
  GW->>AG: Evento (phone, "Confirmar")

  AG->>AP: tool → submit_folio(folio_id)
  AP->>DB: UPDATE folios SET status = 'pending_signature'
  AP->>DB: DELETE conversation_state WHERE user_id = ?

  AG->>AP: tool → get_supervisor_by_place(place_id)
  AP->>DB: SELECT supervisor via USER_PROJECT
  DB-->>AP: {supervisor_id, supervisor_phone}

  AG->>AP: tool → send_hsm_template(supervisor_phone, template="folio_pendiente_firma", params)
  AP->>WA: POST API Meta → notifica al supervisor

  AG->>AP: tool → send_whatsapp_message(resident_phone, "Confirmación al residente")
  WA-->>R: "✅ Folio enviado a revisión. Tu supervisor fue notificado."
```

---

## Flujo D — Firma del supervisor (aprobación o rechazo)

El supervisor accede al portal web desde el enlace recibido por WhatsApp.

```mermaid
sequenceDiagram
  autonumber
  participant S   as Supervisor
  participant WA  as WhatsApp (Meta)
  participant WEB as Web Portal
  participant GW  as Gateway :8080
  participant AP  as API :8082
  participant DB  as PostgreSQL
  participant PGV as pgvector
  participant R   as Residente

  WA-->>S: "Folio de [place] listo para revisar. [Ver folio →]"
  S->>WEB: Abre enlace con token temporal (JWT 72h)
  WEB->>GW: GET /folios/:id?token=xxx
  GW->>AP: Reenvía request
  AP->>DB: SELECT folio + fotos + firma WHERE id = ? AND token válido
  DB-->>AP: Folio completo
  AP-->>WEB: Folio renderizado mobile-optimized
  WEB-->>S: Vista completa del folio con fotos

  alt Supervisor aprueba
    S->>WEB: Click "Aprobar"
    WEB->>GW: POST /folios/:id/sign {action: "approve"}
    GW->>AP: Reenvía request
    AP->>DB: Calcular SHA-256 del contenido del folio
    AP->>DB: INSERT signatures {content_hash, ip, user_agent, type="internal"}
    AP->>DB: UPDATE folios SET status = 'closed'
    AP->>PGV: INSERT embedding del folio cerrado
    AP-->>WEB: 200 OK — folio cerrado
    WEB-->>S: "✅ Folio aprobado y cerrado."
    AP->>WA: POST API Meta → notifica al residente
    WA-->>R: "✅ Tu folio del [fecha] fue aprobado por [supervisor]."

  else Supervisor rechaza
    S->>WEB: Click "Rechazar" + escribe comentario
    WEB->>GW: POST /folios/:id/sign {action: "reject", comment: "..."}
    GW->>AP: Reenvía request
    AP->>DB: UPDATE folios SET status='rejected', rejection_count + 1
    AP-->>WEB: 200 OK — folio rechazado
    WEB-->>S: "❌ Folio rechazado. El residente fue notificado."

    alt rejection_count < 3
      AP->>WA: POST API Meta → notifica al residente con comentario
      WA-->>R: "❌ Tu folio fue rechazado. Comentario: [comentario]. Por favor corrígelo."
    else rejection_count = 3
      AP->>DB: UPDATE folios SET status = 'rejected' bloqueado
      AP->>WA: POST API Meta → notifica al residente Y al gerente
      WA-->>R: "⚠️ Folio bloqueado tras 3 rechazos. Tu gerente fue notificado."
    end
  end
```

---

## Flujo E — Escalamiento por firma tardía

Job interno del Agent que corre cada hora y detecta folios sin firma > 48h.

```mermaid
sequenceDiagram
  autonumber
  participant JB  as Job Scheduler (Agent interno)
  participant AG  as Agent :8081
  participant AP  as API :8082
  participant DB  as PostgreSQL
  participant WA  as WhatsApp (Meta)
  participant SUP as Supervisor
  participant GER as Gerente

  Note over JB,AG: Job corre cada hora

  JB->>AG: trigger → check_unsigned_folios()
  AG->>AP: tool → get_pending_folios_older_than(hours=48)
  AP->>DB: SELECT folios WHERE status='pending_signature' AND updated_at < now() - 48h
  DB-->>AP: Lista de folios vencidos
  AP-->>AG: [{folio_id, place_name, supervisor_phone, manager_phone}]

  loop Por cada folio vencido
    AG->>AP: tool → escalate_folio(folio_id)
    AP->>DB: Registrar escalamiento log interno

    AG->>AP: tool → send_whatsapp_message(supervisor_phone, "Recordatorio urgente")
    AP->>WA: POST API Meta
    WA-->>SUP: "⚠️ El folio de [place] lleva más de 48h sin tu firma. [Ver folio →]"

    AG->>AP: tool → send_whatsapp_message(manager_phone, "Alerta al gerente")
    AP->>WA: POST API Meta
    WA-->>GER: "⚠️ El folio de [place] del [fecha] lleva +48h sin firma del supervisor."
  end
```

---

## Flujo F — Adjuntar foto fuera del flujo conversacional

El residente envía una foto por WhatsApp cuando no tiene un flujo activo.

```mermaid
sequenceDiagram
  autonumber
  participant R  as Residente
  participant WA as WhatsApp (Meta)
  participant GW as Gateway :8080
  participant AG as Agent :8081
  participant AP as API :8082
  participant DB as PostgreSQL
  participant S3 as Storage S3

  R->>WA: Envía foto (fuera de flujo activo)
  WA->>GW: Webhook (phone, image_url, media_id)
  GW->>AG: Evento (phone, tipo=imagen)

  AG->>AP: tool → get_user_by_phone(phone)
  AP-->>AG: {user_id, company_id}

  AG->>AP: tool → get_conversation_state(user_id)
  AP-->>AG: null — no hay flujo activo

  AG->>AP: tool → get_active_folio(place_id, date=today)
  AP-->>AG: {folio_id} o null

  alt Existe folio del día
    AG->>AP: tool → send_whatsapp_message(phone, "Pedir descripción")
    WA-->>R: "📷 Foto recibida. ¿A qué actividad del folio de hoy corresponde?"
    R->>WA: "Vaciado de losa nivel 2"
    WA->>GW: Webhook
    GW->>AG: Evento (phone, descripción)
    AG->>AP: tool → upload_photo(folio_id, image_url, description)
    AP->>S3: Descargar de Meta + comprimir + subir a S3
    S3-->>AP: storage_url
    AP->>DB: INSERT photos {folio_id, storage_url, description}
    AG->>AP: tool → send_whatsapp_message(phone, "Foto vinculada")
    WA-->>R: "✅ Foto vinculada al folio de hoy."
  else Sin folio del día
    AG->>AP: tool → send_whatsapp_message(phone, "Sin folio activo")
    WA-->>R: "⚠️ No tienes un folio del día. Inicia el folio primero para adjuntar fotos."
  end
```

---

## Flujo G — Búsqueda semántica

El supervisor o gerente busca en el historial de folios usando lenguaje natural.

```mermaid
sequenceDiagram
  autonumber
  participant U   as Supervisor / Gerente
  participant WEB as Web Portal
  participant GW  as Gateway :8080
  participant AG  as Agent :8081
  participant OAI as OpenAI
  participant PGV as pgvector
  participant AP  as API :8082
  participant DB  as PostgreSQL

  U->>WEB: Escribe "vaciado de losa enero"
  WEB->>GW: GET /search?q=vaciado+de+losa+enero&company_id=?
  GW->>AG: Reenvía request de búsqueda

  AG->>OAI: Generar embedding del query
  OAI-->>AG: vector[1536]

  AG->>PGV: SELECT folios ORDER BY embedding <=> query_vector WHERE company_id = ?
  PGV-->>AG: Top 10 folios más relevantes con similarity score

  AG->>AP: tool → get_folios_by_ids([folio_ids])
  AP->>DB: SELECT folios + metadata WHERE id IN (?)
  DB-->>AP: Folios completos
  AP-->>AG: [{folio_id, date, place, activities, status, similarity}]

  AG-->>WEB: Resultados ordenados por relevancia
  WEB-->>U: Lista de folios relevantes con extracto y fecha
```

---

## Notas de implementación

### Plantillas HSM requeridas

| Template | Flujo | Uso |
|---|---|---|
| `recordatorio_folio` | Flujo B | Recordatorio diario sin folio |
| `folio_pendiente_firma` | Flujo C | Notificación al supervisor |
| `folio_escalado` | Flujo E | Escalamiento al gerente |

### Ventana de 24h de WhatsApp
Una vez que el residente o supervisor responde un HSM, el bot puede enviar mensajes de texto libre durante 24h. Si la ventana expira, el próximo mensaje debe ser otro HSM. El Agent rastrea `last_interaction` en `CONVERSATION_STATE`.

### Token temporal del supervisor (Flujo D)
JWT de corta duración (72h) vinculado a `folio_id` + `user_id`. No requiere login completo para el MVP.

### Embedding de folios (Flujo D → pgvector)
El embedding se genera y persiste **solo cuando el folio se cierra** (`status = closed`). El API genera el texto concatenado del folio, llama a OpenAI, y hace INSERT en pgvector con `company_id` como metadata para aislamiento multi-tenant.

### Aislamiento multi-tenant en búsqueda semántica
Toda query a pgvector incluye filtro `company_id` — el Agent nunca retorna resultados de otra company aunque los vectores sean similares.

### Acceso a bases de datos

| Servicio | PostgreSQL | pgvector |
|---|---|---|
| Gateway | ❌ | ❌ |
| Agent | ❌ | ✅ Solo lectura |
| API | ✅ CRUD completo | ✅ Solo escritura |
