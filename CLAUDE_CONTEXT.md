# CLAUDE_CONTEXT.md — ConexAgro

> Contexto compacto generado a partir de `ConexAgro.md` (documentación académica, 2026). Usa este archivo como orientación inicial, pero consulta la documentación original cuando necesites detalles exactos de requisitos, diagramas o estimaciones. No asumas que una funcionalidad está implementada solo porque esté especificada.

## 1. Qué es ConexAgro

ConexAgro es un prototipo de plataforma web responsive para Montería, Córdoba (Colombia), que busca conectar a:

- **Propietarios:** personas con terrenos rurales baldíos o subutilizados.
- **Productores:** personas con proyectos agrícolas estructurados que necesitan terreno y/o inversión.
- **Inversionistas:** personas o empresas interesadas en oportunidades agropecuarias.
- **Administradores:** responsables de gestionar usuarios y moderar publicaciones.

El problema de fondo es la dificultad de los pequeños productores para acceder de forma estable a tierra, acompañamiento técnico y financiación formal. La documentación destaca la informalidad en la tenencia, los obstáculos documentales para solicitar crédito y la dependencia de intermediarios. La plataforma pretende centralizar la oferta de terrenos, los proyectos productivos y las oportunidades de inversión, facilitando la vinculación y la preparación documental.

**Objetivo académico:** diseñar, desarrollar y evaluar un prototipo funcional que facilite la estructuración de proyectos agropecuarios y la gestión precontractual de la tenencia de la tierra.

## 2. Alcance funcional

### Módulos principales

1. **Autenticación y perfiles:** registro, verificación de correo, inicio de sesión y permisos según rol.
2. **Terrenos:** propietarios registran, editan y desactivan predios rurales con ubicación, área, suelo, acceso a agua/vías, descripción y fotografías.
3. **Proyectos:** productores publican, editan y cierran proyectos con cultivo/actividad, área requerida, ubicación deseada, inversión requerida y retorno estimado.
4. **Inversión:** consulta de terrenos y proyectos disponibles como oportunidades; filtros por tipo, monto y ubicación.
5. **Búsqueda:** búsqueda por texto y filtros estructurados; orden por relevancia, cercanía o fecha.
6. **Solicitudes:** envío, recepción y respuesta a solicitudes de vinculación; el receptor puede aceptar, rechazar o contraprop oner.
7. **Administración:** gestión de usuarios, moderación de terrenos/proyectos reportados y supervisión general.

### Fuera del alcance de la primera versión

- Coincidencias automáticas y recomendaciones.
- Mapas interactivos avanzados.
- Notificaciones en tiempo real y chat/comunicación entre usuarios.
- Valoraciones, reputación, reportes y estadísticas.
- Aplicaciones móviles nativas.

La documentación menciona generación automática de acuerdos en PDF como parte del objetivo/prototipo y del plan de desarrollo; sin embargo, no aparece como requisito funcional detallado en el catálogo RF-01 a RF-09. Trátala como alcance previsto que debe confirmarse antes de implementarla.

## 3. Roles y permisos

| Rol | Responsabilidades |
|---|---|
| Propietario | Registrar y administrar sus terrenos; consultar proyectos; enviar y gestionar solicitudes. |
| Productor | Publicar y administrar proyectos; buscar terrenos; solicitar terrenos e inversión; gestionar solicitudes. |
| Inversionista | Consultar oportunidades; filtrar terrenos/proyectos; enviar solicitudes de interés y hacer seguimiento. |
| Administrador | Activar/desactivar usuarios, editar roles, moderar publicaciones y supervisar la plataforma. |

Reglas de permisos relevantes:
- El administrador no puede registrarse mediante el flujo público ni enviar/gestionar solicitudes propias.
- Los usuarios solo pueden editar sus propias publicaciones, salvo intervención administrativa.
- Cada usuario solo ve las solicitudes que envió o recibió.
- El acceso a funciones y datos debe validarse en el servidor mediante RBAC; ocultar elementos en la interfaz no basta.

## 4. Reglas de negocio importantes

### Usuarios y autenticación
- Correo y número de documento únicos.
- El registro público permite perfiles de propietario, productor e inversionista; se puede seleccionar más de un perfil, pero no los tres. El rol administrador se asigna por gestión administrativa.
- Verificación de correo obligatoria; el enlace expira en 24 horas.
- No se permite iniciar sesión sin verificar el correo.
- Máximo 5 intentos fallidos; después, bloqueo temporal de 30 minutos.
- Access token JWT: 1 hora; refresh token: 7 días.
- Sesión expira tras 30 minutos de inactividad.
- Contraseñas almacenadas con hash bcrypt (salt rounds >= 10).

### Terrenos
- Todo terreno debe tener coordenadas geográficas válidas.
- Entre 1 y 10 fotografías por terreno.
- Estado inicial: `disponible`.
- Solo el propietario o el administrador pueden editarlo o desactivarlo.

