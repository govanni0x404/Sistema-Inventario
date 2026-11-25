import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Barcode, ExternalLink, ImagePlus, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import type { Producto, ProductoInput, TipoImpuestoProducto } from "@/types/producto";
import type { Proveedor } from "@/types/proveedor";
import type { Categoria } from "@/types/categoria";
import type { Unidad } from "@/types/unidad";
import { proveedoresApi } from "@/api/proveedores";
import { categoriasApi } from "@/api/categorias";
import { unidadesApi } from "@/api/unidades";
import { productosApi } from "@/api/productos";
import { ApiError } from "@/api/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import ImagenProducto from "./ImagenProducto";
import QuickCreatePopover from "./QuickCreatePopover";

const SIN_ASIGNAR = "__none__";
const campo = "[&_[data-slot=input]]:min-h-12 [&_[data-slot=input]]:px-4 [&_[data-slot=input]]:text-base [&_[data-slot=select-trigger]]:min-h-12 [&_[data-slot=select-trigger]]:px-4 [&_[data-slot=select-trigger]]:text-base";
const contrasteCampo = "dark:[&_[data-slot=input]]:border-foreground/40 dark:[&_[data-slot=input]]:bg-background/60 dark:[&_[data-slot=select-trigger]]:border-foreground/40 dark:[&_[data-slot=select-trigger]]:bg-background/60";
const pestana = "min-h-11 gap-2 px-3 text-base font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground";
const panel = "rounded-xl border p-4 sm:p-6 dark:border-foreground/20";
const parametros = [
  { id: "activo", label: "Vigente" },
  { id: "ventaPublico", label: "Venta al público" },
  { id: "inventariable", label: "Inventariable" },
  { id: "mostrarPrecio", label: "Mostrar precio en catálogo" },
  { id: "ventaVolumen", label: "Venta por volumen" },
  { id: "esPack", label: "Es un pack" },
] as const;

