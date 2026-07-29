"use client"

import { useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { Button } from "@/components/ui/button"
import { CheckCircle } from "lucide-react"

interface SharedPlanViewProps {
  plan: {
    id: string
    title: string
    content: unknown
    status: string
    client?: { id: string; name: string } | null
  }
  clientName: string | null
}

export function SharedPlanView({ plan, clientName }: SharedPlanViewProps) {
  const [status, setStatus] = useState(plan.status)
  const [isApproving, setIsApproving] = useState(false)

  const editor = useEditor({
    extensions: [StarterKit],
    content: plan.content as Record<string, unknown>,
    editable: false,
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose-base dark:prose-invert max-w-none focus:outline-none",
      },
    },
  })

  const handleApprove = async () => {
    setIsApproving(true)
    try {
      const res = await fetch(`/api/plans/${plan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
      })
      if (res.ok) {
        setStatus("APPROVED")
      }
    } finally {
      setIsApproving(false)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{plan.title}</h1>
            {clientName && (
              <p className="mt-1 text-sm text-muted-foreground">
                Planificación para: <span className="font-medium">{clientName}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                status === "APPROVED"
                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                  : status === "PUBLISHED"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                  : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
              }`}
            >
              {status === "APPROVED" ? "Aprobado" : status === "PUBLISHED" ? "Publicado" : "Borrador"}
            </span>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <EditorContent editor={editor} />
        </div>

        {status !== "APPROVED" && (
          <div className="mt-8 flex justify-center">
            <Button
              size="lg"
              onClick={handleApprove}
              disabled={isApproving}
              className="gap-2"
            >
              <CheckCircle className="h-5 w-5" />
              {isApproving ? "Aprobando..." : "Aprobar Planificación"}
            </Button>
          </div>
        )}

        {status === "APPROVED" && (
          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-lg bg-green-50 px-6 py-3 text-green-700 dark:bg-green-900/20 dark:text-green-400">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Planificación aprobada</span>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
