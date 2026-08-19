import { useMemo } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { navGroups, adminNavItem } from "./nav-data";
import { useSidebar } from "@/context/SidebarContext";
import AppSidebarNav from "./AppSidebarNav";
import ThemeToggle from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

const allItems = [...navGroups.flatMap((g) => g.items), adminNavItem];

export default function AppLayout() {
  const location = useLocation();
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebar();
  const noCardWrapper = location.pathname === "/caja" || location.pathname === "/dashboard";
  const activo = allItems.find((t) => t.to === location.pathname);

  const pageTitle = useMemo(() => activo?.label ?? "", [activo]);

  return (
    <div className="min-h-screen bg-background font-body flex">
      <aside
        className={cn(
          "hidden md:flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <AppSidebarNav collapsed={collapsed} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-72 bg-sidebar">
          <SheetTitle className="sr-only">Navegación</SheetTitle>
          <SheetDescription className="sr-only">Menú principal</SheetDescription>
          <AppSidebarNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/95 backdrop-blur px-4 sm:px-6 h-14 shrink-0">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menú">
            <Menu size={18} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </Button>

          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage className="font-display text-sm font-semibold">{pageTitle}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 min-w-0">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
            <div className={noCardWrapper ? "" : "rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm"}>
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
