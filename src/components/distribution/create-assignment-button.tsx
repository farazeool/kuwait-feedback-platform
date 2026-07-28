"use client";

import { useState } from "react";
import { CreateAssignmentDialog } from "./create-assignment-dialog";

interface CreateAssignmentButtonProps {
  employees: Array<{ id: string; user_id: string; display_name: string; email: string }>;
  templates: Array<{ id: string; template_name: string; is_active: boolean }>;
  variant?: "header" | "empty-state";
}

export function CreateAssignmentButton({ employees, templates, variant = "header" }: CreateAssignmentButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (variant === "empty-state") {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90"
        >
          Create assignment
        </button>
        {isOpen && (
          <CreateAssignmentDialog
            employees={employees}
            templates={templates}
            onClose={() => setIsOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90"
      >
        Create assignment
      </button>
      {isOpen && (
        <CreateAssignmentDialog
          employees={employees}
          templates={templates}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
