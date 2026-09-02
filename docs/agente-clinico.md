# Agente Clínico — Resumen para dirección

*Versión técnica para el equipo de ingeniería: `docs/agente-clinico-tecnico.md`.*

## Resumen ejecutivo

El Agente Clínico es el asistente que permite a médicos y vendedores consultar
el catálogo de productos de la empresa (indicaciones, contraindicaciones,
protocolos de aplicación) escribiendo una pregunta en lenguaje natural, en lugar
de buscar en fichas técnicas dispersas. Está diseñado para que **nunca invente
información**: solo puede repetir datos que ya están cargados y verificados en
el sistema.

La lógica del asistente y los permisos por rol ya están construidos y probados
de forma automatizada. Lo que falta antes de un lanzamiento real es una prueba
de uso en vivo (nadie del equipo lo probó todavía manualmente en pantalla) y
aplicar los últimos cambios al ambiente de producción. Se detalla más abajo, con
una recomendación de orden de prioridades.

## Qué hace por el negocio

Hoy, saber si un producto tiene una contraindicación, cómo se reconstituye, o
qué protocolo de aplicación corresponde, depende de que alguien busque en un PDF
o le pregunte a otra persona. El asistente reemplaza esa búsqueda: el usuario
escribe el nombre del producto y recibe, en segundos, exactamente lo que el
catálogo tiene registrado sobre ese producto — separado en dos vistas:

- **Información interna**, completa, para uso del profesional.
- **Información para el paciente**, una versión reducida y filtrada, lista para
  compartir — el sistema decide qué parte de esa información está autorizada a
  mostrarse fuera del consultorio, siguiendo lo que cada protocolo tiene
  marcado como compartible en el catálogo.

Por diseño, el asistente **no** compara productos entre sí, no opina sobre
combinaciones ni dosis para un paciente puntual, y no recuerda preguntas
anteriores dentro de la misma conversación. Responde una pregunta, sobre un
producto, cada vez.

## Por qué la información es confiable

Este es el punto que más le importa a un negocio de salud: el asistente está
construido de forma que **no puede completar con suposiciones** lo que no
encuentra en el catálogo. Cada dato que aparece en pantalla proviene de una
consulta real a la base de datos en el momento de la pregunta — el sistema
técnicamente no le permite al modelo escribir un dato clínico "de memoria". Si
la información no está cargada, el asistente lo dice, no lo inventa.

Además, todo tiene un tope de tiempo y de intentos: una consulta nunca queda
esperando indefinidamente, y si algo falla, el usuario ve un mensaje claro en
vez de un error técnico.

## Quién puede usarlo y qué puede ver cada uno

Se definieron tres niveles de acceso:

| Rol | Puede usar el chat | Puede ver y editar el catálogo | Puede administrar cuentas |
|---|---|---|---|
| **Administrador** | Sí | Sí | Sí — crea cuentas, resetea contraseñas, asigna roles |
| **Médico** | Sí | Sí | Solo su propia cuenta |
| **Vendedor** | Sí | No | Solo su propia cuenta |

Un vendedor puede consultar el asistente para responder preguntas de un
cliente, pero no tiene forma de entrar a editar el catálogo ni de ver la
sección administrativa del sistema — ni siquiera escribiendo la dirección
directamente. Antes de esta revisión, esa restricción no existía de forma
completa: cualquier cuenta con sesión iniciada podía potencialmente editar el
catálogo. Ya está cerrado.

También se agregó un control para cuentas nuevas: cuando un administrador crea
una cuenta o le resetea la contraseña a alguien, esa contraseña queda marcada
como temporal — la persona **no puede usar nada del sistema** hasta que la
cambie por una propia. Esto evita que una cuenta quede operando con una
contraseña que además conoce otra persona.

## Estado actual

**Construido y verificado por pruebas automáticas** (110+ casos, corridos
contra una base de datos real, no simulada): la lógica del asistente, el
control de acceso por rol, el sistema de contraseña temporal, y el
comportamiento del catálogo cerrado.

**Todavía no verificado en pantalla por una persona**: cómo se ve y se siente
usar el sistema de punta a punta — iniciar sesión, cambiar una contraseña
temporal, hacer una consulta, ver el menú de cuenta. El equipo no contó con
acceso a un navegador de prueba en este tramo del trabajo para confirmarlo
visualmente, aunque el código que lo produce fue revisado exhaustivamente.

## Riesgos y pendientes antes de lanzar

1. **Producción no tiene todavía los últimos cambios.** El rol de médico, la
   contraseña temporal y el cierre de acceso al catálogo están aplicados en el
   ambiente de pruebas, no en el sistema que usarían los usuarios reales
   todavía. Es un paso deliberado y controlado, pero falta ejecutarlo.
2. **Falta una prueba guiada, por una persona, del recorrido completo** antes de
   entregarlo a un usuario real — especialmente el cambio de contraseña
   temporal, que es el primer contacto de cualquier cuenta nueva con el
   sistema.
3. **A la cuenta de la doctora todavía no se le asignó el rol de médico** — hoy
   sigue con el nivel de acceso que tenía antes de esta revisión.
4. **El asistente no tiene memoria de la conversación.** Si un usuario hace una
   pregunta de seguimiento ("¿y las contraindicaciones?") sin repetir el
   nombre del producto, el sistema no sabe a qué producto se refiere. Es la
   limitación de experiencia de uso más notoria hoy, y la primera candidata a
   resolver.
5. Un caso de error puntual (sesión vencida) todavía le ofrece al usuario el
   botón equivocado ("reintentar" en vez de "iniciar sesión de nuevo") — un
   detalle menor, pero confunde si aparece.

Ninguno de estos puntos es un problema de fondo en la construcción del
sistema; son los pasos normales entre "funciona" y "listo para el día a día de
un equipo".

## Próximos pasos recomendados

1. **Aplicar los cambios pendientes en producción.** Requiere una ventana
   corta y coordinada, sin impacto para usuarios actuales.
2. **Hacer una prueba guiada del recorrido completo** con una cuenta de
   prueba, antes de dársela a un usuario real.
3. **Asignar el rol de médico** a la cuenta de la doctora.
4. **Resolver la falta de memoria conversacional** — es el cambio con mayor
   impacto directo en qué tan natural se siente usar el asistente todos los
   días.
5. Ajustes menores de experiencia de uso (el caso del botón de sesión vencida,
   y mejorar cómo se presentan las opciones cuando una búsqueda es ambigua).

Con los puntos 1 a 3 resueltos, el sistema queda en condiciones de entregarse a
un primer grupo reducido de usuarios para validación en uso real, antes de una
entrega general.
