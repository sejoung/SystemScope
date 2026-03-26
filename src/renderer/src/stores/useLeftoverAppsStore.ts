import { create } from "zustand";
import type { AppLeftoverDataItem } from "@shared/types";
import { useToast } from "../components/Toast";

const LEFTOVER_SIZE_IDLE_BATCH_SIZE = 1;
const LEFTOVER_SIZE_PRIORITY_BATCH_SIZE = 4;
const LEFTOVER_SIZE_IDLE_DELAY_MS = 350;
const LOAD_LEFTOVERS_FALLBACK_ERROR = "Unable to load leftover app data.";

interface LeftoverAppsState {
  items: AppLeftoverDataItem[];
  loadError?: string;
  refreshing: boolean;
  ensureLoaded: () => Promise<void>;
  refresh: () => Promise<void>;
  setHydrationHints: (itemIds: string[], prioritize: boolean) => void;
}

let hydrationTimerId: number | null = null;
let hydrationInFlight = false;
let hydrationPriorityIds: string[] = [];
let hydrationPrioritize = false;
let datasetVersion = 0;
let loadInFlight: Promise<void> | null = null;

function clearHydrationTimer() {
  if (hydrationTimerId !== null) {
    window.clearTimeout(hydrationTimerId);
    hydrationTimerId = null;
  }
}

function mergeHydratedLeftovers(
  currentItems: AppLeftoverDataItem[],
  hydratedItems: AppLeftoverDataItem[],
): AppLeftoverDataItem[] {
  const hydratedById = new Map(hydratedItems.map((item) => [item.id, item]));
  return currentItems.map((item) => hydratedById.get(item.id) ?? item);
}

function getNextHydrationBatch(items: AppLeftoverDataItem[]): string[] {
  const pendingIds = items
    .filter((item) => item.sizeBytes === undefined)
    .map((item) => item.id);
  if (pendingIds.length === 0) return [];

  const pendingIdSet = new Set(pendingIds);
  const prioritizedPendingIds = hydrationPriorityIds.filter((itemId) =>
    pendingIdSet.has(itemId),
  );
  const sourceIds =
    prioritizedPendingIds.length > 0 ? prioritizedPendingIds : pendingIds;
  const batchSize = hydrationPrioritize
    ? LEFTOVER_SIZE_PRIORITY_BATCH_SIZE
    : LEFTOVER_SIZE_IDLE_BATCH_SIZE;

  return sourceIds.slice(0, batchSize);
}

function scheduleHydration() {
  clearHydrationTimer();
  if (hydrationInFlight) return;

  const pendingIds = getNextHydrationBatch(useLeftoverAppsStore.getState().items);
  if (pendingIds.length === 0) return;

  const delay = hydrationPrioritize ? 0 : LEFTOVER_SIZE_IDLE_DELAY_MS;
  hydrationTimerId = window.setTimeout(() => {
    hydrationTimerId = null;
    void runHydration();
  }, delay);
}

async function runHydration() {
  if (hydrationInFlight) return;

  const state = useLeftoverAppsStore.getState();
  const pendingIds = getNextHydrationBatch(state.items);
  if (pendingIds.length === 0) return;

  const runVersion = datasetVersion;
  hydrationInFlight = true;

  try {
    const res = await window.systemScope.hydrateLeftoverAppDataSizes(pendingIds);
    if (!res.ok || !res.data) {
      useToast
        .getState()
        .show(res.error?.message ?? LOAD_LEFTOVERS_FALLBACK_ERROR);
      return;
    }

    if (runVersion !== datasetVersion) return;

    const hydratedItems = res.data as AppLeftoverDataItem[];
    useLeftoverAppsStore.setState((current) => ({
      items: mergeHydratedLeftovers(current.items, hydratedItems),
    }));
  } finally {
    hydrationInFlight = false;
    scheduleHydration();
  }
}

async function loadLeftovers(force: boolean) {
  if (loadInFlight) {
    await loadInFlight;
    if (!force) return;
  }

  loadInFlight = (async () => {
    useLeftoverAppsStore.setState({ refreshing: true });

    const res = await window.systemScope.listLeftoverAppData();
    if (res.ok && res.data) {
      datasetVersion += 1;
      clearHydrationTimer();
      const items = res.data as AppLeftoverDataItem[];
      useLeftoverAppsStore.setState({
        items,
        loadError: undefined,
        refreshing: false,
      });
      scheduleHydration();
      return;
    }

    const message = res.error?.message ?? LOAD_LEFTOVERS_FALLBACK_ERROR;
    useLeftoverAppsStore.setState({ loadError: message, refreshing: false });
    useToast.getState().show(message);
  })();

  try {
    await loadInFlight;
  } finally {
    loadInFlight = null;
  }
}

export const useLeftoverAppsStore = create<LeftoverAppsState>((_set, get) => ({
  items: [],
  loadError: undefined,
  refreshing: false,

  ensureLoaded: async () => {
    if (get().items.length > 0 || get().refreshing || loadInFlight) return;
    await loadLeftovers(false);
  },

  refresh: async () => {
    await loadLeftovers(true);
  },

  setHydrationHints: (itemIds, prioritize) => {
    hydrationPriorityIds = [...new Set(itemIds)];
    hydrationPrioritize = prioritize;
    scheduleHydration();
  },
}));
