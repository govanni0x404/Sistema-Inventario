import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ArrowRight, Boxes, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { authApi } from "@/api/auth";
import { ApiError } from "@/api/client";
import { setupApi } from "@/api/negocio";
import type { EstadoSetup } from "@/types/negocio";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import VersionFooter from "@/components/VersionFooter";

export default function LoginPage() {
  const { usuario, login, iniciarSesion } = useAuth();
  const location = useLocation();
  const [estado, setEstado] = useState<EstadoSetup | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [claveInstalacion, setClaveInstalacion] = useState("");
  const [visible, setVisible] = useState(false);
  const [recuperar, setRecuperar] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let activo = true;
    setupApi.estado().then((datos) => { if (activo) setEstado(datos); })
      .catch(() => { if (activo) setError("No se pudo conectar al sistema. Revisa la conexión y vuelve a intentar."); });
    return () => { activo = false; };
  }, []);
  if (usuario) return <Navigate to={(location.state as { from?: string })?.from || "/"} replace />;

  const inicial = estado?.necesitaConfiguracion;
  function cambiarModo() {
    setRecuperar(!recuperar);
    setEnviado(false);
    setError("");
    setPassword("");
    setVisible(false);
  }

  async function enviar(event: FormEvent) {
    event.preventDefault();
    setError("");
    setOcupado(true);
    try {
      if (recuperar) {
        await authApi.solicitarRecuperacion(email);
        setEnviado(true);
        return;
      }
      const actual = estado ?? await setupApi.estado();
      setEstado(actual);
      if (actual.necesitaConfiguracion) {
        if (!inicial) return; // Presentar el alta antes de crear la primera cuenta.
        const acceso = await setupApi.configurar({
          negocio: { nombre: actual.nombreNegocio },
          admin: { nombre: "Administrador", email, password },
          clave: actual.requiereClave ? claveInstalacion : undefined,
        });
        iniciarSesion(acceso.token, acceso.usuario);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo conectar al servidor.");
    } finally {
      setOcupado(false);
    }
  }

  const titulo = recuperar ? "Recuperar clave" : inicial ? "Crear cuenta" : "Iniciar sesión";
  return (
    <main className="access-page relative grid min-h-dvh place-items-center px-4 py-16 sm:px-8">
      <div className="absolute top-4 right-4 rounded-lg border bg-card shadow-sm"><ThemeToggle /></div>
      <section aria-labelledby="access-title" className="w-full max-w-md rounded-[1.75rem] border border-t-4 border-t-primary bg-card p-6 text-card-foreground shadow-2xl sm:p-9">
        <div className="mb-6 flex items-center gap-3 border-b pb-5">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground" aria-hidden="true">
            <Boxes size={23} />
          </span>
          <p className="font-display text-base font-bold [overflow-wrap:anywhere]">
            {estado?.nombreNegocio && estado.nombreNegocio !== "Mi Negocio" ? estado.nombreNegocio : "Caja e inventario"}
          </p>
        </div>
        <div>
          <h1 id="access-title" className="font-display text-3xl font-bold tracking-tight">{titulo}</h1>
          {recuperar ? <p className="mt-2 text-sm text-muted-foreground">Solicita al administrador que restablezca tu clave.</p>
            : inicial && <p className="mt-2 text-sm text-muted-foreground">Crea la primera cuenta de administrador.</p>}
          {enviado ? <p role="status" className="my-6 rounded-lg bg-muted p-4 text-sm">Si el correo pertenece a una cuenta activa, el administrador podrá revisar tu solicitud en Auditoría.</p> : (
            <form onSubmit={enviar} className="mt-7 space-y-5" aria-busy={ocupado}>
              <div className="space-y-2">
                <Label htmlFor="email">Correo</Label>
                <Input id="email" className="h-11" type="email" autoComplete="username" placeholder="nombre@ejemplo.cl" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              {!recuperar && (
                <div className="space-y-2">
                  <Label htmlFor="password">Clave</Label>
                  <div className="relative">
                    <Input id="password" className="h-11 pr-12" type={visible ? "text" : "password"} minLength={inicial ? 8 : undefined} autoComplete={inicial ? "new-password" : "current-password"} placeholder={inicial ? "Mínimo 8 caracteres" : undefined} value={password} onChange={(e) => setPassword(e.target.value)} required />
                    <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1" aria-label={visible ? "Ocultar clave" : "Mostrar clave"} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</Button>
                  </div>
                </div>
              )}
              {!recuperar && inicial && estado?.requiereClave && (
                <div className="space-y-2">
                  <Label htmlFor="clave-instalacion">Clave de instalación</Label>
                  <Input id="clave-instalacion" type="password" value={claveInstalacion} onChange={(e) => setClaveInstalacion(e.target.value)} required />
                </div>
              )}
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="h-12 w-full" disabled={ocupado || (!estado && !error)}>{ocupado ? "Un momento…" : recuperar ? "Enviar solicitud" : inicial ? "Crear cuenta e ingresar" : "Ingresar"}<ArrowRight size={16} /></Button>
            </form>
          )}
          <div className="mt-5 text-center"><button type="button" disabled={ocupado} onClick={cambiarModo} className="text-sm font-semibold text-primary underline-offset-4 hover:underline">{recuperar ? "Volver al acceso" : "¿Olvidaste tu clave?"}</button></div>
        </div>
      </section>
      <VersionFooter className="absolute inset-x-0 bottom-4 mx-auto w-fit rounded-full bg-black/55 px-3 py-1 text-white" />
    </main>
  );
}
