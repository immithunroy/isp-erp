import { apiFetch } from "./api";

export interface TraceNode {
  kind: string;
  id: number;
  label: string;
  detail: Record<string, unknown> | null;
}

export interface TraceResult {
  direction: string;
  nodes: TraceNode[];
  found: boolean;
  error: string | null;
}

export interface TraceResultList {
  results: TraceResult[];
}

export function traceCustomerToOlt(customerId: number): Promise<TraceResult> {
  return apiFetch<TraceResult>(`/network/trace/customer/${customerId}`);
}

export function traceOltToCustomers(oltAssetId: number): Promise<TraceResultList> {
  return apiFetch<TraceResultList>(`/network/trace/olt/${oltAssetId}`);
}

export function traceCore(coreId: number): Promise<TraceResult> {
  return apiFetch<TraceResult>(`/network/trace/core/${coreId}`);
}
