import React, { useState, useEffect } from "react";
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert } from "react-native";
import { Card } from "../components/Card";
import { SyncIndicator } from "../components/SyncIndicator";
import { useAuth } from "../store/auth";
import { useSync } from "../store/sync";
import { getProfile } from "../api/mobile";
import type { MobileProfile } from "../types";

export function ProfileScreen() {
  const { user, logout } = useAuth();
  const { queueCounts } = useSync();
  const [profile, setProfile] = useState<MobileProfile | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const p = await getProfile();
        setProfile(p);
      } catch {
        // best-effort
      }
    };
    load();
  }, []);

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => logout() },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <SyncIndicator />
      </View>

      <Card title="Account">
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{profile?.full_name ?? user?.full_name}</Text>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{profile?.email ?? user?.email}</Text>
        <Text style={styles.label}>Phone</Text>
        <Text style={styles.value}>{profile?.phone ?? "—"}</Text>
      </Card>

      <Card title="Employee">
        <Text style={styles.label}>Employee Code</Text>
        <Text style={styles.value}>{profile?.employee_code ?? "Not linked"}</Text>
        <Text style={styles.label}>Department</Text>
        <Text style={styles.value}>{profile?.department ?? "—"}</Text>
        <Text style={styles.label}>Designation</Text>
        <Text style={styles.value}>{profile?.designation ?? "—"}</Text>
      </Card>

      <Card title="Sync Statistics">
        <Text style={styles.label}>Pending Uploads</Text>
        <Text style={styles.value}>{queueCounts.pending}</Text>
        <Text style={styles.label}>Synced Records</Text>
        <Text style={styles.value}>{queueCounts.synced}</Text>
        <Text style={styles.label}>Failed Records</Text>
        <Text style={styles.value}>{queueCounts.failed}</Text>
      </Card>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9", padding: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: "700", color: "#1e293b" },
  label: { fontSize: 13, color: "#94a3b8", marginTop: 8 },
  value: { fontSize: 16, color: "#334155", fontWeight: "500" },
  logoutBtn: {
    backgroundColor: "#ef4444",
    height: 50,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    marginBottom: 32,
  },
  logoutText: { color: "#fff", fontSize: 17, fontWeight: "600" },
});