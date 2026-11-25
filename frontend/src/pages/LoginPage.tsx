import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { authApi } from "@/api/auth";
import { ApiError } from "@/api/client";
import { SYSTEM_NAME } from "@/lib/branding";
import { setupApi } from "@/api/negocio";
import type { EstadoSetup } from "@/types/negocio";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import VersionFooter from "@/components/VersionFooter";

export default function LoginPage() {
  const { usuario, login, iniciarSesion } = useAuth();
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
  if (usuario) return <Navigate to="/dashboard" replace />;

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
      <div className="absolute top-4 right-4 rounded-xl border bg-card shadow-sm"><ThemeToggle /></div>
      <section aria-labelledby="access-title" className="grid w-full max-w-lg overflow-hidden rounded-[1.75rem] border border-white/25 bg-card text-card-foreground shadow-[0_24px_80px_#10222f66] md:max-w-4xl md:grid-cols-[0.95fr_1fr]">
        <div className="access-brand flex flex-col justify-end px-6 py-7 text-hero-foreground sm:px-9 md:min-h-[31rem] md:p-10">
          <img src="/favicon.svg" alt="" width={48} height={48} className="mb-3 size-10 md:mb-5 md:size-12" />
          <p className="font-display text-4xl font-bold leading-none tracking-tight md:text-6xl">{SYSTEM_NAME}</p>
          <p className="mt-2 text-sm text-hero-muted md:mt-4 md:text-base">Punto de venta e inventario</p>
        </div>
        <div className="self-center px-6 py-7 sm:p-9 md:p-10">
          <h1 id="access-title" className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{titulo}</h1>
          {recuperar ? <p className="mt-2 text-sm text-muted-foreground">Solicita al administrador que restablezca tu clave.</p>
            : inicial && <p className="mt-2 text-sm text-muted-foreground">Crea la primera cuenta de administrador.</p>}
          {enviado ? <p role="status" className="my-6 rounded-lg bg-muted p-4 text-sm">Si el correo pertenece a una cuenta activa, el administrador podrá revisar tu solicitud en Auditoría.</p> : (
            <form onSubmit={enviar} className="mt-7 space-y-5" aria-busy={ocupado}>
              <div className="space-y-2">
                <Label htmlFor="email">Correo</Label>
                <Input id="email" className="h-12 bg-background" type="email" autoComplete="username" placeholder="nombre@ejemplo.cl" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              {!recuperar && (
                <div className="space-y-2">
                  <Label htmlFor="password">Clave</Label>
                  <div className="relative">
                    <Input id="password" className="h-12 bg-background pr-12" type={visible ? "text" : "password"} minLength={inicial ? 8 : undefined} autoComplete={inicial ? "new-password" : "current-password"} placeholder={inicial ? "Mínimo 8 caracteres" : undefined} value={password} onChange={(e) => setPassword(e.target.value)} required />
                    <Button type="button" variant="ghost" size="icon" className="absolute top-1/2 right-1 -translate-y-1/2" aria-label={visible ? "Ocultar clave" : "Mostrar clave"} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</Button>
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
