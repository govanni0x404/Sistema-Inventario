import { useState } from "react";
import { ChevronsUpDown, KeyRound, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import CambiarPasswordDialog from "./CambiarPasswordDialog";

const iniciales = (nombre: string) =>
  nombre
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export default function UserMenu({ collapsed }: { collapsed?: boolean }) {
  const { usuario, logout } = useAuth();
  const [cambiandoPassword, setCambiandoPassword] = useState(false);
  if (!usuario) return null;

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-sidebar-accent transition-colors cursor-pointer"
          aria-label="Menú de usuario"
        >
          <Avatar className="size-8 shrink-0">
            <AvatarFallback className="bg-primary/15 text-primary font-display text-xs">
              {iniciales(usuario.nombre)}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <div className="font-body text-xs font-medium text-sidebar-foreground truncate">{usuario.nombre}</div>
                <div className="font-body text-[11px] text-muted-foreground capitalize">{usuario.rol}</div>
              </div>
              <ChevronsUpDown size={14} className="text-muted-foreground shrink-0" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="font-body text-sm font-medium text-foreground truncate">{usuario.nombre}</div>
          <div className="font-body text-xs text-muted-foreground truncate">{usuario.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setCambiandoPassword(true)}>
          <KeyRound size={15} /> Cambiar contraseña
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={logout}>
          <LogOut size={15} /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <CambiarPasswordDialog open={cambiandoPassword} onClose={() => setCambiandoPassword(false)} />
    </>
  );
}
