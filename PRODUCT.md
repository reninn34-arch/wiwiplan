# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Usuario primario: **un creador/freelance que trabaja solo** y lleva varios clientes en paralelo. Arma la planificación de contenido de cada cliente mes a mes, la comparte y la cobra. Trabaja indistintamente en escritorio (carga y edición pesada) y en el celular (revisión, cambios rápidos, mostrarle algo a alguien). Es el dueño de todos los datos: no hay equipo, no hay roles, no hay edición concurrente.

Usuario secundario: **el cliente**, que nunca entra a la app con cuenta. Llega por un enlace público (`/share/[token]`), lee el plan, comenta pieza por pieza y aprueba. Suele abrirlo desde el celular y no vuelve seguido: cada visita tiene que explicarse sola.

## Product Purpose

Llevar el ciclo completo de una planificación mensual de contenido —ideas, formato, referencias, storyboards, aprobación del cliente y cobro— en un solo lugar, sin armar la herramienta antes de poder usarla.

Éxito: el creador arma el plan del mes en una sentada, el cliente lo aprueba sin llamadas ni audios, y el creador ve en cualquier momento qué falta producir y qué falta cobrar.

## Positioning

Notion puede modelar esto, pero hay que construirlo: cada mes es una base de datos que alguien arma, mantiene y explica. WiwiPlan llega con el flujo ya formado —cliente → mes → ideas → storyboard → aprobación → cobro— y con la parte que Notion no tiene: **un enlace de aprobación pensado para alguien que no usa la herramienta**, y **el dinero pegado al plan**, no en otra planilla.

Las cuatro apuestas donde tiene que ganarle a Notion, confirmadas por el usuario:

1. **Cargar ideas rápido.** Escribir veinte ideas del mes sin pelear con la interfaz: teclado, pegar links e imágenes, duplicar, atajos.
2. **Ver el mes.** El plan como calendario de publicaciones: arrastrar piezas a fechas, ver huecos y choques.
3. **El momento de aprobación.** Que el cliente entienda y apruebe sin fricción, comente pieza por pieza, y quede registro.
4. **Plata y estado.** De un vistazo: qué se debe, qué falta producir, en qué está cada pieza.

## Operating Context

