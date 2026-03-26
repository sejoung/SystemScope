import { useState } from "react";

export function useSearchFilter() {
  const [draft, setDraft] = useState("");
  const [applied, setApplied] = useState("");

  const updateDraft = (value: string) => {
    setDraft(value);
    setApplied(value);
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
    clear,
    isEmpty,
  } as const;
}
