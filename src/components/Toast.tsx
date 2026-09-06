import { X } from 'lucide-react';

/**
 * The toast region is mounted for the life of the app and the message is put
 * into it, rather than the whole `role="status"` node being mounted with the
 * message — a freshly mounted live region is announced unreliably.
 */
export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="toast-region" role="status" aria-atomic="true">
      {message && (
        <div className="toast">
          <span>{message}</span>
          <button
            type="button"
            className="toast-dismiss"
            aria-label="Dismiss message"
            onClick={onDismiss}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
