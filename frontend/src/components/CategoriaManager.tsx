import { useEffect, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { categoriasApi } from "../api/categorias";
import { ApiError } from "../api/client";
import type { Categoria } from "../types/categoria";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export default function CategoriaManager({ onChange }: { onChange?: () => void }) {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nombre, setNombre] = useState("");
  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    try {
      setCategorias(await categoriasApi.listar());
    } catch {
      toast.error("No se pudieron cargar las categorías");
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
      const nueva = await categoriasApi.crear({ nombre: nombre.trim() });
      setCategorias((prev) => [...prev, nueva].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setNombre("");
      onChange?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo crear la categoría");
    } finally {
      setCreando(false);
    }
  };

  const toggleActivo = async (categoria: Categoria) => {
    try {
      const actualizada = await categoriasApi.actualizar(categoria.id, { activo: !categoria.activo });
      setCategorias((prev) => prev.map((c) => (c.id === actualizada.id ? actualizada : c)));
      onChange?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo actualizar");
    }
  };

  const empezarEdicion = (categoria: Categoria) => {
    setEditandoId(categoria.id);
    setEditNombre(categoria.nombre);
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setEditNombre("");
  };

  const guardarEdicion = async (categoria: Categoria) => {
    const nuevoNombre = editNombre.trim();
    if (!nuevoNombre || nuevoNombre === categoria.nombre) {
      cancelarEdicion();
      return;
    }
    setGuardando(true);
    try {
      const actualizada = await categoriasApi.actualizar(categoria.id, { nombre: nuevoNombre });
      setCategorias((prev) => prev.map((c) => (c.id === actualizada.id ? actualizada : c)).sort((a, b) => a.nombre.localeCompare(b.nombre)));
      cancelarEdicion();
      onChange?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo renombrar la categoría");
    } finally {
      setGuardando(false);
    }
  };

  const handleEditKeyDown = (e: KeyboardEvent<HTMLInputElement>, categoria: Categoria) => {
    if (e.key === "Enter") {
      e.preventDefault();
      guardarEdicion(categoria);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelarEdicion();
    }
  };

  const eliminar = async (categoria: Categoria) => {
    try {
      const resultado = await categoriasApi.eliminar(categoria.id);
      if (resultado?._desactivado) {
        setCategorias((prev) => prev.map((c) => (c.id === resultado.id ? resultado : c)));
        toast("Tenía productos asociados: se desactivó en lugar de eliminarse");
      } else {
        setCategorias((prev) => prev.filter((c) => c.id !== categoria.id));
        toast.success("Categoría eliminada");
      }
      onChange?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo eliminar");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base">Categorías de producto</CardTitle>
        <CardDescription>Ej. Bebidas, Abarrotes, Limpieza — se eligen al crear o editar un producto.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 mb-4">
          {categorias.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              {editandoId === c.id ? (
                <Input
                  autoFocus
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  onKeyDown={(e) => handleEditKeyDown(e, c)}
                  onBlur={() => guardarEdicion(c)}
                  className="h-8"
                  disabled={guardando}
                />
              ) : (
                <span className="font-body text-sm text-foreground">{c.nombre}</span>
              )}
              <div className="flex items-center gap-2 shrink-0">
                {editandoId === c.id ? (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => guardarEdicion(c)} disabled={guardando} aria-label="Guardar">
                      <Check size={15} />
                    </Button>
                    <Button variant="ghost" size="icon" onMouseDown={(e) => e.preventDefault()} onClick={cancelarEdicion} aria-label="Cancelar">
                      <X size={15} />
                    </Button>
                  </>
                ) : (
                  <>
                    <Switch checked={c.activo} onCheckedChange={() => toggleActivo(c)} />
                    <Button variant="ghost" size="icon" onClick={() => empezarEdicion(c)} aria-label="Renombrar">
                      <Pencil size={14} />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => eliminar(c)} aria-label="Eliminar">
                      <Trash2 size={15} />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
          {categorias.length === 0 && <div className="font-body text-xs text-muted-foreground">Aún no hay categorías.</div>}
        </div>

        <form onSubmit={crear} className="flex gap-2">
          <Input placeholder="Nombre de la categoría (ej. Lácteos)" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <Button type="submit" disabled={creando}>
            <Plus size={16} /> Agregar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
