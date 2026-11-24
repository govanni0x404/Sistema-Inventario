import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import ConfirmDialog from "./ConfirmDialog";

type Entrada = { id: string; nombre: string; activo: boolean };
type Datos = { nombre?: string; activo?: boolean };
type CatalogoApi = {
  listar: () => Promise<Entrada[]>;
  crear: (data: { nombre: string }) => Promise<Entrada>;
  actualizar: (id: string, data: Datos) => Promise<Entrada>;
  eliminar: (id: string) => Promise<(Entrada & { _desactivado: true }) | undefined>;
};

const ordenar = (entradas: Entrada[]) => entradas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

export default function CatalogoProductoManager({
  api, singular, plural, ejemplo,
}: {
  api: CatalogoApi;
  singular: string;
  plural: string;
  ejemplo: string;
}) {
  const [entradas, setEntradas] = useState<Entrada[] | null>(null);
  const [error, setError] = useState(false);
  const [carga, setCarga] = useState(0);
  const [nombre, setNombre] = useState("");
  const [edicion, setEdicion] = useState<{ id: string; nombre: string } | null>(null);
  const [porEliminar, setPorEliminar] = useState<Entrada | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vigente = true;
    api.listar()
      .then((data) => { if (vigente) setEntradas(data); })
      .catch(() => { if (vigente) setError(true); });
    return () => { vigente = false; };
  }, [api, carga]);

  const mutar = async (accion: () => Promise<void>) => {
    setGuardando(true);
    try {
      await accion();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo guardar el cambio");
    } finally {
      setGuardando(false);
    }
  };

  const crear = (event: FormEvent) => {
    event.preventDefault();
    if (!nombre.trim() || guardando) return;
    return mutar(async () => {
      const nueva = await api.crear({ nombre: nombre.trim() });
      setEntradas((prev) => ordenar([...(prev ?? []), nueva]));
      setNombre("");
      toast.success("Registro creado");
    });
  };

  const actualizar = (id: string, datos: Datos) => mutar(async () => {
    const nueva = await api.actualizar(id, datos);
    setEntradas((prev) => ordenar(prev?.map((item) => item.id === id ? nueva : item) ?? []));
    setEdicion(null);
  });

  const eliminar = async () => {
    if (!porEliminar) return;
    await mutar(async () => {
      const resultado = await api.eliminar(porEliminar.id);
      setEntradas((prev) => resultado
        ? prev?.map((item) => item.id === resultado.id ? resultado : item) ?? []
        : prev?.filter((item) => item.id !== porEliminar.id) ?? []);
      toast.success(resultado ? "Registro desactivado. Sigue asociado a sus productos." : "Registro eliminado");
      setPorEliminar(null);
    });
  };

  return (
    <div className="max-w-3xl space-y-5">
      <p className="text-sm text-muted-foreground">Las {plural} activas están disponibles al crear o editar un producto.</p>
      <form onSubmit={crear} className="flex flex-wrap gap-2">
        <Input
          aria-label={`Nombre de la ${singular}`}
          placeholder={ejemplo}
          value={nombre}
          onChange={(event) => setNombre(event.target.value)}
          className="min-w-32 flex-1"
        />
        <Button type="submit" disabled={guardando || !nombre.trim() || !entradas}>
          <Plus size={16} /> Agregar {singular}
        </Button>
      </form>

      {error && (
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          No se pudieron cargar las {plural}.
          <Button variant="outline" size="sm" onClick={() => { setError(false); setCarga((n) => n + 1); }}>Reintentar</Button>
        </div>
      )}
      {!entradas && !error && <Skeleton className="h-24 w-full" aria-label="Cargando catálogo" />}
      {entradas?.length === 0 && <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">Aún no hay {plural}.</p>}
      {!!entradas?.length && (
        <ul className="divide-y overflow-hidden rounded-lg border">
          {entradas.map((item) => (
            <li key={item.id} className="px-3 py-2 sm:px-4">
              {edicion?.id === item.id ? (
                <form
                  className="flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (edicion.nombre.trim() && !guardando) actualizar(item.id, { nombre: edicion.nombre.trim() });
                  }}
                  onKeyDown={(event) => { if (event.key === "Escape" && !guardando) setEdicion(null); }}
                >
                  <Input autoFocus aria-label={`Nuevo nombre de ${item.nombre}`} value={edicion.nombre} onChange={(event) => setEdicion({ id: item.id, nombre: event.target.value })} />
                  <Button type="submit" variant="ghost" size="icon" aria-label="Guardar nombre" disabled={guardando || !edicion.nombre.trim()}><Check size={16} /></Button>
                  <Button type="button" variant="ghost" size="icon" aria-label="Cancelar edición" disabled={guardando} onClick={() => setEdicion(null)}><X size={16} /></Button>
                </form>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="text-sm font-medium [overflow-wrap:anywhere]">{item.nombre}</span>
                    <Badge variant={item.activo ? "secondary" : "outline"}>{item.activo ? "Activa" : "Inactiva"}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" disabled={guardando} onClick={() => actualizar(item.id, { activo: !item.activo })}>
                      {item.activo ? "Desactivar" : "Activar"}
                    </Button>
                    <Button variant="ghost" size="icon" disabled={guardando} aria-label={`Renombrar ${item.nombre}`} onClick={() => setEdicion(item)}><Pencil size={15} /></Button>
                    <Button variant="ghost" size="icon" disabled={guardando} aria-label={`Eliminar ${item.nombre}`} className="text-destructive" onClick={() => setPorEliminar(item)}><Trash2 size={15} /></Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!porEliminar}
        title={`Eliminar ${singular}`}
        message={`¿Eliminar “${porEliminar?.nombre}”? Si tiene productos asociados, se desactivará y conservará sus asociaciones.`}
        onCancel={() => setPorEliminar(null)}
        onConfirm={eliminar}
      />
    </div>
  );
}
