import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Card } from "../components/Card";
import { SyncIndicator } from "../components/SyncIndicator";
import { listWorkOrders } from "../api/customers";
import { getProfile } from "../api/mobile";
import type { WorkOrder, MobileProfile } from "../types";

const STATUS_COLORS: Record<string, string> = {
  open: "#3b82f6",
  assigned: "#f59e0b",
  accepted: "#8b5cf6",
  in_progress: "#06b6d4",
  completed: "#22c55e",
  cancelled: "#ef4444",
  approved: "#16a34a",
};

export function JobsScreen({ navigation }: { navigation: any }) {
  const [jobs, setJobs] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<MobileProfile | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await getProfile();
      setProfile(p);
      const data = await listWorkOrders({
        assigned_employee_id: p.employee_id ?? undefined,
        page_size: 50,
      });
      setJobs(data.items);
    } catch {
      // best-effort
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: WorkOrder }) => (
    <TouchableOpacity
      style={styles.itemRow}
      onPress={() => navigation.navigate("JobCompletion", { workOrderId: item.id, workOrder: item })}
    >
      <View style={styles.itemInfo}>
        <Text style={styles.itemCode}>{item.work_order_code}</Text>
        <Text style={styles.itemType}>{item.job_type}</Text>
        {item.scheduled_date && (
          <Text style={styles.itemDate}>Scheduled: {item.scheduled_date}</Text>
        )}
        {item.notes && <Text style={styles.itemNotes}>{item.notes}</Text>}
      </View>
      <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] ?? "#94a3b8" }]}>
        <Text style={styles.statusText}>{item.status}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Jobs</Text>
        <SyncIndicator />
      </View>
      {loading && jobs.length === 0 ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#0ea5e9" />
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.centerContent}>
              <Text style={styles.emptyText}>No jobs assigned to you</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 22, fontWeight: "700", color: "#1e293b" },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  itemInfo: { flex: 1 },
  itemCode: { fontSize: 16, fontWeight: "600", color: "#1e293b" },
  itemType: { fontSize: 14, color: "#64748b", marginTop: 4 },
  itemDate: { fontSize: 13, color: "#94a3b8", marginTop: 2 },
  itemNotes: { fontSize: 13, color: "#64748b", marginTop: 4 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { fontSize: 15, color: "#94a3b8" },
});