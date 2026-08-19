import { useEffect } from "react";
import { Check, AlertTriangle } from "lucide-react";

export default function Toast({
  text,
  variant = "success",
  onDone,
}: {
  text: string;
  variant?: "success" | "error";
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 font-body text-sm px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 text-white ${
        variant === "error" ? "bg-warn" : "bg-ink"
      }`}
    >
      {variant === "error" ? <AlertTriangle size={16} /> : <Check size={16} />} {text}
    </div>
  );
}