### Proyectos
- No se publica un proyecto sin área requerida y monto de inversión definidos; el monto debe ser positivo.
- Estado inicial: `activo`.
- Máximo un documento de soporte PDF.
- Solo el productor autor o el administrador pueden editarlo/cerrarlo.

### Búsqueda e inversión
- Mostrar únicamente terrenos `disponibles` y proyectos `activos` (y excluir los desactivados, cerrados u ocultos).
- Filtros combinables: texto, ubicación, tipo de proyecto/cultivo, área y monto.
- Radios geográficos configurables: 5, 10, 25 o 50 km.
- La información financiera detallada del propietario/productor se muestra resumida hasta que exista una solicitud aceptada.

### Solicitudes y moderación
- No advertir/crear solicitudes duplicadas cuando ya exista una solicitud activa entre los mismos usuarios y referencia.
- Las solicitudes pendientes no vencen automáticamente en esta versión.
- Una solicitud aceptada o rechazada no puede modificarse.
- Toda transición de estado debe guardar fecha y hora.
- Las publicaciones ocultas no aparecen en búsquedas públicas.
- Acciones administrativas y de moderación deben quedar auditadas con responsable, fecha y motivo.

## 5. Tecnología y arquitectura prevista

La documentación define requisitos y alternativas, pero **no fija una implementación tecnológica completa**. No inventes decisiones que aún no estén confirmadas.

- **Frontend:** React / Next.js aparecen como tecnologías de referencia.
- **Backend/API:** API REST, versionada bajo `/api/v1/`, con JSON y códigos HTTP estándar.
- **Base de datos:** PostgreSQL con extensión PostGIS para coordenadas y consultas geoespaciales.
- **ORM:** Prisma o Sequelize (alternativas; escoger/confirmar una).
- **Autenticación:** JWT y control de acceso basado en roles (RBAC).
- **Comunicación:** HTTPS obligatorio, TLS 1.2 o superior.
- **Documentación de API:** Swagger/OpenAPI.
- **Despliegue:** hosting web compatible con PostgreSQL/PostGIS; la metodología propone un servidor de pruebas gratuito y CI/CD básico.
- **Correo:** servicio externo para verificación de cuentas y avisos.
- **Portabilidad prevista:** Docker y configuración mediante variables de entorno son requisitos deseables.

No se especifican de forma concluyente el proveedor de hosting, el servicio de correo, la librería de mapas, la estructura concreta del backend ni el ORM definitivo.

## 6. Interfaz, accesibilidad y calidad

- Aplicación web **mobile-first/responsive**, usable en móvil y escritorio; breakpoints documentados: 320, 768, 1024 y 1440 px.
- WCAG 2.1 nivel AA; navegación por teclado, compatibilidad con lectores de pantalla, etiquetas ARIA, texto alternativo y contraste suficiente.
- Objetivos de interfaz: controles táctiles de al menos 44×44 px, feedback visual, mensajes de error accionables y navegación clara.
- Paleta definida:
  - Verde bosque `#123C2E` (primario).
  - Ámbar `#F2B01E` (secundario).
  - Rojo `#DC2626` (alerta).
  - Ámbar claro `#FFE6A1` (advertencia).
  - Crema `#F4F7F0` (fondo).
  - Texto `#0F271A`; tarjetas blancas.
- Tipografía especificada: Times New Roman.
- Rendimiento objetivo: API <500 ms p95; carga inicial <3 s en 3G; búsqueda <2 s para hasta 1.000 registros.
- Seguridad: cifrado en tránsito y reposo, validación/sanitización contra SQLi y XSS, rate limiting (100 solicitudes/minuto por usuario) y auditoría.
- Fiabilidad: transacciones para operaciones críticas, integridad referencial y respaldos diarios.
- Mantenibilidad: módulos separados, Git, convenciones de código, documentación y cobertura unitaria mínima del 70% en módulos críticos.

## 7. Metodología y planificación

Enfoque híbrido **Cascada–Scrum**:
- Fase inicial de análisis y diseño.
- Tres sprints de dos semanas (seis semanas de programación).
- Equipo estudiantil asume desarrollo y Scrum Master; docente es Product Owner.
- GitHub para repositorio, Issues y Projects.
- Definition of Done: código en Git, compilación/verificación básica de integración, revisión básica de usabilidad/legibilidad y criterios de aceptación satisfechos.

Plan de trabajo documentado:
- Semanas 1–3: análisis, requisitos y entrevistas (4–6 actores clave).
- Semanas 4–5: arquitectura, modelo de datos, prueba técnica de PDF/mapa, plantillas y wireframes.
- Semanas 6–7 (Sprint 1): infraestructura, autenticación por roles y registro georreferenciado de predios.
- Semanas 8–9 (Sprint 2): ficha técnica de proyectos, solicitud de predio y generación de acuerdo PDF.
- Semanas 10–11 (Sprint 3): catálogo básico de inversión (prescindible) y accesibilidad.
- Semanas 12–14: pruebas con 5–8 usuarios; metas: SUS >=70/100 y tareas completadas >=80%.
- Semana 15: correcciones y refactorización.
- Semana 16: congelamiento y despliegue de versión de demostración.

