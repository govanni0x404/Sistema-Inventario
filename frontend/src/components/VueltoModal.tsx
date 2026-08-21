import { useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

export default function VueltoModal({ vuelto, onClose }: { vuelto: number | null; onClose: () => void }) {
  useEffect(() => {
    if (vuelto === null) return;
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [vuelto, onClose]);

  return (
    <Dialog open={vuelto !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-center">Vuelto</DialogTitle>
        </DialogHeader>
        <div className="py-6 text-center">
          <div className="font-mono text-5xl font-bold text-primary">{money(vuelto ?? 0)}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
