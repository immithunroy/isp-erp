import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import * as Network from "expo-network";
import { getPending, markSynced, markFailed, getQueueCounts } from "../db/queue";
import { syncBatch } from "../api/mobile";
import type { SyncItemCreate, QueueCounts } from "../types";

interface SyncContextValue {
  isOnline: boolean;
  isSyncing: boolean;
  queueCounts: QueueCounts;
  refreshCounts: () => void;
  triggerSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | undefined>(undefined);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [queueCounts, setQueueCounts] = useState<QueueCounts>({
    pending: 0,
    synced: 0,
    failed: 0,
  });

  const refreshCounts = useCallback(() => {
    const counts = getQueueCounts();
    setQueueCounts(counts);
  }, []);

  const triggerSync = useCallback(async () => {
    if (isSyncing || !isOnline) return;
    setIsSyncing(true);
    try {
      const pending = getPending(50);
      if (pending.length === 0) return;

      const items: SyncItemCreate[] = pending.map((row) => ({
        idempotency_key: row.idempotency_key,
        entity_type: row.entity_type,
        payload: JSON.parse(row.payload) as Record<string, unknown>,
      }));

      const result = await syncBatch({ items });

      for (const r of result.results) {
        const row = pending.find((p) => p.idempotency_key === r.idempotency_key);
        if (!row) continue;
        if (r.status === "done") {
          markSynced(row.id, r.record_id);
        } else {
          markFailed(row.id, r.error ?? "Unknown error");
        }
      }
      refreshCounts();
    } catch (err) {
      // Network error — will retry on next sync cycle
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, refreshCounts]);

  // Monitor network status
  useEffect(() => {
    const checkNetwork = async () => {
      const state = await Network.getNetworkStateAsync();
      setIsOnline(state.isConnected ?? false);
    };
    checkNetwork();
    const interval = setInterval(checkNetwork, 10000);
    return () => clearInterval(interval);
  }, []);

  // Auto-sync when online
  useEffect(() => {
    if (isOnline) {
      triggerSync();
      const interval = setInterval(triggerSync, 30000);
      return () => clearInterval(interval);
    }
  }, [isOnline, triggerSync]);

  // Refresh counts on mount
  useEffect(() => {
    refreshCounts();
  }, [refreshCounts]);

  return (
    <SyncContext.Provider
      value={{ isOnline, isSyncing, queueCounts, refreshCounts, triggerSync }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used within SyncProvider");
  return ctx;
}