## 8. Estimación documentada

La estimación por puntos de función registra:
- Puntos de función sin ajustar (PFSA): **76**.
- Factor de ajuste (ACT): **31**.
- Puntos de función ajustados (PFA): **72,96**.
- Esfuerzo estimado: **511 horas/persona**.
- Considerando 3 desarrolladores y 100 horas productivas por persona al mes, duración estimada: **1,703 meses** (el documento lo expresa como aproximadamente 1 mes y 21 días).

El apartado del presupuesto aparece incompleto en la tabla de contenido; no hay un presupuesto final verificable en el contenido revisado.

## 9. Convenciones para trabajar con Claude

- Mantén el contexto colombiano y el objetivo del proyecto: conectar propietarios, productores e inversionistas rurales.
- Respeta los cuatro roles, RBAC y las reglas de negocio anteriores.
- Prioriza el alcance del prototipo; no implementes funciones excluidas sin autorización explícita.
- No presentes como implementadas funciones que solo aparecen en requisitos o cronograma.
- Antes de elegir tecnologías no definidas (ORM, hosting, mapas, correo, backend), pregunta o propone opciones indicando que son decisiones pendientes.
- Conserva la paleta, tipografía, enfoque responsive y criterios WCAG 2.1 AA.
- Usa nombres y estados consistentes para entidades y procesos; documenta cualquier cambio de modelo o regla.
- Para cambios de código, revisa primero la estructura real del repositorio y los archivos existentes. No supongas rutas, componentes, tablas ni dependencias.
- Si encuentras contradicciones entre este resumen y la documentación o el código actual, señala la discrepancia y pide confirmación antes de modificar reglas de negocio.

## 10. Ambigüedades y puntos por confirmar en la documentación

1. La tabla de contenido anuncia 7 requisitos funcionales, pero el desarrollo contiene RF-01 a RF-09 (nueve requisitos).
2. El alcance inicial menciona generación automática de acuerdos PDF, pero no está descrita como RF independiente en el catálogo funcional.
3. Las notificaciones en tiempo real aparecen como requisito de interfaz deseable, aunque el alcance excluye notificaciones en tiempo real. Para la primera versión, no asumir WebSockets.
4. El documento alterna entre mapas básicos/geolocalización y excluir mapas interactivos avanzados. Interpretación prudente: ubicación y mapa básico sí; experiencia cartográfica avanzada no.
5. La selección de perfiles durante el registro dice que pueden elegirse varios, pero no los tres; debe aclararse si el usuario puede tener exactamente uno o dos roles.
6. El esfuerzo y la duración se calculan con supuestos de productividad que conviene revisar si se reutilizan para planificación real.
7. La sección de presupuesto no está completada.
8. Las tecnologías listadas son referencias/requisitos, no necesariamente el stack ya adoptado. Confirmar contra el repositorio.

## Política de ejecución: priorizar resultados entregables

El objetivo principal es asegurar que cada sesión de trabajo produzca un resultado tangible y verificable antes de consumir demasiados recursos.

### Reglas obligatorias

1. **Priorizar la entrega:** no dediques toda la sesión a investigar, analizar o planificar. Produce un resultado funcional lo antes posible.
2. **Trabajar por incrementos:** divide las tareas grandes en entregables pequeños e independientes.
3. **Generar primero una versión básica:** implementa una solución mínima que funcione antes de agregar mejoras o detalles secundarios.
4. **Establecer límites de trabajo:** evita ciclos prolongados de análisis, revisiones innecesarias y modificaciones sin un objetivo concreto.
5. **No dejar tareas a medias innecesariamente:** si una tarea es demasiado grande, completa primero una parte funcional y deja las demás documentadas.
6. **Guardar avances:** después de cada etapa, verifica y conserva los cambios realizados.
7. **Registrar el estado:** actualiza un archivo `PROGRESS.md` con:
   - Funcionalidades completadas.
   - Archivos creados o modificados.
   - Problemas encontrados.
   - Tareas pendientes.
   - Próximo paso recomendado.
8. **Preparar la continuidad:** antes de terminar una sesión, deja instrucciones claras para retomar el trabajo sin repetir análisis.

### Comportamiento ante tareas grandes

Si una tarea no puede completarse razonablemente en una sesión:

- No intentes resolverla íntegramente.
- Identifica una primera parte que pueda quedar funcional.
- Implementa y verifica esa parte.
- Documenta lo que falta.

**Regla fundamental:** es preferible entregar una funcionalidad sencilla, funcional y comprobada que consumir toda la sesión intentando construir una solución completa que nunca llegue a entregarse.

---
**Fuente principal:** `ConexAgro.md`, capítulos 1 y 2. Este contexto es un resumen de la documentación y no sustituye los requisitos detallados, diagramas ni la verificación del estado real del código.
