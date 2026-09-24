"use client"

import { useState } from "react"
import { Send, Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { IdeaComment } from "./idea-types"

/**
 * La conversación de una pieza con el cliente, del lado del creador.
 *
 * Antes los comentarios se podían leer pero no contestar: la respuesta se iba
 * a WhatsApp y el mes siguiente nadie sabía qué se había acordado. Ahora se
 * responde acá y el cliente lo ve en su enlace, debajo de lo que pidió.
 */
export function IdeaComments({
  ideaId,
  comments,
  onChange,
}: {
  ideaId: string
  comments: IdeaComment[]
  onChange: (comments: IdeaComment[]) => void
}) {
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)

  const send = async () => {
    const msg = text.trim()
    if (!msg || sending) return
    setSending(true)
    const res = await fetch(`/api/ideas/${ideaId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: msg }),
    }).catch(() => null)
    setSending(false)
    if (!res?.ok) {
      toast.error("No se pudo enviar la respuesta")
      return
    }
    const created = await res.json()
    onChange([...comments, { ...created, createdAt: String(created.createdAt) }])
    setText("")
  }

  const remove = async (comment: IdeaComment) => {
    if (!confirm("¿Borrar este comentario? El cliente tampoco lo va a ver.")) return
    onChange(comments.filter((c) => c.id !== comment.id))
    const res = await fetch(
      `/api/ideas/${ideaId}/comments?commentId=${encodeURIComponent(comment.id)}`,
      { method: "DELETE" },
    ).catch(() => null)
    if (!res?.ok) {
      onChange(comments)
      toast.error("No se pudo borrar el comentario")
    }
  }

  return (
    <div className="space-y-2">
      {comments.length === 0 ? (
        <p className="text-xs text-zinc-500">
          Sin comentarios. Lo que el cliente escriba en su enlace aparece acá, y lo que respondas lo ve él.
        </p>
      ) : (
        <ul className="space-y-2">
          {comments.map((c) => (
            <li
              key={c.id}
              className={`group rounded-lg border px-3 py-2 ${
                c.byOwner ? "ml-6 border-brand/25 bg-brand/[0.06]" : "border-white/5 bg-[#0a0a0c]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-zinc-300">
                  {c.authorName}
                  <span className="ml-1.5 font-normal text-zinc-500">
                    {new Date(c.createdAt).toLocaleString("es-EC", {
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => remove(c)}
                  aria-label="Borrar comentario"
                  className="-mr-1.5 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-opacity hover:bg-white/5 hover:text-rose-300 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <p className="whitespace-pre-wrap text-sm text-zinc-200">{c.text}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#18181b] px-3 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-600"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder={comments.some((c) => !c.byOwner) ? "Responder al cliente…" : "Dejar una nota para el cliente…"}
          maxLength={2000}
          disabled={sending}
        />
        <button
          type="button"
          onClick={send}
          disabled={sending || !text.trim()}
          aria-label="Enviar"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand text-white transition-colors hover:bg-[#d0424a] disabled:opacity-40"
        >
          <Send size={14} className={sending ? "animate-pulse" : ""} />
        </button>
      </div>
    </div>
  )
}
