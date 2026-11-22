"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
export const DialogRoot = Dialog.Root,
  DialogTrigger = Dialog.Trigger,
  DialogClose = Dialog.Close;
export function DialogContent({
  title,
  description,
  children,
  sheet = false,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  sheet?: boolean;
}) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="overlay" />
      <Dialog.Content className={sheet ? "dialog sheet" : "dialog"}>
        <div className="dialog-heading">
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Close className="icon-button" aria-label="Zamknij">
            <X size={21} />
          </Dialog.Close>
        </div>
        <Dialog.Description className="sr-only">
          {description}
        </Dialog.Description>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}
