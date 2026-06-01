/** Virtual parent id for root-level nodes in `childOrder` (must stay in sync across editor modules). */
export const EDITOR_ROOT_KEY = "__root__" as const;

/** Stable empty array for Zustand selectors — never use inline `?? []` in a store selector. */
export const EMPTY_CHILD_IDS: string[] = [];
