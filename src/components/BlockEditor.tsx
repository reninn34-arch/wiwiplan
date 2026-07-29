"use client"

import { useCallback, useEffect, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import { Button } from "@/components/ui/button"

interface BlockEditorProps {
  initialContent?: Record<string, unknown>
  onSave?: (json: Record<string, unknown>) => void
  editable?: boolean
}

export function BlockEditor({ initialContent, onSave, editable = true }: BlockEditorProps) {
  const [isSaving, setIsSaving] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "Escribe aquí o teclea / para comandos...",
      }),
    ],
    content: initialContent ?? {
      type: "doc",
      content: [{ type: "paragraph" }],
    },
    editable,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose-base dark:prose-invert max-w-none focus:outline-none min-h-[200px] px-0",
      },
    },
  })

  const save = useCallback(() => {
    if (!editor || !onSave) return
    setIsSaving(true)
    onSave(editor.getJSON() as Record<string, unknown>)
    setTimeout(() => setIsSaving(false), 500)
  }, [editor, onSave])

  useEffect(() => {
    if (!editor) return
    const handler = () => save()
    editor.on("update", handler)
    return () => { editor.off("update", handler) }
  }, [editor, save])

  if (!editor) return null

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-1">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            label="N"
            className="font-bold"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            label="I"
            className="italic"
          />
          <span className="mx-1 h-5 w-px bg-border" />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive("heading", { level: 1 })}
            label="H1"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive("heading", { level: 2 })}
            label="H2"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive("heading", { level: 3 })}
            label="H3"
          />
          <span className="mx-1 h-5 w-px bg-border" />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
            label="•"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
            label="1."
          />
        </div>
        {editable && onSave && (
          <Button size="sm" onClick={save} disabled={isSaving}>
            {isSaving ? "Guardando..." : "Guardar"}
          </Button>
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

function ToolbarButton({
  onClick,
  active,
  label,
  className,
}: {
  onClick: () => void
  active: boolean
  label: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded text-sm transition-colors ${
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      } ${className ?? ""}`}
    >
      {label}
    </button>
  )
}
