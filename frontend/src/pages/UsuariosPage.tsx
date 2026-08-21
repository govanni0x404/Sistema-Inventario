import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, KeyRound, Pencil, Users as UsersIcon } from "lucide-react";
import { usuariosApi } from "../api/usuarios";
import { rolesApi } from "../api/roles";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { UsuarioAdmin } from "../types/usuario";
import type { Rol } from "../types/auth";
import type { RolCatalogo } from "../types/rol";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

type ModalNuevo = { nombre: string; email: string; password: string; rol: Rol };
type ModalEditar = { data: UsuarioAdmin; nombre: string; rol: Rol; activo: boolean };

export default function UsuariosPage() {
  const { usuario: yo } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[] | null>(null);
  const [roles, setRoles] = useState<RolCatalogo[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState<ModalNuevo | null>(null);
  const [editar, setEditar] = useState<ModalEditar | null>(null);
  const [resetTarget, setResetTarget] = useState<UsuarioAdmin | null>(null);
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | undefined>();

  const cargar = async () => {
    try {
      setLoadError(null);
      const [u, r] = await Promise.all([usuariosApi.listar(), rolesApi.listar(true)]);
      setUsuarios(u);
      setRoles(r);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "No se pudo conectar con el servidor");
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const crear = async () => {
    if (!nuevo) return;
    setSaving(true);
    setFieldErrors(undefined);
    try {
      const creado = await usuariosApi.crear(nuevo);
      setUsuarios((prev) => (prev ? [...prev, creado] : [creado]));
      toast.success("Usuario creado");
      setNuevo(null);
    } catch (e) {
      if (e instanceof ApiError) {
        setFieldErrors((e.detalles as { fieldErrors?: Record<string, string[]> })?.fieldErrors);
        toast.error(e.message);
      } else {
        toast.error("No se pudo crear el usuario");
      }
    } finally {
      setSaving(false);
    }
  };

  const guardarEdicion = async () => {
    if (!editar) return;
    setSaving(true);
    try {
      const actualizado = await usuariosApi.actualizar(editar.data.id, {
        nombre: editar.nombre.trim(),
        rol: editar.rol,
        activo: editar.activo,
      });
      setUsuarios((prev) => prev?.map((u) => (u.id === actualizado.id ? actualizado : u)) ?? prev);
      toast.success("Usuario actualizado");
      setEditar(null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo actualizar el usuario");
    } finally {
      setSaving(false);
    }
  };

  const confirmarReset = async () => {
    if (!resetTarget || nuevaPassword.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setSaving(true);
    try {
      await usuariosApi.resetPassword(resetTarget.id, nuevaPassword);
      toast.success("Contraseña actualizada");
      setResetTarget(null);
      setNuevaPassword("");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo actualizar la contraseña");
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className="font-body text-sm text-center py-10 text-destructive">
        {loadError} — <button className="underline" onClick={cargar}>reintentar</button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-muted flex-1">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary shrink-0">
            <UsersIcon size={16} />
          </span>
          <p className="font-body text-xs text-muted-foreground">
            Gestiona las cuentas que pueden acceder al sistema. Solo un administrador puede crear usuarios, cambiar
            roles, desactivar cuentas o restablecer contraseñas.
          </p>
        </div>
        <Button
          onClick={() => {
            setFieldErrors(undefined);
            const rolPorDefecto = roles.find((r) => r.nombre === "cajero")?.nombre ?? roles[0]?.nombre ?? "";
            setNuevo({ nombre: "", email: "", password: "", rol: rolPorDefecto });
          }}
        >
          <Plus size={16} /> Nuevo usuario
        </Button>
      </div>

      {usuarios === null && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {usuarios !== null && (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead className="w-24 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="font-body text-sm font-medium text-foreground">
                      {u.nombre}
                      {u.id === yo?.id && <span className="ml-1.5 text-xs text-muted-foreground">(tú)</span>}
                    </div>
                    <div className="font-body text-xs text-muted-foreground">{u.email}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {u.rol}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.activo ? "secondary" : "destructive"}>{u.activo ? "Activo" : "Inactivo"}</Badge>
                  </TableCell>
                  <TableCell className="font-body text-xs text-muted-foreground">
                    {new Date(u.creadoEn).toLocaleDateString("es-MX", { dateStyle: "medium" })}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditar({ data: u, nombre: u.nombre, rol: u.rol, activo: u.activo })}
                        aria-label="Editar"
                      >
                        <Pencil size={15} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setNuevaPassword("");
                          setResetTarget(u);
                        }}
                        aria-label="Restablecer contraseña"
                      >
                        <KeyRound size={15} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Nuevo usuario */}
      <Dialog open={!!nuevo} onOpenChange={(o) => !o && setNuevo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
          </DialogHeader>
          {nuevo && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <Input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
                {fieldErrors?.nombre?.[0] && <p className="text-xs text-destructive">{fieldErrors.nombre[0]}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Correo</Label>
                <Input type="email" value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} />
                {fieldErrors?.email?.[0] && <p className="text-xs text-destructive">{fieldErrors.email[0]}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Contraseña</Label>
                <Input
                  type="password"
                  value={nuevo.password}
                  onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })}
                />
                {fieldErrors?.password?.[0] && <p className="text-xs text-destructive">{fieldErrors.password[0]}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Rol</Label>
                <Select value={nuevo.rol} onValueChange={(v) => setNuevo({ ...nuevo, rol: v as Rol })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.nombre} className="capitalize">
                        {r.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setNuevo(null)}>
              Cancelar
            </Button>
            <Button onClick={crear} disabled={saving || !nuevo?.nombre || !nuevo?.email || !nuevo?.password}>
              {saving ? "Guardando..." : "Crear usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar usuario */}
      <Dialog open={!!editar} onOpenChange={(o) => !o && setEditar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
            <DialogDescription>{editar?.data.email}</DialogDescription>
          </DialogHeader>
          {editar && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <Input value={editar.nombre} onChange={(e) => setEditar({ ...editar, nombre: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Rol</Label>
                <Select
                  value={editar.rol}
                  onValueChange={(v) => setEditar({ ...editar, rol: v as Rol })}
                  disabled={editar.data.id === yo?.id}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.nombre} className="capitalize">
                        {r.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editar.data.id === yo?.id && (
                  <p className="text-xs text-muted-foreground">No puedes cambiar tu propio rol.</p>
                )}
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                <div>
                  <div className="font-body text-sm text-foreground">Cuenta activa</div>
                  <div className="font-body text-xs text-muted-foreground">
                    {editar.data.id === yo?.id ? "No puedes desactivar tu propia cuenta." : "Si la desactivas, no podrá iniciar sesión."}
                  </div>
                </div>
                <Switch
                  checked={editar.activo}
                  disabled={editar.data.id === yo?.id}
                  onCheckedChange={(v) => setEditar({ ...editar, activo: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditar(null)}>
              Cancelar
            </Button>
            <Button onClick={guardarEdicion} disabled={saving || !editar?.nombre.trim()}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restablecer contraseña */}
      <Dialog open={!!resetTarget} onOpenChange={(o) => !o && setResetTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Restablecer contraseña</DialogTitle>
            <DialogDescription>{resetTarget?.nombre}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Nueva contraseña</Label>
            <Input type="password" value={nuevaPassword} onChange={(e) => setNuevaPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmarReset} disabled={saving}>
              {saving ? "Guardando..." : "Restablecer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