- El trabajo se organiza por **cliente** y dentro de cada cliente por **mes** (`period`, formato `YYYY-MM`). El mes es la unidad real de trabajo y de cobro.
- Cada plan tiene estado: Borrador → En Progreso → Revisión → Aprobado → Publicado.
- Cada idea de contenido tiene formato (carrusel, reel, video, imagen, historia, estático), plataforma (Instagram, TikTok, YouTube, Vimeo, LinkedIn, Facebook), pilar de contenido, prioridad, fecha de entrega, estado propio (Idea → Seleccionada → En Producción → Lista), tags, referencia (URL con embed o imagen pegada) y comentarios del cliente.
- Los storyboards son secuencias de escenas con imagen, descripción, notas y duración; se vinculan a una idea.
- Cada **cliente** tiene un plan contratado (nombre + tarifa mensual). La tarifa es el contrato y siembra el valor de cada mes nuevo, para no reescribir el mismo número doce veces al año.
- El **valor del mes** se compone de líneas (honorarios del plan, extras acordados sobre la marcha, descuentos en negativo). `Planning.priceCents` es la suma cacheada de esas líneas y no se escribe a mano.
- Los cobros se registran contra ese valor, en dólares, con fecha, medio y nota; el saldo se calcula solo. El recibo desglosa las líneas cuando hay más de una.
- Un movimiento puede ser **cobro**, **retención** o **ajuste**. Los tres cierran saldo, pero sólo el cobro es plata que entró: al facturar a empresas el cliente transfiere menos de lo facturado y la diferencia es una retención, no una deuda. Sólo los cobros generan recibo.
- Cada mes registra también sus **costos** (equipo, pauta, producción, herramientas). Un costo puede marcarse **recobrable**: entra al valor del mes y sale en la factura como línea propia, sin cargarlo dos veces. Suma igual de los dos lados, así que el margen no se mueve. Los costos no recobrables **nunca** cruzan al lado del cliente: mostrarlos sería mostrarle el margen. `priceCents` = líneas + costos recobrables; `costCents` = todos los costos; las dos las mantiene `recalcPlanningMoney` en la misma transacción.
- La deuda es **del cliente, no del mes**: `/clients/[id]` muestra el estado de cuenta acumulado de todos sus meses, cuál es el más viejo con saldo y los últimos movimientos juntos. El arrastre es de lectura: no se crea una línea de "saldo anterior" en el mes siguiente, porque contaría la misma deuda dos veces.
- Un mes se puede **duplicar del anterior**, y arranca **apagado**: crear un mes nuevo no trae nada salvo que se pida. Al elegir molde viajan las ideas (como ideas nuevas, sin comentarios, imágenes ni estado de producción), el valor con sus líneas y las cuotas corridas al mes destino. Los cobros registrados y los storyboards no se copian.
- El enlace compartido es de solo lectura salvo comentar y aprobar; puede tener vencimiento.
- La **búsqueda global** (Ctrl/⌘+K, o la lupa del encabezado) cruza clientes, meses y piezas de contenido a la vez, con el fragmento del texto que coincidió. Responde "¿en qué mes hicimos ese carrusel de precios?", que antes obligaba a acordarse del cliente y del mes para llegar a la pieza. Es sensible a tildes.
- Cada cliente declara **sus redes** (`/clients/[id]`), con el usuario de cada una. Cada pieza elige después entre esas, sin repetir la lista completa.
- Publicar tiene **dos carriles**, y cuál toca no lo decidimos nosotros: Instagram sólo publica por API en cuentas Business/Creator, así que en las personales no hay forma legítima de que un servidor publique. Las cuentas conectadas van a poder salir solas (`AUTOMATIC`); las demás avisan a la hora y el creador publica de un toque (`ASSISTED`). Hoy **todas** son asistidas: el modo automático se rechaza en la API hasta que exista la conexión, para no dejar publicaciones que nunca salen.
- El día y la hora de publicación viven separados a propósito: `dueDate` es un día de calendario y `publishTime` es hora de reloj (`"09:00"`), así ninguna zona horaria corre una publicación al día anterior.
- En pantalla nunca aparece el vocabulario interno: se lee "Te avisamos" y "Sale sola", y la frase completa es "Sábado 15 de agosto a las 9:00 am".
- La **agenda** (`/agenda`) cruza todos los clientes y responde "¿qué me toca hoy?", que con seis clientes en paralelo no se contesta abriendo seis meses. Agrupa en Se pasaron / Hoy / Mañana / Esta semana / Más adelante / Sin fecha. Una pieza cuyo día pasó sólo aparece como atrasada si **no** salió en todas sus redes.
- Cada pieza tiene **copy** (`caption`) aparte de la **descripción**: la descripción es el brief —de qué trata— y el copy es el texto que se pega en la red, que suele escribirse cerca de la fecha.
- La pantalla `/publicar/[ideaId]` es el momento de publicar: el copy con un botón de copiar, las referencias para reconocer la pieza, y por cada red un botón para abrirla y otro para marcar que ya salió. El aviso lleva ahí y no a la pieza dentro del mes, porque en ese instante todo lo demás es ruido.
- **Avisos de publicación**: cuando llega la hora de una pieza que todavía no salió, llega un aviso push al teléfono. Se activan por dispositivo desde la agenda —el permiso lo da el navegador, no la app—, y en iPhone sólo existen con la app instalada en la pantalla de inicio, cosa que la pantalla dice en vez de dejar que alguien lo descubra tocando.
- Desde la agenda se puede **probar el aviso** al instante y **disparar el barrido a mano**. Existen porque "activé los avisos y no llegó nada" tiene tres causas —el permiso, las llaves del servidor, o que nada haya llegado a su hora— y sin eso no se distinguen; y porque el cron **sólo corre en Vercel**, así que en desarrollo no hay ninguna otra forma de probarlo.
- La app trae **su propio reloj** (`src/instrumentation.ts` → `publish-loop.server.ts`): un intervalo dentro del proceso del servidor que revisa cada minuto sin depender de nadie. Funciona siempre que la app corra como proceso vivo —`npm run dev`, un VPS, Railway, Docker— y se apaga solo en Vercel, donde cada petición prende y apaga una función y no queda nada corriendo que pueda contar el tiempo.
- **Cadencia del barrido:** la hora justa se agenda pieza por pieza (`src/lib/publish-schedule.server.ts`): al programar o clonar una pieza, QStash despierta el barrido justo a su hora de publicación. Las redes de seguridad son el cron diario de `vercel.json` y la revisión automática con la agenda abierta; el ping por GitHub Actions se retiró porque los crons de Actions llegaban con retrasos de media hora a una hora — peor de lo que su frecuencia prometía cubrir. El endpoint va abierto a propósito: el push sólo llega al dueño y repetir el barrido es idempotente, así que un secreto ahí sólo añadiría configuración frágil sin proteger nada real. Un webhook no sirve acá: no hay evento externo que avise, el evento es que pasó el tiempo — QStash lo convierte en una cita agendada.
- Las llaves VAPID **entregan** el aviso; el reloj **decide** que toca enviarlo. Son piezas distintas y la confusión entre las dos es la que hace pensar que "el push no funciona" cuando lo que falta es que alguien llame al endpoint.
- El barrido avisa una sola vez por pieza (`notifiedAt`) y nunca de algo atrasado más de 12 horas: despertar a alguien por una publicación de hace tres semanas no ayuda. Sólo marca como avisada si algún dispositivo la recibió, para reintentar si no había ninguno conectado.
- Ecuador es UTC-5 sin horario de verano, así que el instante real de publicación se calcula con un desplazamiento fijo (`APP_UTC_OFFSET_HOURS`). Si algún día hay clientes en otra zona, eso pasa a ser un dato del usuario.
- Las notificaciones avisan al creador cuando el cliente comenta o aprueba.
- **Pendiente y deliberado:** el recordatorio automático de saldo sólo se dispara si el plan tiene cuotas cargadas y vencidas. Ampliarlo haría salir cobranza automática a clientes reales sin que el usuario la revise, así que es una decisión suya, no un arreglo técnico.

