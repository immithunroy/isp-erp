import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Card } from "../components/Card";
import { SyncIndicator } from "../components/SyncIndicator";
import { listCustomers } from "../api/customers";
import type { Customer } from "../types";

export function CustomerListScreen({ navigation }: { navigation: any }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listCustomers({ page, page_size: 20, search: search || undefined });
      setCustomers(data.items);
    } catch {
      // best-effort
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const debounce = setTimeout(() => load(), 300);
    return () => clearTimeout(debounce);
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: Customer }) => (
    <TouchableOpacity
      style={styles.itemRow}
      onPress={() => navigation.navigate("CustomerDetail", { customerId: item.id })}
    >
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemCode}>{item.customer_code}</Text>
        {item.phone && <Text style={styles.itemPhone}>{item.phone}</Text>}
      </View>
      <View style={styles.itemStatus}>
        <Text
          style={[
            styles.statusBadge,
            item.status === "active"
              ? styles.statusActive
              : styles.statusInactive,
          ]}
        >
          {item.status}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Customers</Text>
        <SyncIndicator />
      </View>
      <TextInput
        style={styles.searchInput}
        placeholder="Search by name, code, phone..."
        value={search}
        onChangeText={setSearch}
      />
      {loading && customers.length === 0 ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#0ea5e9" />
        </View>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.centerContent}>
              <Text style={styles.emptyText}>No customers found</Text>
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
  searchInput: {
    height: 44,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    backgroundColor: "#fff",
  },
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
  itemName: { fontSize: 16, fontWeight: "600", color: "#1e293b" },
  itemCode: { fontSize: 13, color: "#64748b", marginTop: 2 },
  itemPhone: { fontSize: 13, color: "#64748b", marginTop: 2 },
  itemStatus: {},
  statusBadge: {
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: "hidden",
  },
  statusActive: { backgroundColor: "#dcfce7", color: "#16a34a" },
  statusInactive: { backgroundColor: "#fee2e2", color: "#dc2626" },
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { fontSize: 15, color: "#94a3b8" },
});