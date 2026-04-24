import { useNavigate } from "react-router-dom";

type UpgradeModalProps = {
  open: boolean;
  onClose: () => void;
};

export function UpgradeModal({ open, onClose }: UpgradeModalProps) {
  const navigate = useNavigate();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="presentation"
      onClick={() => onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
        className="w-full max-w-md rounded-xl border border-emerald-900/50 bg-zinc-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="upgrade-modal-title"
          className="text-lg font-semibold tracking-tight text-zinc-50"
        >
          Unlock more with Pro
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          Upgrade to Pro for more flashcard generations, more uploads, and more
          saved decks.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => onClose()}
            className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-xl border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate("/pricing");
            }}
            className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Upgrade Now
          </button>
        </div>
      </div>
    </div>
  );
}
