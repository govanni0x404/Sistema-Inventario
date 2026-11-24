import { useEffect, useRef, useState } from "react";
import { Package } from "lucide-react";
import { api } from "@/api/client";
import { cn } from "@/lib/utils";

export default function ImagenProducto({ url, className, alt = "" }: {
  url?: string | null;
  className?: string;
  alt?: string;
}) {
  const rutaLocal = url?.startsWith("/api/productos/") ? url : null;
  const [descarga, setDescarga] = useState<{ ruta: string; origen: string }>();
  const [fallo, setFallo] = useState<string>();
  const marco = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!rutaLocal) return;
    const controller = new AbortController();
    let temporal: string | undefined;
    const cargar = () => {
      api.getBlob(rutaLocal.slice(4), controller.signal).then((blob) => {
        if (controller.signal.aborted) return;
        temporal = URL.createObjectURL(blob);
        setDescarga({ ruta: rutaLocal, origen: temporal });
      }).catch(() => {
        if (!controller.signal.aborted) setFallo(rutaLocal);
      });
    };
    const observador = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries, observer) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      cargar();
    }, { rootMargin: "160px" });
    if (observador && marco.current) observador.observe(marco.current);
    else cargar();
    return () => {
      observador?.disconnect();
      controller.abort();
      if (temporal) URL.revokeObjectURL(temporal);
    };
  }, [rutaLocal]);

  const origen = rutaLocal ? (descarga?.ruta === rutaLocal ? descarga.origen : null) : url;
  return (
    <span ref={marco} className={cn("grid place-items-center overflow-hidden rounded-lg bg-muted text-muted-foreground", className)}>
      {origen && fallo !== url ? (
        <img src={origen} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer"
          onError={() => setFallo(url ?? undefined)} className="size-full min-h-0 object-contain" />
      ) : <Package size={30} strokeWidth={1.5} aria-hidden="true" />}
    </span>
  );
}
