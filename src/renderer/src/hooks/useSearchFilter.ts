import { startTransition, useState } from "react";

export function useSearchFilter() {
  const [draft, setDraft] = useState("");
  const [applied, setApplied] = useState("");

  const updateDraft = (value: string) => {
    setDraft(value);
    startTransition(() => {
      setApplied(value);
    });
  };

  const apply = () => {
    startTransition(() => {
      setApplied(draft);
    });
  };

  const clear = () => {
    setDraft("");
    startTransition(() => {
      setApplied("");
    });
  };

  const isEmpty = !draft && !applied;

  return {
    draft,
    applied,
    setDraft: updateDraft,
    apply,
    clear,
    isEmpty,
  } as const;
}
