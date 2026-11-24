import { Component, Suspense, useEffect, useState, type PropsWithChildren } from "react";
import { Outlet, useLocation, useMatch } from "react-router-dom";
import { Menu } from "lucide-react";
import { navItems } from "./nav-data";
import { useSidebar } from "@/context/SidebarContext";
import { useNegocio } from "@/context/NegocioContext";
import AppSidebarNav from "./AppSidebarNav";
import ThemeToggle from "./ThemeToggle";
import VersionFooter from "./VersionFooter";
import CommandPalette from "./CommandPalette";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

class ErrorDeSeccion extends Component<PropsWithChildren, { fallida: boolean }> {
  state = { fallida: false };

  static getDerivedStateFromError() {
    return { fallida: true };
  }

  render() {
    if (!this.state.fallida) return this.props.children;
    return (
      <div className="space-y-3 py-6">
        <p role="alert" className="text-sm text-destructive">No se pudo cargar esta sección.</p>
        <Button variant="outline" onClick={() => window.location.reload()}>Recargar aplicación</Button>
      </div>
    );
  }
}

export default function AppLayout() {
  const { pathname } = useLocation();
  const isDashboard = useMatch("/dashboard") !== null;
  const isCaja = useMatch("/caja") !== null;
  const isProductos = useMatch("/productos") !== null;
  const { negocio } = useNegocio();
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebar();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pageTitle = navItems.find((item) => item.to === pathname)?.label ?? "Tu espacio de trabajo";

  useEffect(() => {
    document.title = `${pageTitle} | ${negocio.nombre}`;
    return () => { document.title = "Caja e Inventario"; };
  }, [pageTitle, negocio.nombre]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!e.repeat) setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="min-h-dvh bg-background font-body md:flex">
      <a href="#contenido-principal" className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Ir al contenido
      </a>

      <aside className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 motion-reduce:transition-none md:flex",
        collapsed ? "w-[4.5rem]" : "w-[15rem]",
      )}>
        <AppSidebarNav collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 max-w-[calc(100%-2rem)] border-sidebar-border bg-sidebar p-0 text-sidebar-foreground [&>button]:text-sidebar-foreground">
          <SheetTitle className="sr-only">Navegación</SheetTitle>
          <SheetDescription className="sr-only">Elige una sección del sistema.</SheetDescription>
          <AppSidebarNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="group/workspace relative flex min-h-dvh min-w-0 flex-1 flex-col has-[.caja-vista-fija]:h-dvh has-[.caja-vista-fija]:overflow-hidden">
        <header className="sticky top-0 z-30 flex h-11 shrink-0 items-center justify-end border-b border-border bg-card/95 px-3 backdrop-blur group-has-[.cash-opening]/workspace:pointer-events-none group-has-[.cash-opening]/workspace:absolute group-has-[.cash-opening]/workspace:inset-x-0 group-has-[.cash-opening]/workspace:border-0 group-has-[.cash-opening]/workspace:bg-transparent group-has-[.cash-opening]/workspace:backdrop-blur-none sm:px-4">
          <div className="pointer-events-auto rounded-lg group-has-[.cash-opening]/workspace:bg-card/90 group-has-[.cash-opening]/workspace:shadow-sm">
            <ThemeToggle />
          </div>
        </header>

        <main id="contenido-principal" tabIndex={-1} className={cn(
          "w-full flex-1 outline-none",
          isCaja ? "flex min-h-0 flex-col"
            : isProductos ? "flex min-w-0 flex-col px-2 py-3 sm:px-4 lg:py-4"
            : "mx-auto max-w-[95rem] px-4 py-6 sm:px-6 lg:px-8 lg:py-8",
        )}>
          {!isDashboard && !isCaja && (
            <h1 className="mb-5 font-display text-3xl leading-tight font-bold tracking-[-0.04em] text-foreground sm:text-4xl">{pageTitle}</h1>
          )}
          <div className={isCaja || isProductos ? "flex min-h-0 min-w-0 flex-1 flex-col" : isDashboard ? undefined : "min-w-0 rounded-xl border border-border bg-card p-4 sm:p-6"}>
            <ErrorDeSeccion key={pathname}>
              <Suspense fallback={<p role="status" className="py-6 text-sm text-muted-foreground">Cargando sección…</p>}>
                <Outlet />
              </Suspense>
            </ErrorDeSeccion>
          </div>
        </main>
        <div className="sticky bottom-0 z-20 flex shrink-0 items-center justify-between border-t bg-background px-3 group-has-[.cash-opening]/workspace:pointer-events-none group-has-[.cash-opening]/workspace:absolute group-has-[.cash-opening]/workspace:inset-x-0 group-has-[.cash-opening]/workspace:border-0 group-has-[.cash-opening]/workspace:bg-transparent group-has-[.cash-opening]/workspace:pb-2 md:static md:justify-end md:px-4">
          <Button variant="ghost" size="sm" className="pointer-events-auto group-has-[.cash-opening]/workspace:bg-card/90 md:hidden" onClick={() => setMobileOpen(true)} aria-haspopup="dialog" aria-expanded={mobileOpen}>
            <Menu size={16} /> Menú
          </Button>
          <VersionFooter className="py-2 text-muted-foreground group-has-[.cash-opening]/workspace:rounded-full group-has-[.cash-opening]/workspace:bg-black/60 group-has-[.cash-opening]/workspace:px-3 group-has-[.cash-opening]/workspace:py-1 group-has-[.cash-opening]/workspace:text-white" />
        </div>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