## Capabilities and Constraints

- Next.js 16 (App Router, React 19), Tailwind v4, Prisma 7 + PostgreSQL, NextAuth v5 con credenciales, Radix primitives, dnd-kit, TipTap, sonner. PWA instalable (manifest + service worker), orientación vertical.
- Las imágenes de **referencia** se comprimen en el cliente y se sirven por URL desde la API; hay recompresión de originales ya hecha.
- El **archivo que se publica** es otra cosa y vive en almacenamiento de objetos (`MediaAsset`), no en la base: un reel de 80MB en Postgres no es viable, y sobre todo Meta no recibe el archivo —le das una URL pública y él la descarga—. Sin esa URL no hay publicación automática posible.
- La subida **no pasa por la API**: una función sin servidor acepta cuerpos de unos 4.5MB, así que el navegador sube directo al almacenamiento con un permiso firmado, y sólo el registro vuelve por la API. El registro es idempotente por `pathname` porque llega por dos caminos: el aviso del almacenamiento (que no alcanza a localhost) y la confirmación del navegador.
- Todo el contenido de la interfaz está en **español latino** (tuteo ecuatoriano: "Agrega", "Carga", "Tócalo").
- Datos por usuario: cada consulta filtra por `userId`. No hay compartición entre cuentas.
- **Decisión abierta:** el nombre "WiwiPlan" puede cambiar; el usuario lo dejó libre. Ningún trabajo debe asumir un nombre nuevo sin confirmarlo con él.
- Tocar una pieza en el calendario abre **cuándo y dónde sale**: la hora (con atajos a las horas típicas) y en qué redes del cliente. Vive ahí y no en un formulario aparte, porque es mirando el calendario cuando uno piensa "esto sale el martes". Las fichas muestran la hora y un punto del color de cada red.
- La pestaña **Calendario** muestra el mes como rejilla de publicaciones: las piezas se arrastran a un día (o se tocan y luego se toca el día, que es lo que funciona en el celular), se ven los huecos —días sin nada— y los choques —dos piezas el mismo día—. Las fechas de entrega son **fechas de calendario**, no instantes: se leen por sus componentes UTC para que no se corran un día.

## Brand Commitments

Identidad WIWI Estudio (definida por el usuario en agosto 2026):
- Color de marca: rojo #c42c33; blanco roto #fbf9fa para arte e isotipo; negro para texto de documentos.
- Tipografía original: Myriad Pro (PDF del logo); la app usa la sans del sistema como aproximación.
- Ícono de app: isotipo blanco sobre fondo rojo (public/icons), con variante maskable full-bleed.
- Superficie general: se mantiene el dark (#09090b sobre zinc); el rojo se reserva para acciones primarias y estados activos.

## Evidence on Hand

- Producto real y funcionando, con datos reales del usuario en su base.
- Assets: `public/pwa-icon.svg` (ícono actual, reemplazable). No hay logo profesional, ni fotos, ni material de marca.
- No hay clientes de referencia públicos, testimonios, métricas, precios ni casos de estudio. Nada de eso debe inventarse.

## Product Principles

1. **El mes es la unidad.** Toda navegación, memoria y resumen se organiza alrededor de cliente + mes; nunca alrededor de una lista global de tareas.
2. **La carga es el trabajo.** Escribir la idea número diecisiete tiene que costar lo mismo que la primera; cualquier fricción repetida se paga veinte veces por mes.
3. **El cliente no aprendió la herramienta.** Cada superficie que ve alguien de afuera se explica sola, en una sola pantalla, desde el celular.
4. **El dinero es parte del plan, no un anexo.** Precio, cobrado y saldo viven junto al trabajo que los generó.
5. **Nada que haya que armar antes de usar.** El flujo viene formado; configurar es la excepción, no el precio de entrada.

## Accessibility & Inclusion

Sin requisito formal establecido por el usuario. Restricciones de hecho que el trabajo previo ya asumió y que conviene sostener: contraste legible sobre fondo oscuro, áreas táctiles de 36–44px en móvil, campos a 16px para no disparar el zoom de iOS, y `env(safe-area-inset-*)` por la PWA a pantalla completa.
