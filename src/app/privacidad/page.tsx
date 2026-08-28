import type { Metadata } from "next"

/**
 * Política de privacidad. Meta la exige para publicar la app, y sin ella la
 * pantalla de configuración básica no deja avanzar.
 *
 * Está escrita describiendo lo que la app hace de verdad, no con texto de
 * plantilla: si dice que se guardan tokens de Instagram es porque se guardan, y
 * si dice que no se venden datos es porque no hay a quién vendérselos. Una
 * política que no coincide con el sistema es peor que no tenerla.
 */

export const metadata: Metadata = {
  title: "Política de privacidad — WiwiPlan",
  description: "Qué datos guarda WiwiPlan, para qué y con quién se comparten.",
}

/** El contacto es público: conviene un correo de la agencia, no uno personal. */
const CONTACTO = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "hola@wiwiestudio.com"

const ACTUALIZADA = "25 de agosto de 2026"

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 text-lg font-semibold tracking-tight text-zinc-100">{titulo}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-zinc-400">{children}</div>
    </section>
  )
}

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-300">
      <main className="mx-auto max-w-2xl px-5 py-12 sm:py-16">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
          Política de privacidad
        </h1>
        <p className="mb-10 mt-2 text-sm text-zinc-500">Actualizada el {ACTUALIZADA}</p>

        <Seccion titulo="Qué es WiwiPlan">
          <p>
            WiwiPlan es una herramienta interna de WIWI Estudio para planificar, aprobar y publicar
            el contenido de sus clientes. No es un servicio abierto al público: sólo la accede el
            equipo de la agencia, y los clientes únicamente a través de enlaces de aprobación que se
            les comparten.
          </p>
        </Seccion>

        <Seccion titulo="Qué datos guardamos">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-zinc-300">De los clientes:</strong> nombre, correo, logo y el
              plan contratado.
            </li>
            <li>
              <strong className="text-zinc-300">Del trabajo:</strong> ideas de contenido, textos,
              imágenes de referencia, storyboards y los archivos que se publican.
            </li>
            <li>
              <strong className="text-zinc-300">Del cobro:</strong> valores acordados, pagos
              registrados y costos de producción.
            </li>
            <li>
              <strong className="text-zinc-300">De las redes conectadas:</strong> el identificador
              de la cuenta, el usuario y un token de acceso que permite publicar en ella. El token
              se guarda cifrado.
            </li>
            <li>
              <strong className="text-zinc-300">De los avisos:</strong> la dirección que el
              navegador asigna a cada dispositivo para recibir notificaciones.
            </li>
          </ul>
          <p>
            No guardamos contraseñas de redes sociales. La autorización se hace en la pantalla de
            Meta y nosotros sólo recibimos un permiso revocable.
          </p>
        </Seccion>

        <Seccion titulo="Para qué los usamos">
          <p>
            Únicamente para operar la herramienta: armar la planificación, mostrarla al cliente para
            que la apruebe, llevar el control de cobros y publicar el contenido en las redes que el
            cliente autorizó, en la fecha y hora programadas.
          </p>
          <p>
            <strong className="text-zinc-300">
              No vendemos, alquilamos ni compartimos estos datos con terceros para publicidad.
            </strong>{" "}
            No hay seguimiento publicitario ni perfilado de ninguna clase.
          </p>
        </Seccion>

        <Seccion titulo="Con quién se comparten">
          <p>Sólo con los servicios necesarios para que la herramienta funcione:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-zinc-300">Vercel</strong> — alojamiento de la aplicación y de
              los archivos que se publican.
            </li>
            <li>
              <strong className="text-zinc-300">Neon</strong> — base de datos.
            </li>
            <li>
              <strong className="text-zinc-300">Meta</strong> — publicación en Instagram y Facebook,
              únicamente en las cuentas que se hayan conectado.
            </li>
            <li>
              <strong className="text-zinc-300">Upstash</strong> — programación de los avisos a la
              hora indicada.
            </li>
            <li>
              <strong className="text-zinc-300">Google, Apple o Mozilla</strong> — entrega de las
              notificaciones al dispositivo, según el navegador.
            </li>
            <li>
              <strong className="text-zinc-300">El servidor de correo configurado</strong> — envío
              de recibos y recordatorios de pago.
            </li>
          </ul>
        </Seccion>

        <Seccion titulo="Los archivos que se publican">
          <p>
            Para que Instagram y Facebook puedan tomar el contenido, los archivos se guardan en una
            dirección accesible públicamente. Las direcciones llevan un sufijo aleatorio y no se
            listan en ninguna parte, pero cualquiera que tenga el enlace exacto puede verlas. Es un
            requisito de las redes, no una elección nuestra, y aplica a material cuyo destino es ser
            publicado de todos modos.
          </p>
        </Seccion>

        <Seccion titulo="Cuánto tiempo los guardamos">
          <p>
            Mientras el cliente siga siendo cliente. Al eliminar un cliente de la herramienta se
            borran también sus planificaciones, contenidos, archivos y conexiones. Un cliente puede
            pedir en cualquier momento que se elimine todo lo suyo.
          </p>
        </Seccion>

        <Seccion titulo="Cómo se revoca el acceso a una red">
          <p>Hay dos formas, y las dos funcionan de inmediato:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Pedirnos que desconectemos la cuenta desde WiwiPlan, escribiendo a{" "}
              <a href={`mailto:${CONTACTO}`} className="text-zinc-200 underline underline-offset-2">
                {CONTACTO}
              </a>
              .
            </li>
            <li>
              Quitar el permiso directamente desde la configuración de la cuenta de Facebook o
              Instagram, en la sección de aplicaciones conectadas. No hace falta avisarnos.
            </li>
          </ul>
        </Seccion>

        <Seccion titulo="Eliminación de datos">
          <p>
            Para solicitar la eliminación de todos los datos asociados a una cuenta o a un cliente,
            escribe a{" "}
            <a href={`mailto:${CONTACTO}`} className="text-zinc-200 underline underline-offset-2">
              {CONTACTO}
            </a>{" "}
            indicando de qué cuenta o cliente se trata. La eliminación se realiza dentro de los 30
            días siguientes y se confirma por el mismo medio.
          </p>
        </Seccion>

        <Seccion titulo="Contacto">
          <p>
            Cualquier duda sobre esta política o sobre los datos que manejamos:{" "}
            <a href={`mailto:${CONTACTO}`} className="text-zinc-200 underline underline-offset-2">
              {CONTACTO}
            </a>
            .
          </p>
        </Seccion>

        <p className="mt-12 border-t border-white/5 pt-6 text-xs text-zinc-600">
          WIWI Estudio · Ecuador
        </p>
      </main>
    </div>
  )
}
