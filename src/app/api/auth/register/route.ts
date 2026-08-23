import { NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email y contraseña requeridos" }, { status: 400 })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 })
    }

    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 })
    }

    const exists = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (exists) {
      return NextResponse.json({ error: "El email ya está registrado" }, { status: 400 })
    }

    const hashedPassword = await hash(password, 12)

    const user = await prisma.user.create({
      data: { email: normalizedEmail, password: hashedPassword, name: name || normalizedEmail.split("@")[0] },
    })

    return NextResponse.json({ id: user.id, email: user.email, name: user.name }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Error al registrar" }, { status: 500 })
  }
}
