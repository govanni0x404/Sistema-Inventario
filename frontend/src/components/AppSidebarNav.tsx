import { NavLink } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { navGroups, adminNavItem } from "./nav-data";
import { useAuth } from "@/context/AuthContext";
import { productosApi } from "@/api/productos";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import UserMenu from "./UserMenu";

export default function AppSidebarNav({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { usuario } = useAuth();
  const [lowStockCount, setLowStockCount] = useState(0);

  useEffect(() => {
    productosApi
      .listarConStockBajo()
      .then((p) => setLowStockCount(p.length))
      .catch(() => setLowStockCount(0));
  }, []);

  const groups = useMemo(
    () =>
      navGroups
        .map((g) => ({
          ...g,
          items: g.items.filter((item) => usuario?.rol === "admin" || usuario?.permisos?.[item.seccion] !== false),
        }))
        .filter((g) => g.items.length > 0),
    [usuario]
  );

  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex items-center gap-2.5 px-3 py-4", collapsed && "justify-center px-2")}>
        <span className="flex items-center justify-center size-8 rounded-lg bg-primary text-primary-foreground font-display font-bold text-sm shrink-0">
          CI
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-display text-sm font-bold text-sidebar-foreground leading-tight truncate">
              Caja &amp; Inventario
            </div>
            <div className="font-body text-[11px] text-muted-foreground truncate">Sistema de inventario</div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-4">
        {groups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <div className="px-2.5 mb-1 font-body text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const link = (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 font-body text-sm font-medium transition-colors",
                        collapsed && "justify-center px-0",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                      )
                    }
                  >
                    <Icon size={17} className="shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                );

                if (!collapsed) return link;
                return (
                  <Tooltip key={item.to}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        ))}

        {usuario?.rol === "admin" && (
          <div>
            {!collapsed && (
              <div className="px-2.5 mb-1 font-body text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Administración
              </div>
            )}
            <div className="space-y-0.5">
              {(() => {
                const Icon = adminNavItem.icon;
                const link = (
                  <NavLink
                    to={adminNavItem.to}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 font-body text-sm font-medium transition-colors",
                        collapsed && "justify-center px-0",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                      )
                    }
                  >
                    <Icon size={17} className="shrink-0" />
                    {!collapsed && <span className="truncate">{adminNavItem.label}</span>}
                  </NavLink>
                );
                if (!collapsed) return link;
                return (
                  <Tooltip>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{adminNavItem.label}</TooltipContent>
                  </Tooltip>
                );
              })()}
            </div>
          </div>
        )}
      </nav>

      <div className="px-2 py-2 border-t border-sidebar-border space-y-2">
        {lowStockCount > 0 &&
          (collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center py-1.5 rounded-lg bg-destructive/10 text-destructive">
                  <AlertTriangle size={15} />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">{lowStockCount} producto(s) con stock bajo</TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-1.5 font-body text-xs px-2.5 py-2 rounded-lg bg-destructive/10 text-destructive">
              <AlertTriangle size={13} className="shrink-0" /> {lowStockCount} producto{lowStockCount > 1 ? "s" : ""} con
              stock bajo
            </div>
          ))}
        <UserMenu collapsed={collapsed} />
      </div>
    </div>
  );
}
