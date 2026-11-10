import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { Store } from "lucide-react";
import { setupApi } from "../api/negocio";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { formatearRut, rutValido } from "../lib/rut";
import type { EstadoSetup } from "../types/negocio";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Primer arranque de una instalación nueva: datos del negocio + cuenta del administrador.
// Solo funciona mientras no exista ningún usuario (el backend lo garantiza).
export default function SetupPage() {
  const { usuario, iniciarSesion } = useAuth();
  const [estado, setEstado] = useState<EstadoSetup | null>(null);
  const [negocio, setNegocio] = useState({ nombre: "", rut: "", direccion: "", telefono: "" });
  const [admin, setAdmin] = useState({ nombre: "", email: "", password: "", repetir: "" });
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setupApi
      .estado()
      .then(setEstado)
      .catch(() => setError("No se pudo conectar con el servidor"));
  }, []);

  if (usuario) return <Navigate to="/dashboard" replace />;
  if (estado && !estado.necesitaConfiguracion) return <Navigate to="/login" replace />;

  const rutInvalido = negocio.rut.trim() !== "" && !rutValido(negocio.rut);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (rutInvalido) return setError("El RUT no es válido: revisa el dígito verificador");
    if (admin.password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres");
    if (admin.password !== admin.repetir) return setError("Las contraseñas no coinciden");

    setEnviando(true);
    try {
      const { token, usuario: u } = await setupApi.configurar({
        clave: estado?.requiereClave ? clave : undefined,
        negocio,
        admin: { nombre: admin.nombre, email: admin.email, password: admin.password },
      });
      iniciarSesion(token, u);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo completar la configuración");
    } finally {
      setEnviando(false);
    }
  };

  const campo = (
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    extra: { type?: string; required?: boolean; placeholder?: string; onBlur?: () => void } = {}
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={extra.type ?? "text"}
        required={extra.required}
        placeholder={extra.placeholder}
        onBlur={extra.onBlur}
      />
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary shrink-0">
              <Store size={18} />
            </span>
            <div>
              <h1 className="font-display text-lg font-bold text-foreground leading-tight">Bienvenido</h1>
              <p className="font-body text-xs text-muted-foreground">Configura tu negocio para empezar a vender</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!estado && !error && <p className="font-body text-sm text-muted-foreground">Cargando…</p>}
          {estado && (
            <form onSubmit={enviar} className="space-y-5">
              <div className="space-y-3">
                <div className="font-body text-xs font-medium uppercase tracking-wide text-muted-foreground">Tu negocio</div>
                {campo("s-nombre", "Nombre del negocio", negocio.nombre, (v) => setNegocio((n) => ({ ...n, nombre: v })), {
                  required: true,
                  placeholder: "Ej. Minimarket La Esquina",
                })}
                {campo("s-rut", "RUT (opcional)", negocio.rut, (v) => setNegocio((n) => ({ ...n, rut: v })), {
                  placeholder: "12.345.678-5",
                  onBlur: () => setNegocio((n) => ({ ...n, rut: formatearRut(n.rut.trim()) })),
                })}
                {rutInvalido && <p className="font-body text-xs text-destructive">RUT inválido</p>}
                {campo("s-dir", "Dirección (opcional)", negocio.direccion, (v) => setNegocio((n) => ({ ...n, direccion: v })))}
                {campo("s-tel", "Teléfono (opcional)", negocio.telefono, (v) => setNegocio((n) => ({ ...n, telefono: v })))}
              </div>

              <div className="space-y-3">
                <div className="font-body text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Tu cuenta de administrador
                </div>
                {campo("s-anombre", "Tu nombre", admin.nombre, (v) => setAdmin((a) => ({ ...a, nombre: v })), { required: true })}
                {campo("s-email", "Correo", admin.email, (v) => setAdmin((a) => ({ ...a, email: v })), { type: "email", required: true })}
                {campo("s-pw", "Contraseña (mínimo 8 caracteres)", admin.password, (v) => setAdmin((a) => ({ ...a, password: v })), {
                  type: "password",
                  required: true,
                })}
                {campo("s-pw2", "Repite la contraseña", admin.repetir, (v) => setAdmin((a) => ({ ...a, repetir: v })), {
                  type: "password",
                  required: true,
                })}
              </div>

              {estado.requiereClave &&
                campo("s-clave", "Clave de instalación", clave, setClave, {
                  type: "password",
                  required: true,
                  placeholder: "La entrega quien instaló el sistema",
                })}

              {error && <p className="font-body text-xs text-destructive">{error}</p>}

              <Button type="submit" disabled={enviando} className="w-full">
                {enviando ? "Configurando..." : "Comenzar"}
              </Button>
            </form>
          )}
          {!estado && error && <p className="font-body text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
