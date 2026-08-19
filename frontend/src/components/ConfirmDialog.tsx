import Modal from "./Modal";

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Eliminar",
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="font-body text-sm text-ink-soft mb-5">{message}</p>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 font-body text-sm font-medium py-2.5 rounded-lg border border-border text-ink-soft"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 font-body text-sm font-medium py-2.5 rounded-lg text-white bg-warn"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
