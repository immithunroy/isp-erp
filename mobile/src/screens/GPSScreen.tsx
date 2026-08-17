import React, { useState, useCallback } from "react";
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert } from "react-native";
import { Card } from "../components/Card";
import { GPSCapture } from "../components/GPSCapture";
import { useSync } from "../store/sync";
import { getProfile, getSettings } from "../api/mobile";
import { enqueue } from "../db/queue";
import { generateIdempotencyKey } from "../utils/idempotency";
import { nowISO } from "../utils/datetime";
import type { GpsActivity, MobileProfile, MobileSettings } from "../types";

const ACTIVITIES: { label: string; value: GpsActivity }[] = [
  { label: "Attendance", value: "attendance" },
  { label: "Job", value: "job" },
  { label: "Asset Installation", value: "asset_install" },
  { label: "Asset Inspection", value: "asset_inspect" },
  { label: "Customer Visit", value: "customer_visit" },
];

export function GPSScreen() {
  const { isOnline, triggerSync } = useSync();
  const [profile, setProfile] = useState<MobileProfile | null>(null);
  const [settings, setSettings] = useState<MobileSettings | null>(null);
  const [activity, setActivity] = useState<GpsActivity | null>(null);
  const [gps, setGps] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null>(null);

  React.useEffect(() => {
    const load = async () => {
      try {
        const [p, s] = await Promise.all([getProfile(), getSettings()]);
        setProfile(p);
        setSettings(s);
      } catch {
        // best-effort
      }
    };
    load();
  }, []);

  const handleSubmit = useCallback(() => {
    if (!profile?.employee_id || !activity || !gps) return;
    const idemKey = generateIdempotencyKey();
    enqueue(idemKey, "gps", {
      latitude: gps.latitude,
      longitude: gps.longitude,
      accuracy: gps.accuracy,
      recorded_at: nowISO(),
      activity,
      device_id: "mobile-app",
    });
    if (isOnline) triggerSync();
    Alert.alert("Success", "GPS record saved. It will sync automatically.", [
      { text: "OK", onPress: () => {
        setActivity(null);
        setGps(null);
      }},
    ]);
  }, [profile, activity, gps, isOnline, triggerSync]);

  return (
    <ScrollView style={styles.container}>
      <Card title="GPS Capture">
        <Text style={styles.label}>Select Activity</Text>
        {ACTIVITIES.map((a) => (
          <TouchableOpacity
            key={a.value}
            style={[
              styles.actBtn,
              activity === a.value && styles.actBtnSelected,
            ]}
            onPress={() => setActivity(a.value)}
          >
            <Text
              style={[
                styles.actBtnText,
                activity === a.value && styles.actBtnTextSelected,
              ]}
            >
              {a.label}
            </Text>
          </TouchableOpacity>
        ))}
      </Card>

      {activity && (
        <Card title="Capture Location">
          <GPSCapture
            onCapture={(c) => setGps(c)}
            maxAccuracy={settings?.gps_max_accuracy_meters ?? 50}
          />
        </Card>
      )}

      {gps && activity && (
        <Card title="Submit GPS Record">
          <Text style={styles.label}>Activity: {activity}</Text>
          <Text style={styles.label}>
            Location: {gps.latitude.toFixed(6)}, {gps.longitude.toFixed(6)}
          </Text>
          <Text style={styles.label}>Accuracy: {gps.accuracy.toFixed(1)}m</Text>
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
            <Text style={styles.submitText}>Save GPS Record</Text>
          </TouchableOpacity>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9", padding: 16 },
  label: { fontSize: 14, color: "#334155", marginBottom: 6, fontWeight: "500" },
  actBtn: {
    backgroundColor: "#f1f5f9",
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  actBtnSelected: {
    backgroundColor: "#0ea5e9",
    borderColor: "#0ea5e9",
  },
  actBtnText: { fontSize: 15, color: "#1e293b", fontWeight: "500" },
  actBtnTextSelected: { color: "#fff" },
  submitBtn: {
    backgroundColor: "#22c55e",
    height: 50,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  submitText: { color: "#fff", fontSize: 17, fontWeight: "600" },
});