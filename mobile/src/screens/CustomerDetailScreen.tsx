import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Card } from "../components/Card";
import { SyncIndicator } from "../components/SyncIndicator";
import { getCustomer, listCustomerLocations, listCustomerVisits } from "../api/customers";
import type { Customer, CustomerLocation, CustomerVisit } from "../types";

export function CustomerDetailScreen({ route }: { route: any }) {
  const customerId = route?.params?.customerId ?? 0;
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [locations, setLocations] = useState<CustomerLocation[]>([]);
  const [visits, setVisits] = useState<CustomerVisit[]>([]);
  const [activeTab, setActiveTab] = useState<"info" | "locations" | "visits">("info");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, locs, v] = await Promise.all([
        getCustomer(customerId),
        listCustomerLocations(customerId),
        listCustomerVisits(customerId),
      ]);
      setCustomer(c);
      setLocations(locs.items);
      setVisits(v.items);
    } catch {
      // best-effort
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  if (!customer) {
    return (
      <View style={styles.centerContent}>
        <Text style={styles.emptyText}>Customer not found</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{customer.name}</Text>
        <SyncIndicator />
      </View>

      <View style={styles.tabs}>
        {(["info", "locations", "visits"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t === "info" ? "Info" : t === "locations" ? "Locations" : "Visits"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === "info" && (
        <Card title="Customer Information">
          <Text style={styles.label}>Code</Text>
          <Text style={styles.value}>{customer.customer_code}</Text>
          <Text style={styles.label}>Phone</Text>
          <Text style={styles.value}>{customer.phone ?? "—"}</Text>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{customer.email ?? "—"}</Text>
          <Text style={styles.label}>Address</Text>
          <Text style={styles.value}>{customer.address ?? "—"}</Text>
          <Text style={styles.label}>Status</Text>
          <Text style={styles.value}>{customer.status}</Text>
          <Text style={styles.label}>Installation Date</Text>
          <Text style={styles.value}>{customer.installation_date ?? "—"}</Text>
        </Card>
      )}

      {activeTab === "locations" && (
        <View>
          {locations.length === 0 ? (
            <Card>
              <Text style={styles.emptyText}>No location records</Text>
            </Card>
          ) : (
            locations.map((loc) => (
              <Card key={loc.id}>
                <View style={styles.locRow}>
                  <Text style={styles.locCoord}>
                    {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                  </Text>
                  {loc.is_current && (
                    <Text style={styles.currentBadge}>Current</Text>
                  )}
                </View>
                {loc.accuracy != null && (
                  <Text style={styles.locAcc}>Accuracy: {loc.accuracy.toFixed(1)}m</Text>
                )}
                {loc.address && <Text style={styles.locAddr}>{loc.address}</Text>}
                <Text style={styles.locDate}>{new Date(loc.recorded_at).toLocaleString()}</Text>
              </Card>
            ))
          )}
        </View>
      )}

      {activeTab === "visits" && (
        <View>
          {visits.length === 0 ? (
            <Card>
              <Text style={styles.emptyText}>No visit records</Text>
            </Card>
          ) : (
            visits.map((v) => (
              <Card key={v.id}>
                <Text style={styles.visitPurpose}>{v.purpose ?? "Visit"}</Text>
                <Text style={styles.visitDate}>
                  {new Date(v.visited_at).toLocaleString()}
                </Text>
                {v.notes && <Text style={styles.visitNotes}>{v.notes}</Text>}
              </Card>
            ))
          )}
        </View>
      )}
    </ScrollView>
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
  tabs: { flexDirection: "row", paddingHorizontal: 16, marginBottom: 12 },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: "#0ea5e9" },
  tabText: { fontSize: 14, color: "#94a3b8", fontWeight: "500" },
  tabTextActive: { color: "#0ea5e9", fontWeight: "600" },
  label: { fontSize: 13, color: "#94a3b8", marginTop: 8 },
  value: { fontSize: 16, color: "#334155", fontWeight: "500" },
  locRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  locCoord: { fontSize: 14, color: "#334155", fontWeight: "500" },
  currentBadge: {
    fontSize: 11,
    fontWeight: "600",
    backgroundColor: "#dcfce7",
    color: "#16a34a",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  locAcc: { fontSize: 13, color: "#64748b", marginTop: 4 },
  locAddr: { fontSize: 14, color: "#334155", marginTop: 4 },
  locDate: { fontSize: 12, color: "#94a3b8", marginTop: 4 },
  visitPurpose: { fontSize: 16, fontWeight: "600", color: "#1e293b" },
  visitDate: { fontSize: 13, color: "#64748b", marginTop: 4 },
  visitNotes: { fontSize: 14, color: "#334155", marginTop: 4 },
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { fontSize: 15, color: "#94a3b8", textAlign: "center", padding: 16 },
});