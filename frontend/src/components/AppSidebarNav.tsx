import { useState } from "react";
import { matchPath, NavLink, useLocation } from "react-router-dom";
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { navGroups, navItems, tieneAcceso } from "./nav-data";
import { useAuth } from "@/context/AuthContext";
import { useNegocio } from "@/context/NegocioContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { SYSTEM_NAME } from "@/lib/branding";
import UserMenu from "./UserMenu";
import ThemeToggle from "./ThemeToggle";

const directPaths: readonly string[] = ["/dashboard", "/caja"];
const shortcutPaths: readonly string[] = [...directPaths, "/precios", "/productos"];
const alphabeticalOrder = new Intl.Collator("es-CL");
const compareLabels = (a: { label: string }, b: { label: string }) => alphabeticalOrder.compare(a.label, b.label);

export default function AppSidebarNav({
  collapsed = false,
  onToggleCollapsed,
  onNavigate,
}: {
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
}) {
  const { usuario } = useAuth();
  const { negocio } = useNegocio();
  const { pathname } = useLocation();
  const [expanded, setExpanded] = useState<Record<string, { open: boolean; pathname: string }>>({});
  const [popup, setPopup] = useState<string | null>(null);
  const shortcuts = navItems
    .filter((item) => shortcutPaths.includes(item.to) && tieneAcceso(usuario, item))
    .sort((a, b) => shortcutPaths.indexOf(a.to) - shortcutPaths.indexOf(b.to));
  const groups = navGroups
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => !directPaths.includes(item.to) && tieneAcceso(usuario, item))
        .sort(compareLabels),
    }))
    .filter(({ items }) => items.length > 0);
  const groupButton = "flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold hover:bg-sidebar-accent/70 focus-visible:outline-2 focus-visible:outline-sidebar-primary";

  const navigate = () => {
    setPopup(null);
    onNavigate?.();
  };

  const renderLink = (
    { to, label, icon: Icon }: Pick<(typeof navItems)[number], "to" | "label" | "icon">,
    shortcut = false,
  ) => (
    <li key={to}>
      <NavLink
        to={to}
        end
        onClick={navigate}
        aria-label={shortcut && collapsed ? label : undefined}
        title={shortcut && collapsed ? label : undefined}
        className={({ isActive }) => cn(
          "flex items-center gap-2.5 rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-sidebar-primary",
          shortcut ? "min-h-10 px-3 text-sm font-semibold" : "min-h-9 px-2.5 text-[13px] font-medium",
          shortcut && collapsed && "justify-center px-0",
          isActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
            : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        )}
      >
        <Icon size={shortcut ? 18 : 16} className="shrink-0" aria-hidden="true" />
        {!(shortcut && collapsed) && <span>{label}</span>}
      </NavLink>
    </li>
  );

  return (
    <div className="sidebar-photo flex h-full min-h-0 flex-col">
      <div className={cn("flex min-h-24 shrink-0 items-center gap-3 border-b border-white/15 px-5", collapsed && "flex-col justify-center gap-1.5 px-2")}>
        <img src="/favicon.svg" alt="" width={36} height={36} className="size-9 shrink-0" />
        <div className={cn("min-w-0 flex-1", collapsed && "sr-only")}>
          <div className="truncate font-display text-base font-bold leading-tight">{SYSTEM_NAME}</div>
          <div className="mt-1 truncate text-xs text-sidebar-muted" title={negocio.nombre}>{negocio.nombre}</div>
        </div>
        {onToggleCollapsed && (
          <button type="button" onClick={onToggleCollapsed} aria-label={collapsed ? "Expandir menú" : "Contraer menú"} aria-expanded={!collapsed}
            className="grid size-8 shrink-0 place-items-center rounded-md text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-sidebar-primary">
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        )}
      </div>

      <nav aria-label="Menú principal" className="flex-1 space-y-1.5 overflow-y-auto overscroll-contain px-3 py-4 [scrollbar-color:var(--sidebar-border)_transparent] [scrollbar-width:thin]">
        {shortcuts.length > 0 && (
          <ul aria-label="Accesos directos" className="mb-3 space-y-1 border-b border-white/15 pb-3">
            {shortcuts.map((item) => renderLink(item, true))}
          </ul>
        )}
        {groups.map(({ label, icon: GroupIcon, items }) => {
          const active = items.some(({ to }) => matchPath(to, pathname));
          const preference = expanded[label];
          const open = active && preference?.pathname !== pathname ? true : (preference?.open ?? active);
          const buttonClass = cn(groupButton, active ? "bg-sidebar-accent/70 text-sidebar-primary" : "text-sidebar-foreground");
          const links = (
            <ul aria-label={label} className="space-y-0.5">
              {items.map((item) => renderLink(item))}
            </ul>
          );

          if (collapsed) {
            return (
              <Popover key={label} open={popup === label} onOpenChange={(open) => setPopup(open ? label : null)}>
                <PopoverTrigger type="button" aria-label={label} title={label} className={cn(buttonClass, "justify-center px-0")}>
                  <GroupIcon size={18} aria-hidden="true" />
                </PopoverTrigger>
                <PopoverContent side="right" align="start" sideOffset={14} aria-label={label} className="max-h-(--radix-popover-content-available-height) w-56 overflow-y-auto border-sidebar-border bg-sidebar p-2 text-sidebar-foreground">
                  <p className="px-2.5 py-2 text-xs font-semibold text-sidebar-primary">{label}</p>
                  {links}
                </PopoverContent>
              </Popover>
            );
          }

          return (
            <Collapsible key={label} open={open} onOpenChange={(open) => setExpanded((current) => ({ ...current, [label]: { open, pathname } }))}>
              <CollapsibleTrigger type="button" className={cn("group", buttonClass)}>
                <GroupIcon size={17} className="shrink-0" aria-hidden="true" />
                <span className="flex-1">{label}</span>
                <ChevronDown size={15} className="shrink-0 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1 mb-2 ml-5 border-l border-white/15 pl-2">
                {links}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </nav>

      <div className={cn("flex shrink-0 items-center gap-1 border-t border-white/15 p-2", collapsed && "flex-col")}>
        <div className="min-w-0 flex-1">
          <UserMenu collapsed={collapsed} />
        </div>
        <ThemeToggle />
      </div>
    </div>
  );
}