type Foto = { tipo: "actual" | "archivo" | "enlace" | "quitar"; valor: string };

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className={cn("min-w-0 space-y-2", campo, contrasteCampo)}>
      <Label htmlFor={id} className="text-base leading-snug">{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function enlaceValido(valor: string) {
  try {
    const url = new URL(valor.trim());
    return url.protocol === "https:" && !url.username && !url.password && valor.length <= 2048;
  } catch {
    return false;
  }
}

export default function ProductoForm({ initial, catalogo, fieldErrors, onCancel, onDelete, onSave, saving }: {
  initial?: Producto;
  catalogo: Producto[];
  fieldErrors?: Record<string, string[]>;
  onCancel: () => void;
  onDelete?: () => void;
  onSave: (data: ProductoInput) => void;
  saving?: boolean;
}) {
  const [form, setForm] = useState(() => ({
    codigoBarras: initial?.codigoBarras ?? "", nombre: initial?.nombre ?? "",
    categoriaId: initial?.categoriaId ?? "", subfamilia: initial?.subfamilia ?? "",
    tipoImpuesto: initial?.tipoImpuesto ?? "iva19" as TipoImpuestoProducto,
    unidadId: initial?.unidadId ?? "", proveedorId: initial?.proveedorId ?? "",
    precioVenta: initial ? String(initial.precioVenta) : "", stockMinimo: String(initial?.stockMinimo ?? 0),
    activo: initial?.activo ?? true, ventaPublico: initial?.ventaPublico ?? true,
    inventariable: initial?.inventariable ?? true, mostrarPrecio: initial?.mostrarPrecio ?? true,
    ventaVolumen: initial?.ventaVolumen ?? false, esPack: initial?.esPack ?? false,
  }));
  const [tab, setTab] = useState("datos");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [foto, setFoto] = useState<Foto>({ tipo: "actual", valor: initial?.imagenUrl ?? "" });
  const [leyendo, setLeyendo] = useState(false);
  const [generando, setGenerando] = useState(false);
  const lectura = useRef(0);
  const esAdmin = useAuth().usuario?.rol === "admin";
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);

  useEffect(() => {
    proveedoresApi.listar().then(setProveedores).catch(() => toast.error("No se pudieron cargar los proveedores"));
    categoriasApi.listar(true).then(setCategorias).catch(() => toast.error("No se pudieron cargar las familias"));
    unidadesApi.listar(true).then(setUnidades).catch(() => toast.error("No se pudieron cargar las unidades"));
  }, []);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrores((prev) => ({ ...prev, [key]: "" }));
  }

  const unidadId = form.unidadId || unidades[0]?.id || "";
  const subfamilias = [...new Set(catalogo.flatMap((p) =>
    (p.categoriaId ?? "") === form.categoriaId && p.subfamilia ? [p.subfamilia] : []))]
    .sort((a, b) => a.localeCompare(b, "es-CL"));
  const err = (key: string) => errores[key] || fieldErrors?.[key]?.[0];

  const generar = async () => {
    setGenerando(true);
    try {
      const { codigoBarras } = await productosApi.generarCodigo();
      set("codigoBarras", codigoBarras);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo generar el código");
    } finally {
      setGenerando(false);
    }
  };

  const cambiarFoto = (nueva: Foto) => {
    lectura.current++;
    setLeyendo(false);
    setErrores((prev) => ({ ...prev, imagenUrl: "", imagenArchivo: "" }));
    setFoto(nueva);
  };

  const cargarFoto = async (archivo: File) => {
    const intento = ++lectura.current;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(archivo.type) || archivo.size > 2_097_152) {
      setLeyendo(false);
      setErrores((prev) => ({ ...prev, imagenArchivo: "Usa JPG, PNG, WebP o GIF de hasta 2 MB." }));
      return;
    }
    setLeyendo(true);
    const reader = new FileReader();
    const resultado = await new Promise<string | null>((resolve) => {
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(archivo);
    });
    if (lectura.current !== intento) return;
    if (resultado) cambiarFoto({ tipo: "archivo", valor: resultado });
    else {
      setLeyendo(false);
      setErrores((prev) => ({ ...prev, imagenArchivo: "No se pudo leer la imagen." }));
    }
  };

  const guardar = (event: FormEvent) => {
    event.preventDefault();
    if (saving || generando || leyendo) return;
    const nuevos: Record<string, string> = {};
    const precio = Number(form.precioVenta);
    const minimo = Number(form.stockMinimo);
    if (!form.nombre.trim()) nuevos.nombre = "Escribe el nombre del producto.";
    if (!unidadId) nuevos.unidadId = "Selecciona una unidad.";
    if (!form.precioVenta.trim() || !Number.isFinite(precio) || precio < 0 || precio > 99_999_999.99) nuevos.precioVenta = "Ingresa un precio válido.";
    if (!Number.isInteger(minimo) || minimo < 0 || minimo > 2_147_483_647) nuevos.stockMinimo = "Ingresa una cantidad entera válida.";
    if (foto.tipo === "enlace" && !enlaceValido(foto.valor)) nuevos.imagenUrl = "Pega un enlace HTTPS directo a la imagen.";
    setErrores(nuevos);
    if (Object.keys(nuevos).length) {
      setTab(nuevos.nombre || nuevos.unidadId ? "datos" : nuevos.precioVenta || nuevos.stockMinimo ? "parametros" : "imagen");
      return;
    }
    onSave({
      ...form, codigoBarras: form.codigoBarras.trim() || null, nombre: form.nombre.trim(),
      categoriaId: form.categoriaId || null, subfamilia: form.subfamilia.trim() || null, unidadId,
      proveedorId: form.proveedorId || null, precioVenta: precio, stockMinimo: minimo,
      ...(foto.tipo === "archivo" ? { imagenArchivo: foto.valor } : {}),
      ...(foto.tipo === "enlace" ? { imagenUrl: foto.valor.trim() } : {}),
      ...(foto.tipo === "quitar" ? { imagenUrl: null, imagenArchivo: null } : {}),
    });
  };

  const consultaImagen = [form.nombre.trim(), form.codigoBarras.trim()].filter(Boolean).join(" ");
  const vistaPrevia = foto.tipo === "enlace" && !enlaceValido(foto.valor) ? "" : foto.valor;

  return (
    <form onSubmit={guardar} noValidate className="min-w-0 space-y-5">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="Ficha del producto" className="h-auto w-full flex-wrap justify-start gap-1.5 p-1.5 sm:grid sm:grid-cols-3">
          <TabsTrigger className={pestana} value="datos"><Barcode size={18} /> Datos</TabsTrigger>
          <TabsTrigger className={pestana} value="parametros"><SlidersHorizontal size={18} /> Parámetros</TabsTrigger>
          <TabsTrigger className={pestana} value="imagen"><ImagePlus size={18} /> Imagen</TabsTrigger>
        </TabsList>
        <TabsContent value="datos" className={cn(panel, "grid gap-x-7 gap-y-5 sm:grid-cols-2 data-[state=inactive]:hidden")}>
          <Field id="producto-codigo" label="Código de barras" error={err("codigoBarras")}>
            <div className="flex flex-wrap gap-2">
              <Input id="producto-codigo" className="min-w-24 flex-1" value={form.codigoBarras} onChange={(e) => set("codigoBarras", e.target.value)} placeholder={initial ? "Escanea o escribe el código" : "Deja vacío para generarlo al guardar"} />
              <Button type="button" variant="outline" className="h-12 text-base" disabled={generando || saving} onClick={generar}>
                <Barcode size={15} /> {generando ? "Generando…" : "Generar EAN-13"}
              </Button>
            </div>
          </Field>
          <Field id="producto-nombre" label="Nombre del producto" error={err("nombre")}>
            <Input id="producto-nombre" value={form.nombre} onChange={(e) => set("nombre", e.target.value)} />
          </Field>
          <Field id="producto-familia" label="Familia" error={err("categoriaId")}>
            <div className="flex gap-2 [&>button[data-slot=button]]:size-12">
              <Select value={form.categoriaId || SIN_ASIGNAR} onValueChange={(v) => setForm((prev) => ({ ...prev, categoriaId: v === SIN_ASIGNAR ? "" : v, subfamilia: "" }))}>
                <SelectTrigger id="producto-familia" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_ASIGNAR}>Sin familia</SelectItem>
                  {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
              {esAdmin && <QuickCreatePopover label="Familia" placeholder="Nombre de la familia" onCreate={async (nombre) => {
                const nueva = await categoriasApi.crear({ nombre });
                setCategorias((prev) => [...prev, nueva]);
                setForm((prev) => ({ ...prev, categoriaId: nueva.id, subfamilia: "" }));
              }} />}
            </div>
          </Field>
          <Field id="producto-subfamilia" label="Subfamilia" error={err("subfamilia")}>
            <Input id="producto-subfamilia" list="producto-subfamilias" maxLength={120} value={form.subfamilia} onChange={(e) => set("subfamilia", e.target.value)} placeholder="Opcional" />
            <datalist id="producto-subfamilias">
              {subfamilias.map((nombre) => <option key={nombre} value={nombre} />)}
            </datalist>
          </Field>
          <Field id="producto-impuesto" label="Tipo de impuesto" error={err("tipoImpuesto")}>
            <Select value={form.tipoImpuesto} onValueChange={(v) => set("tipoImpuesto", v as TipoImpuestoProducto)}>
              <SelectTrigger id="producto-impuesto" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="iva19">IVA 19 % incluido</SelectItem><SelectItem value="exento">Exento de IVA</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field id="producto-unidad" label="Unidad" error={err("unidadId")}>
            <div className="flex gap-2 [&>button[data-slot=button]]:size-12">
              <Select value={unidadId} onValueChange={(v) => set("unidadId", v)}>
                <SelectTrigger id="producto-unidad" className="w-full"><SelectValue placeholder="Selecciona una unidad" /></SelectTrigger>
                <SelectContent>{unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>)}</SelectContent>
              </Select>
              {esAdmin && <QuickCreatePopover label="Unidad" placeholder="Ej. Unidad, kilo o caja" onCreate={async (nombre) => {
                const nueva = await unidadesApi.crear({ nombre });
                setUnidades((prev) => [...prev, nueva]);
                set("unidadId", nueva.id);
              }} />}
            </div>
          </Field>
        </TabsContent>
        <TabsContent value="parametros" className={cn(panel, "space-y-6")}>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {parametros.map(({ id, label }) => (
              <div key={id} className="flex min-h-14 items-center justify-between gap-3 rounded-lg border bg-background/55 px-4 py-3">
                <Label htmlFor={`producto-${id}`} className="text-base leading-snug">{label}</Label>
                <Switch id={`producto-${id}`} checked={form[id]} onCheckedChange={(value) => set(id, value)} />
              </div>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field id="producto-precio" label="Precio de venta" error={err("precioVenta")}>
              <Input id="producto-precio" type="number" min={0} step="0.01" value={form.precioVenta} onChange={(e) => set("precioVenta", e.target.value)} />
            </Field>
            <Field id="producto-stock-minimo" label="Stock mínimo" error={err("stockMinimo")}>
              <Input id="producto-stock-minimo" type="number" min={0} step={1} value={form.stockMinimo} onChange={(e) => set("stockMinimo", e.target.value)} />
            </Field>
            <Field id="producto-proveedor" label="Proveedor" error={err("proveedorId")}>
              <div className="flex gap-2 [&>button[data-slot=button]]:size-12">
                <Select value={form.proveedorId || SIN_ASIGNAR} onValueChange={(v) => set("proveedorId", v === SIN_ASIGNAR ? "" : v)}>
                  <SelectTrigger id="producto-proveedor" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value={SIN_ASIGNAR}>Sin asignar</SelectItem>
                    {proveedores.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
                <QuickCreatePopover label="Proveedor" placeholder="Nombre del proveedor" onCreate={async (nombre) => {
                  const nuevo = await proveedoresApi.crear({ nombre });
                  setProveedores((prev) => [...prev, nuevo]);
                  set("proveedorId", nuevo.id);
                }} />
              </div>
            </Field>
          </div>
        </TabsContent>
        <TabsContent value="imagen" className={cn(panel, "grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] data-[state=inactive]:hidden")}>
          <ImagenProducto key={vistaPrevia} url={vistaPrevia} alt="Vista previa del producto" className="aspect-[4/3] max-h-80 w-full" />
          <div className="min-w-0 space-y-4">
            <Field id="producto-archivo" label="Subir desde el equipo" error={err("imagenArchivo")}>
              <Input id="producto-archivo" type="file" className="file:mr-3 file:text-base" accept="image/jpeg,image/png,image/webp,image/gif" disabled={saving} onChange={(e) => {
                const archivo = e.currentTarget.files?.[0];
                e.currentTarget.value = "";
                if (archivo) void cargarFoto(archivo);
              }} />
              <p className="text-sm text-muted-foreground">{leyendo ? "Cargando vista previa…" : "JPG, PNG, WebP o GIF de hasta 2 MB."}</p>
            </Field>
            <Field id="producto-imagen-url" label="Enlace directo de la imagen" error={err("imagenUrl")}>
              <Input id="producto-imagen-url" type="url" value={foto.tipo === "enlace" || (foto.tipo === "actual" && foto.valor.startsWith("https:")) ? foto.valor : ""}
                onChange={(e) => cambiarFoto({ tipo: e.target.value ? "enlace" : "quitar", valor: e.target.value })} placeholder="https://…" />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button asChild type="button" variant="outline" className="min-h-11 text-base">
                <a href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(consultaImagen)}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={15} /> Buscar imagen en línea
                </a>
              </Button>
              {foto.valor && <Button type="button" variant="ghost" className="min-h-11 text-base" onClick={() => cambiarFoto({ tipo: "quitar", valor: "" })}>Quitar imagen</Button>}
            </div>
          </div>
        </TabsContent>
      </Tabs>
      {fieldErrors && Object.keys(fieldErrors).length > 0 && (
        <p role="alert" className="text-sm text-destructive">{Object.values(fieldErrors).find((mensajes) => mensajes.length)?.[0]}</p>
      )}
      <DialogFooter className="border-t pt-4 [&>button]:min-h-11 [&>button]:px-5 [&>button]:text-base">
        {onDelete && <Button type="button" variant="outline" disabled={saving} className="text-destructive sm:mr-auto" onClick={onDelete}>Eliminar producto</Button>}
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={saving || generando || leyendo}>{saving ? "Guardando…" : "Guardar producto"}</Button>
      </DialogFooter>
    </form>
  );
}
