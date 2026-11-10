import { useEffect, useState } from "react";
import { toast } from "sonner";
import { auditoriaApi } from "../api/auditoria";
import type { RegistroAuditoria } from "../types/auditoria";
import type { RangoPreset } from "../components/RangoFechasSelector";
import RangoFechasSelector from "../components/RangoFechasSelector";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { LOCALE } from "../lib/format";

const ETIQUETAS: Record<string, string> = {
  login_exitoso: "Inicio de sesión",
  login_fallido: "Inicio de sesión fallido",
  usuario_rol_cambiado: "Cambio de rol",
  usuario_activo_cambiado: "Cambio de estado",
  password_reseteada: "Contraseña reseteada",
  permiso_actualizado: "Permiso actualizado",
  rol_renombrado: "Rol renombrado",
  lista_precio_eliminada: "Lista de precios eliminada",
};

function etiqueta(accion: string) {
  return ETIQUETAS[accion] || accion;
}

function esFallido(accion: string) {
  return accion === "login_fallido";
}

function hoyStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AuditoriaPage() {
  const [rango, setRango] = useState<RangoPreset>("30");
  const [desdeCustom, setDesdeCustom] = useState(hoyStr());
  const [hastaCustom, setHastaCustom] = useState(hoyStr());
  const [registros, setRegistros] = useState<RegistroAuditoria[] | null>(null);

  useEffect(() => {
    setRegistros(null);
    const params = rango === "custom" ? { desde: desdeCustom, hasta: hastaCustom } : { dias: Number(rango) };
    auditoriaApi
      .listar(params)
      .then(setRegistros)
      .catch(() => toast.error("No se pudo cargar el registro de auditoría"));
  }, [rango, desdeCustom, hastaCustom]);

  return (
    <div className="space-y-4">
      <RangoFechasSelector rango={rango} setRango={setRango} desdeCustom={desdeCustom} setDesdeCustom={setDesdeCustom} hastaCustom={hastaCustom} setHastaCustom={setHastaCustom} />

      {registros === null && (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )}
      {registros && registros.length === 0 && (
        <div className="font-body text-sm text-center py-10 text-muted-foreground">Sin eventos en este periodo.</div>
      )}
      {registros && registros.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Afectado</TableHead>
                <TableHead>Antes → Después</TableHead>
                <TableHead>Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registros.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(r.fecha).toLocaleString(LOCALE, { dateStyle: "medium", timeStyle: "short" })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={esFallido(r.accion) ? "destructive" : "secondary"}>{etiqueta(r.accion)}</Badge>
                  </TableCell>
                  <TableCell className="font-body text-sm text-foreground">{r.usuario?.nombre ?? "—"}</TableCell>
                  <TableCell className="font-body text-sm text-foreground">{r.usuarioAfectado?.nombre ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {r.valorAnterior || r.valorNuevo ? `${r.valorAnterior ?? "—"} → ${r.valorNuevo ?? "—"}` : "—"}
                  </TableCell>
                  <TableCell className="font-body text-xs text-muted-foreground">{r.detalle ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
