import { Component, Suspense, useEffect, useState, type PropsWithChildren } from "react";
import { Outlet, useLocation, useMatch } from "react-router-dom";
import { Menu } from "lucide-react";
import { navItems } from "./nav-data";
import { useSidebar } from "@/context/SidebarContext";
import { SYSTEM_NAME } from "@/lib/branding";
import AppSidebarNav from "./AppSidebarNav";
import VersionFooter from "./VersionFooter";
import CommandPalette from "./CommandPalette";
import PageHeader from "./PageHeader";
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
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebar();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const navItem = navItems.find((item) => item.to === pathname);
  const pageTitle = navItem?.label ?? "Tu espacio de trabajo";

  useEffect(() => {
    document.title = `${pageTitle} | ${SYSTEM_NAME}`;
    return () => { document.title = SYSTEM_NAME; };
  }, [pageTitle]);

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

      <div className="app-workspace group/workspace relative flex min-h-dvh min-w-0 flex-1 flex-col has-[.caja-vista-fija]:h-dvh has-[.caja-vista-fija]:overflow-hidden">
        <main id="contenido-principal" tabIndex={-1} className={cn(
          "w-full min-w-0 flex-1 outline-none",
          isCaja ? "flex min-h-0 flex-col" : "flex flex-col p-3 sm:p-5 lg:px-6",
        )}>
          {!isDashboard && !isCaja && (
            <PageHeader
              className="mb-4 px-1 sm:mb-5"
              title={pageTitle}
              eyebrow={navItem?.group}
              description={navItem?.description}
              icon={navItem?.icon}
            />
          )}
          <div className={cn("min-w-0 flex-1", (isCaja || isProductos) && "flex min-h-0 flex-col", !isCaja && !isProductos && !isDashboard && "relative rounded-2xl border border-border/80 bg-card p-4 shadow-card before:pointer-events-none before:absolute before:inset-x-6 before:-top-px before:rounded-b-full before:h-[3px] before:bg-linear-to-r before:from-primary before:to-brand-2 sm:p-6")}>
            <ErrorDeSeccion key={pathname}>
              <Suspense fallback={<p role="status" className="py-6 text-sm text-muted-foreground">Cargando sección…</p>}>
                <Outlet />
              </Suspense>
            </ErrorDeSeccion>
          </div>
        </main>
        <div className="sticky bottom-0 z-20 flex shrink-0 items-center justify-between border-t bg-background/80 px-3 backdrop-blur-sm group-has-[.cash-opening]/workspace:pointer-events-none group-has-[.cash-opening]/workspace:absolute group-has-[.cash-opening]/workspace:inset-x-0 group-has-[.cash-opening]/workspace:border-0 group-has-[.cash-opening]/workspace:bg-transparent group-has-[.cash-opening]/workspace:pb-2 md:static md:justify-end md:px-4">
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
