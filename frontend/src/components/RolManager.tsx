import { useEffect, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Check, X, ShieldCheck } from "lucide-react";
import { rolesApi } from "../api/roles";
import { ApiError } from "../api/client";
import type { RolCatalogo } from "../types/rol";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export default function RolManager({ onChange }: { onChange?: () => void }) {
  const [roles, setRoles] = useState<RolCatalogo[]>([]);
  const [nombre, setNombre] = useState("");
  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    try {
      setRoles(await rolesApi.listar());
    } catch {
      toast.error("No se pudieron cargar los roles");
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    setCreando(true);
    try {
      const nuevo = await rolesApi.crear({ nombre: nombre.trim() });
      setRoles((prev) => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setNombre("");
      onChange?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo crear el rol");
    } finally {
      setCreando(false);
    }
  };

  const toggleActivo = async (rol: RolCatalogo) => {
    try {
      const actualizado = await rolesApi.actualizar(rol.id, { activo: !rol.activo });
      setRoles((prev) => prev.map((r) => (r.id === actualizado.id ? actualizado : r)));
      onChange?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo actualizar");
    }
  };

  const empezarEdicion = (rol: RolCatalogo) => {
    setEditandoId(rol.id);
    setEditNombre(rol.nombre);
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setEditNombre("");
  };

  const guardarEdicion = async (rol: RolCatalogo) => {
    const nuevoNombre = editNombre.trim();
    if (!nuevoNombre || nuevoNombre === rol.nombre) {
      cancelarEdicion();
      return;
    }
    setGuardando(true);
    try {
      const actualizado = await rolesApi.actualizar(rol.id, { nombre: nuevoNombre });
      setRoles((prev) => prev.map((r) => (r.id === actualizado.id ? actualizado : r)).sort((a, b) => a.nombre.localeCompare(b.nombre)));
      cancelarEdicion();
      onChange?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo renombrar el rol");
    } finally {
      setGuardando(false);
    }
  };

  const handleEditKeyDown = (e: KeyboardEvent<HTMLInputElement>, rol: RolCatalogo) => {
    if (e.key === "Enter") {
      e.preventDefault();
      guardarEdicion(rol);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelarEdicion();
    }
  };

  const eliminar = async (rol: RolCatalogo) => {
    try {
      const resultado = await rolesApi.eliminar(rol.id);
      if (resultado?._desactivado) {
        setRoles((prev) => prev.map((r) => (r.id === resultado.id ? resultado : r)));
        toast("Había usuarios con este rol: se desactivó en lugar de eliminarse");
      } else {
        setRoles((prev) => prev.filter((r) => r.id !== rol.id));
        toast.success("Rol eliminado");
      }
      onChange?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo eliminar");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base">Roles</CardTitle>
        <CardDescription>
          Se eligen al crear o editar un usuario, y aparecen en Permisos para configurar qué secciones ven. El rol{" "}
          <strong className="text-foreground">admin</strong> es protegido: siempre tiene acceso total y no se puede
          renombrar ni eliminar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 mb-4">
          {roles.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              {editandoId === r.id ? (
                <Input
                  autoFocus
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  onKeyDown={(e) => handleEditKeyDown(e, r)}
                  onBlur={() => guardarEdicion(r)}
                  className="h-8"
                  disabled={guardando}
                />
              ) : (
                <span className="font-body text-sm text-foreground capitalize">{r.nombre}</span>
              )}
              <div className="flex items-center gap-2 shrink-0">
                {r.protegido ? (
                  <Badge variant="secondary" className="gap-1">
                    <ShieldCheck size={12} /> Protegido
                  </Badge>
                ) : editandoId === r.id ? (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => guardarEdicion(r)} disabled={guardando} aria-label="Guardar">
                      <Check size={15} />
                    </Button>
                    <Button variant="ghost" size="icon" onMouseDown={(e) => e.preventDefault()} onClick={cancelarEdicion} aria-label="Cancelar">
                      <X size={15} />
                    </Button>
                  </>
                ) : (
                  <>
                    <Switch checked={r.activo} onCheckedChange={() => toggleActivo(r)} />
                    <Button variant="ghost" size="icon" onClick={() => empezarEdicion(r)} aria-label="Renombrar">
                      <Pencil size={14} />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => eliminar(r)} aria-label="Eliminar">
                      <Trash2 size={15} />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
          {roles.length === 0 && <div className="font-body text-xs text-muted-foreground">Aún no hay roles.</div>}
        </div>

        <form onSubmit={crear} className="flex gap-2">
          <Input placeholder="Nombre del rol (ej. Supervisor)" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <Button type="submit" disabled={creando}>
            <Plus size={16} /> Agregar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
