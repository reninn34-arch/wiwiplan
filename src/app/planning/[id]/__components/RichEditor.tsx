"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import { Bold, Italic, List, ListOrdered, Heading2, Undo, Redo } from "lucide-react"

const toolLabels: Record<string, string> = {
  bold: "Negrita",
  italic: "Cursiva",
  heading: "Título",
  bulletList: "Lista",
  orderedList: "Lista numerada",
  undo: "Deshacer",
  redo: "Rehacer",
}

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
}

export function RichEditor({ value, onChange, placeholder, className }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: placeholder ?? "Escribe algo..." }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[100px] px-3 py-2 text-sm",
      },
    },
  })

  if (!editor) return null

  // pointerdown (no mousedown): en pantallas táctiles el mousedown emulado llega
  // tarde y a veces se cancela, así que los botones no respondían al primer toque.
  const btn = (label: string, active: boolean, onClick: () => void) => (
    <button
      type="button"
      onPointerDown={(e) => { e.preventDefault(); onClick() }}
      aria-label={toolLabels[label] ?? label}
      aria-pressed={active}
      className={`flex h-9 w-9 items-center justify-center rounded text-xs transition-colors sm:h-7 sm:w-7 ${active ? "bg-white/20 text-white" : "text-zinc-400 hover:bg-white/5"}`}
      title={toolLabels[label] ?? label}
    >
      {label === "bold" ? <Bold className="h-3.5 w-3.5" /> :
       label === "italic" ? <Italic className="h-3.5 w-3.5" /> :
       label === "bulletList" ? <List className="h-3.5 w-3.5" /> :
       label === "orderedList" ? <ListOrdered className="h-3.5 w-3.5" /> :
       label === "heading" ? <Heading2 className="h-3.5 w-3.5" /> :
       label === "undo" ? <Undo className="h-3.5 w-3.5" /> :
       <Redo className="h-3.5 w-3.5" />}
    </button>
  )

  return (
    <div className={`rounded-md border border-white/5 bg-[#0c0c0e] ${className ?? ""}`}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-white/5 px-2 py-1">
        {btn("bold", editor.isActive("bold"), () => editor.chain().focus().toggleBold().run())}
        {btn("italic", editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run())}
        <span className="mx-1 h-4 w-px bg-border" />
        {btn("heading", editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
        {btn("bulletList", editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run())}
        {btn("orderedList", editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run())}
        <span className="mx-1 h-4 w-px bg-border" />
        {btn("undo", false, () => editor.chain().focus().undo().run())}
        {btn("redo", false, () => editor.chain().focus().redo().run())}
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
