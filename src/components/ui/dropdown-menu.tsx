"use client"

import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

const DropdownMenu = DropdownMenuPrimitive.Root
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
const DropdownMenuPortal = DropdownMenuPrimitive.Portal

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 6, align = "end", ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      align={align}
      collisionPadding={12}
      className={cn(
        "z-50 min-w-[11rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-white/10 bg-[#18181b] p-1.5 text-zinc-200 shadow-xl shadow-black/40",
        className,
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { destructive?: boolean }
>(({ className, destructive, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      // min-h-9 mantiene el área táctil cómoda en pantallas chicas
      "relative flex min-h-9 cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors",
      "focus:bg-white/[0.07] data-[highlighted]:bg-white/[0.07] data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      destructive
        ? "text-rose-400 focus:bg-rose-500/10 focus:text-rose-300 data-[highlighted]:bg-rose-500/10 data-[highlighted]:text-rose-300"
        : "text-zinc-300 focus:text-white data-[highlighted]:text-white",
      className,
    )}
    {...props}
  />
))
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn("px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500", className)}
    {...props}
  />
))
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator ref={ref} className={cn("-mx-1.5 my-1.5 h-px bg-white/10", className)} {...props} />
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

/** Item de selección única: muestra un tilde cuando `selected` es verdadero. */
const DropdownMenuCheckItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { selected?: boolean }
>(({ className, selected, children, ...props }, ref) => (
  <DropdownMenuItem ref={ref} className={cn("justify-between", className)} {...props}>
    <span className="flex items-center gap-2.5">{children}</span>
    {selected ? <Check size={14} className="shrink-0 text-zinc-300" /> : null}
  </DropdownMenuItem>
))
DropdownMenuCheckItem.displayName = "DropdownMenuCheckItem"

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
}
