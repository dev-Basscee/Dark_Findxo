"use client"
import { Moon } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  return (
    <Button
      variant="outline"
      size="icon"
      className="relative bg-background/80 backdrop-blur-sm border-border/50 cursor-default transition-all duration-300 animate-fade-in"
      disabled
    >
      <Moon className="h-[1.2rem] w-[1.2rem]" />
      <span className="sr-only">Dark mode active</span>
    </Button>
  )
}
