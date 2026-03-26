import { useState } from "react";

export function useSearchFilter() {
  const [draft, setDraft] = useState("");
  const [applied, setApplied] = useState("");

  const updateDraft = (value: string) => {
    setDraft(value);
    setApplied(value);
  };

  const apply = () => {
    setApplied(draft);
  };

  const clear = () => {
    setDraft("");
    setApplied("");
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
