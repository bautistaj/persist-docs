---
sidebar_position: 1
---

# PRD — Thot Bitácora de Obra Digital
**Versión:** 1.0
**Fecha:** Junio 2026
**Estado:** Draft — pendiente de revisión por stakeholders

---

## 1. Resumen Ejecutivo

Las constructoras colombianas llevan hoy su bitácora de obra en libros físicos o archivos de Excel dispersos. Esto genera tres problemas concretos: la información llega tarde a quienes toman decisiones, los registros son difíciles de auditar ante interventorías y entidades de control, y los residentes de obra tienen fricciones enormes para documentar el día a día.

**Bitácora de Obra Digital** resuelve el problema de captura en campo usando WhatsApp como canal de entrada: el residente responde un bot conversacional desde su celular y el sistema construye automáticamente el registro estructurado del día.

El producto apunta a **constructoras privadas medianas** que manejan entre 2 y 20 obras simultáneas.

---

## 2. Problema

### 2.1 Enunciado del Problema

Los equipos de obra no documentan con consistencia ni oportunidad porque las herramientas actuales les exigen ir a una pantalla. El resultado: registros incompletos, firmados a destiempo o reconstruidos de memoria días después.

### 2.2 Evidencia del Problema

| Síntoma | Impacto |
|---|---|
| Bitácoras físicas llenadas al final de la semana | Pérdida de trazabilidad legal ante reclamaciones de prórroga |
| Fotos dispersas en chats de WhatsApp personales | Imposible vincular evidencia fotográfica a una actividad específica |
| Supervisor firma folios en bloque sin revisarlos | Anula la función de control técnico exigida por NSR-10 |
| Búsqueda histórica = hojear libros físicos | Tiempo perdido en auditorías o reclamaciones |

### 2.3 Contexto Normativo (Colombia)

- **NSR-10 Título I, Sección I.2.2.1** — registro escrito de labores del supervisor técnico
- **Ley 400 de 1997, Art. 18** — obligatoriedad de supervisión técnica
- **Ley 1796 de 2016 (Vivienda Segura)** — Certificado Técnico de Ocupación (CTO)
- **Código Civil, Art. 2060** — garantía decenal (conservación 10 años)

---

## 3. Objetivos del Producto

| # | Objetivo | Métrica de éxito |
|---|---|---|
| O1 | Eliminar brecha entre evento en obra y registro | ≥ 80% folios creados el mismo día |
| O2 | Reducir fricción de captura | Tiempo de llenado ≤ 4 min vía bot |
| O3 | Dar trazabilidad auditable | 100% folios con firma digital al cerrar |
| O4 | Centralizar archivo con recuperación rápida | Búsqueda semántica ≤ 3 segundos |
| O5 | Ser la herramienta más barata de adoptar | Onboarding nueva obra ≤ 15 min |

**North Star Metric:** % de folios cerrados y firmados el mismo día del evento (Day-0 Close Rate). Objetivo MVP: ≥ 70% en los primeros 90 días.

---

## 4. Personas de Usuario

### P1 — Residente de Obra
- Está en campo todo el día con el celular en la mano
- No quiere abrir una app nueva ni recordar contraseñas
- Punto de dolor: si llenar la bitácora toma más de 5 min, lo deja para después

### P2 — Supervisor Técnico / Interventor
- Visita la obra periódicamente
- Responsabilidad legal ante NSR-10: su firma valida el folio
- Punto de dolor: hoy recibe PDFs por email y firma sin contexto histórico

### P3 — Gerente de Proyecto
- Maneja varias obras en paralelo
- Punto de dolor: consolida información manualmente de fuentes distintas

---

## 5. Alcance del MVP

### ✅ Dentro del alcance

- **Bot WhatsApp** — flujo guiado, fotos, recordatorio automático
- **Portal Web** — dashboard, búsqueda semántica, exportación PDF/Excel
- **Firma Digital Móvil** — notificación, aprobación/rechazo con comentario
- **Administración** — proyectos, inmuebles, usuarios, roles

