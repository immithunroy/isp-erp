import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { Card } from "../components/Card";
import { SyncIndicator } from "../components/SyncIndicator";
import { useAuth } from "../store/auth";
import { useSync } from "../store/sync";
import { getProfile, getSettings } from "../api/mobile";
import { getQueueCounts } from "../db/queue";
import type { MobileProfile, MobileSettings } from "../types";

export function DashboardScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const { isOnline, queueCounts, triggerSync } = useSync();
  const [profile, setProfile] = useState<MobileProfile | null>(null);
  const [settings, setSettings] = useState<MobileSettings | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([getProfile(), getSettings()]);
      setProfile(p);
      setSettings(s);
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    triggerSync();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {profile?.full_name ?? user?.full_name}</Text>
        <SyncIndicator />
      </View>

      <Card title="Today">
        <Text style={styles.label}>Employee Code</Text>
        <Text style={styles.value}>{profile?.employee_code ?? "—"}</Text>
        <Text style={styles.label}>Department</Text>
        <Text style={styles.value}>{profile?.department ?? "—"}</Text>
        <Text style={styles.label}>Designation</Text>
        <Text style={styles.value}>{profile?.designation ?? "—"}</Text>
      </Card>

      <Card title="Sync Status">
        <Text style={styles.label}>Network</Text>
        <Text style={[styles.value, { color: isOnline ? "#22c55e" : "#ef4444" }]}>
          {isOnline ? "Online" : "Offline"}
        </Text>
        <Text style={styles.label}>Pending Uploads</Text>
        <Text style={styles.value}>{queueCounts.pending}</Text>
        <Text style={styles.label}>Synced</Text>
        <Text style={styles.value}>{queueCounts.synced}</Text>
        <Text style={styles.label}>Failed</Text>
        <Text style={[styles.value, { color: queueCounts.failed > 0 ? "#ef4444" : "#334155" }]}>
          {queueCounts.failed}
        </Text>
      </Card>

      <Card title="Quick Actions">
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate("Attendance")}
        >
          <Text style={styles.actionText}>Check In / Out</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate("GPS")}
        >
          <Text style={styles.actionText}>Capture GPS</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate("Jobs")}
        >
          <Text style={styles.actionText}>My Jobs</Text>
        </TouchableOpacity>
      </Card>

      {settings && (
        <Card title="Settings">
          <Text style={styles.label}>GPS Max Accuracy</Text>
          <Text style={styles.value}>{settings.gps_max_accuracy_meters}m</Text>
          <Text style={styles.label}>Face Verification</Text>
          <Text style={styles.value}>
            {settings.face_verification_required ? "Required" : "Optional"}
          </Text>
          <Text style={styles.label}>Tracking</Text>
          <Text style={styles.value}>
            {settings.tracking_enabled ? "Enabled" : "Disabled (default)"}
          </Text>
        </Card>
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
    padding: 16,
  },
  greeting: { fontSize: 20, fontWeight: "600", color: "#1e293b" },
  label: { fontSize: 13, color: "#94a3b8", marginTop: 8 },
  value: { fontSize: 16, color: "#334155", fontWeight: "500" },
  actionBtn: {
    backgroundColor: "#0ea5e9",
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  actionText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});