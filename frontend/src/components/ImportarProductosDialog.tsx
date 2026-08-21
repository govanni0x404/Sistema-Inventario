import { useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle2, XCircle } from "lucide-react";
import { productosApi } from "../api/productos";
import { ApiError } from "../api/client";
import type { ImportarResultado } from "../types/producto";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const CAMPOS_ESPERADOS = ["sku", "codigoBarras", "nombre", "categoria", "precioCompra", "precioVenta", "stock", "stockMinimo", "unidad", "proveedor"];

const ALIAS: Record<string, string> = {
  sku: "sku",
  codigodebarras: "codigoBarras",
  codigobarras: "codigoBarras",
  barcode: "codigoBarras",
  nombre: "nombre",
  categoria: "categoria",
  preciocompra: "precioCompra",
  precioventa: "precioVenta",
  stock: "stock",
  stockminimo: "stockMinimo",
  stockmin: "stockMinimo",
  unidad: "unidad",
  proveedor: "proveedor",
};

function normalizarClave(k: string) {
  const t = k.trim().toLowerCase().replace(/[\s_-]+/g, "");
  return ALIAS[t] ?? k.trim();
}

export default function ImportarProductosDialog({ onClose, onImportado }: { onClose: () => void; onImportado: () => void }) {
  const [filas, setFilas] = useState<Record<string, unknown>[] | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ImportarResultado | null>(null);
  const [importando, setImportando] = useState(false);

  const handleFile = (file: File) => {
    setParseError(null);
    setResultado(null);
    setNombreArchivo(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        if (res.errors.length > 0) {
          setParseError(res.errors[0].message);
          setFilas(null);
          return;
        }
        const normalizadas = res.data.map((row) =>
          Object.fromEntries(Object.entries(row).map(([k, v]) => [normalizarClave(k), v]))
        );
        if (normalizadas.length === 0) {
          setParseError("El archivo no tiene filas de datos.");
          setFilas(null);
          return;
        }
        setFilas(normalizadas);
      },
      error: (err) => {
        setParseError(err.message);
        setFilas(null);
      },
    });
  };

  const importar = async () => {
    if (!filas) return;
    setImportando(true);
    try {
      const res = await productosApi.importar(filas);
      setResultado(res);
      if (res.resumen.creados + res.resumen.actualizados > 0) {
        toast.success(`${res.resumen.creados + res.resumen.actualizados} producto(s) importado(s)`);
        onImportado();
      }
      if (res.resumen.errores > 0) {
        toast.error(`${res.resumen.errores} fila(s) con errores`);
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo importar el archivo");
    } finally {
      setImportando(false);
    }
  };

  const reiniciar = () => {
    setFilas(null);
    setNombreArchivo("");
    setParseError(null);
    setResultado(null);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar productos</DialogTitle>
          <DialogDescription>
            Sube un archivo CSV. Si un SKU ya existe se actualiza (sin tocar el stock); si no, se crea. Columnas
            reconocidas: {CAMPOS_ESPERADOS.join(", ")}. Solo <strong>sku</strong>, <strong>nombre</strong> y{" "}
            <strong>precioVenta</strong> son obligatorias.
          </DialogDescription>
        </DialogHeader>

        {!filas && !resultado && (
          <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-10 cursor-pointer hover:border-primary/40 transition-colors">
            <Upload size={24} className="text-muted-foreground" />
            <span className="font-body text-sm text-foreground">Haz clic para elegir un archivo .csv</span>
            <span className="font-body text-xs text-muted-foreground">
              ¿Tienes un Excel? Guárdalo primero como CSV (Archivo → Guardar como → CSV).
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
        )}

        {parseError && (
          <div className="font-body text-sm text-destructive p-3 rounded-lg bg-destructive/10">{parseError}</div>
        )}

        {filas && !resultado && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-body text-sm text-foreground">
              <FileText size={15} className="text-muted-foreground" />
              {nombreArchivo} · {filas.length} fila(s) detectada(s)
            </div>
            <div className="rounded-xl border border-border overflow-hidden max-h-72 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="text-right">Precio venta</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.slice(0, 50).map((f, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{String(f.sku ?? "—")}</TableCell>
                      <TableCell className="font-body text-sm">{String(f.nombre ?? "—")}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{String(f.precioVenta ?? "—")}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{String(f.stock ?? "0")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {filas.length > 50 && (
              <p className="font-body text-xs text-muted-foreground">Mostrando las primeras 50 de {filas.length} filas.</p>
            )}
          </div>
        )}

        {resultado && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-4 p-4 rounded-xl bg-muted font-body text-sm">
              <span>
                Total: <strong className="text-foreground">{resultado.resumen.total}</strong>
              </span>
              <span className="text-emerald-600">Creados: {resultado.resumen.creados}</span>
              <span className="text-primary">Actualizados: {resultado.resumen.actualizados}</span>
              <span className="text-destructive">Errores: {resultado.resumen.errores}</span>
            </div>
            {resultado.resultados.some((r) => !r.ok || r.nota) && (
              <div className="rounded-xl border border-border divide-y divide-border overflow-hidden max-h-64 overflow-y-auto">
                {resultado.resultados
                  .filter((r) => !r.ok || r.nota)
                  .map((r) => (
                    <div key={r.fila} className="flex items-start gap-2 px-4 py-2.5 font-body text-xs">
                      {r.ok ? (
                        <CheckCircle2 size={14} className="text-amber-500 mt-0.5 shrink-0" />
                      ) : (
                        <XCircle size={14} className="text-destructive mt-0.5 shrink-0" />
                      )}
                      <span>
                        Fila {r.fila} ({r.sku ?? "sin SKU"}): {r.error || r.nota}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {!resultado && (
            <Button variant="outline" onClick={filas ? reiniciar : onClose}>
              {filas ? "Elegir otro archivo" : "Cancelar"}
            </Button>
          )}
          {filas && !resultado && (
            <Button onClick={importar} disabled={importando}>
              {importando ? "Importando..." : `Importar ${filas.length} fila(s)`}
            </Button>
          )}
          {resultado && <Button onClick={onClose}>Cerrar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
