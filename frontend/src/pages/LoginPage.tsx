import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { LogIn } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";

export default function LoginPage() {
  const { usuario, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (usuario) {
    const from = (location.state as { from?: string })?.from || "/caja";
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full font-body text-sm px-3 py-2.5 rounded-lg outline-none border border-border text-ink bg-white focus:border-accent transition-colors";

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-2xl p-8 bg-surface border border-border">
        <div className="flex items-center gap-3 mb-1">
          <span className="flex items-center justify-center w-10 h-10 rounded-full bg-accent-soft text-accent-dark shrink-0">
            <LogIn size={18} />
          </span>
          <div>
            <h1 className="font-display text-lg font-bold text-ink leading-tight">Caja &amp; Inventario</h1>
            <p className="font-body text-xs text-ink-soft">Inicia sesión para continuar</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6">
          <label className="block mb-3">
            <span className="block font-body text-xs font-medium mb-1 text-ink-soft">Correo</span>
            <input
              type="email"
              className={inputCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
          </label>
          <label className="block mb-4">
            <span className="block font-body text-xs font-medium mb-1 text-ink-soft">Contraseña</span>
            <input
              type="password"
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {error && <div className="font-body text-xs text-warn mb-4">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full font-body text-sm font-medium py-2.5 rounded-lg text-white bg-accent disabled:opacity-60"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
