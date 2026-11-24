import { version } from "../../package.json";
import { cn } from "@/lib/utils";

export default function VersionFooter({ className }: { className?: string }) {
  return <footer className={cn("text-center text-xs tabular-nums", className)}>Versión {version}</footer>;
}
