import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Trash2 } from "lucide-react";

const CONFIRM_WORD = "DELETE";

interface TypedDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  title?: string;
  consequences: string[];
  onConfirm: () => void;
  isPending?: boolean;
}

export function TypedDeleteDialog({
  open,
  onOpenChange,
  entityType,
  title: titleProp,
  consequences,
  onConfirm,
  isPending = false,
}: TypedDeleteDialogProps) {
  const [typed, setTyped] = useState("");
  const confirmed = typed === CONFIRM_WORD;

  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  const title = titleProp
    ?? (entityType === "relationship"
      ? "Remove Relationship Permanently"
      : `Permanently Delete ${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]" data-testid="dialog-typed-delete">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5 shrink-0" />
            {title}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 pt-1">
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">This action is permanent and cannot be undone.</p>
                  <ul className="mt-1.5 space-y-1">
                    {consequences.map((c, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground/60 shrink-0" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-sm text-foreground">
                  To confirm, type <span className="font-mono font-semibold tracking-wide">{CONFIRM_WORD}</span> below:
                </p>
                <Input
                  value={typed}
                  onChange={e => setTyped(e.target.value)}
                  placeholder={CONFIRM_WORD}
                  autoComplete="off"
                  spellCheck={false}
                  data-testid="input-confirm-delete-name"
                  className={confirmed ? "border-destructive/60 ring-1 ring-destructive/40 font-mono" : "font-mono"}
                />
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            data-testid="button-cancel-delete"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!confirmed || isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="button-confirm-delete"
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            {isPending ? "Deleting..." : "Delete Permanently"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