### ❌ Fuera del alcance

- Integración con SECOP
- Módulo de programación / cronograma Gantt
- App móvil nativa
- Módulo financiero o de presupuesto
- IA generativa para redacción de actas

---

## 6. Historias de Usuario

### Epic 1 — Captura vía Bot WhatsApp

**US-01 — Inicio de folio diario**

Como Residente de Obra, quiero que el bot me guíe con preguntas simples para no tener que recordar qué campos son obligatorios.

Criterios:
- Flujo: clima → personal → maquinaria → actividades → materiales → SST → observaciones → confirmación
- Opciones rápidas (botones) donde aplique
- El folio queda en estado `draft` hasta confirmación

**US-02 — Adjuntar foto a actividad**

Como Residente, quiero enviar una foto por WhatsApp y vincularla a la actividad del día.

Criterios:
- Máximo 10 fotos por folio
- Si la foto llega fuera de flujo, el bot pregunta a qué actividad corresponde

**US-03 — Recordatorio automático**

Como Gerente, quiero que el sistema recuerde al residente llenar el folio si a las 17:00 no lo ha iniciado.

Criterios:
- Hora configurable por inmueble (default: 17:00)
- Solo días hábiles, sin festivos colombianos

### Epic 2 — Portal Web

**US-04 — Dashboard de obra**

Tarjeta por obra: días sin folio, folios pendientes de firma, último folio cerrado.

**US-05 — Búsqueda semántica**

Búsqueda en lenguaje natural sobre el historial. Resultados en ≤ 3 segundos para corpus de hasta 500 folios.

**US-06 — Exportación de reportes**

PDF con folios cronológicos y fotos embebidas. Excel con una fila por actividad. Disponible en ≤ 30 segundos para rangos de hasta 90 días.

### Epic 3 — Firma Digital Móvil

**US-07 — Notificación de folios pendientes**

El supervisor recibe WhatsApp cuando hay folios listos con enlace directo al folio.

**US-08 — Aprobación o rechazo**

Vista móvil optimizada. Al aprobar: estado `closed` + hash SHA-256. Al rechazar: folio vuelve a `draft` con comentario. Máximo 3 rechazos.

---

## 7. Métricas de Soporte

| Categoría | Métrica | Objetivo |
|---|---|---|
| Adopción | Residentes con ≥ 1 folio en primera semana | ≥ 85% |
| Engagement | Folios por obra por semana | ≥ 5 |
| Calidad | Folios con al menos 1 foto | ≥ 60% |
| Firma | Tiempo entre creación y firma | ≤ 24h |
| Retención | Constructoras activas al mes 3 | ≥ 75% |
| Performance | Tiempo de respuesta del bot | ≤ 2 segundos |

---

## 8. Preguntas Abiertas

| # | Pregunta | Fecha límite |
|---|---|---|
| Q1 | ¿Firma con validez legal formal (Ley 527/1999) o auditoría interna? | Antes de Fase 2 |
| Q2 | ¿Modelo de cobro: por proyecto, usuario o folio? | Antes de beta |
| Q3 | ¿El bot soporta respuestas de voz con transcripción? | Fase 1 backlog |
| Q4 | ¿Soporte offline para zonas sin conectividad? | Fase 1 backlog |
| Q5 | ¿Campos del folio iguales para todos o personalizables? | Antes de Fase 1 |

---

## 9. Cronograma

| Fase | Entregable | Duración |
|---|---|---|
| Fase 0 | PoC del bot con 1 obra piloto | 2 semanas |
| Fase 1 | Bot completo + portal básico | 6 semanas |
| Fase 2 | Firma + alertas | 3 semanas |
| Fase 3 | Búsqueda semántica + exportación + dashboard | 4 semanas |
| Beta privada | 3–5 constructoras piloto | 4 semanas |
| **v1.0** | | **~19 semanas** |

---

*Este PRD es un documento vivo. Debe revisarse y actualizarse al cierre de cada fase.*
