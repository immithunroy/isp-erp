import React, { useState, useCallback } from "react";
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, TextInput, Alert } from "react-native";
import { Card } from "../components/Card";
import { GPSCapture } from "../components/GPSCapture";
import { useSync } from "../store/sync";
import { getProfile } from "../api/mobile";
import { createNetworkAsset from "../api/network";
import { enqueue } from "../db/queue";
import { generateIdempotencyKey } from "../utils/idempotency";
import { nowISO } from "../utils/datetime";
import type { MobileProfile } from "../types";

export function TJBoxScreen() {
  const { isOnline, triggerSync } = useSync();
  const [profile, setProfile] = useState<MobileProfile | null>(null);
  const [gps, setGps] = useState<{latitude: number; longitude: number; accuracy: number} | null>(null);  const [assetCode, setAssetCode] = useState("TJB");
  const [assetName, setAssetName] = useState("TJ Box");
  const [status, setStatus] = useState("active");
  const [capacity, setCapacity] = useState("");
  const [notes, setNotes] = useState("");

  React.useEffect(() => { getProfile().then(setProfile).catch(() => {}); }, []);

  const handleSubmit = useCallback(() => {
    if (!assetCode || !gps) return;
    const idemKey = generateIdempotencyKey();
    const payload = {
      organization_id: 1,
      asset_code: assetCode,
      asset_type: "tj_box",
      name: assetName,
      status,
      latitude: gps.latitude,
      longitude: gps.longitude,
      accuracy_m: gps.accuracy,
      capacity: capacity ? parseInt(capacity, 10) : undefined,
      notes: notes || undefined,
    };
    enqueue(idemKey, "network_asset", payload);
    if (isOnline) triggerSync();
    Alert.alert("Saved", "TJ Box recorded. It will sync automatically.", [
      { text: "OK", onPress: () => { setAssetCode("TJB"); setAssetName("TJ Box"); setStatus("active"); setCapacity(""); setNotes(""); } },
    ]);
  }, [assetCode, assetName, status, capacity, notes, gps, isOnline, triggerSync]);

  return (
    <ScrollView style={styles.container}>
      <Card title="TJ Box Capture">
        <Text style={styles.desc}>Capture a TJ Box network asset.</Text>
        <GPSCapture onCapture={setGps} maxAccuracy={50} />
        {gps && (
          <View>
            <Text style={styles.label}>Asset Code *</Text>
            <TextInput style={styles.input} value={assetCode} onChangeText={setAssetCode} placeholder="TJB-001" />
            <Text style={styles.label}>Asset Name *</Text>
            <TextInput style={styles.input} value={assetName} onChangeText={setAssetName} placeholder="TJ Box Name" />
            <Text style={styles.label}>Status</Text>
            <TextInput style={styles.input} value={status} onChangeText={setStatus} placeholder="active" />
            <Text style={styles.label}>Capacity (optional)</Text>
            <TextInput style={styles.input} value={capacity} onChangeText={setCapacity} keyboardType="numeric" placeholder="e.g. 16" />
            <Text style={styles.label}>Notes</Text>
            <TextInput style={styles.input} value={notes} onChangeText={setNotes} placeholder="Notes..." multiline />
            <TouchableOpacity style={styles.btn} onPress={handleSubmit} disabled={!assetCode || !gps}>
              <Text style={styles.btnText}>Save TJ Box</Text>
            </TouchableOpacity>
          </View>
        )}
      </Card>
    </ScrollView>
  );
}const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9", padding: 16 },
  desc: { fontSize: 14, color: "#64748b", marginBottom: 12 },
  label: { fontSize: 14, color: "#334155", marginBottom: 6, fontWeight: "500" },
  input: { height: 44, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingHorizontal: 12, fontSize: 15, backgroundColor: "#fff", marginBottom: 12 },
  btn: { backgroundColor: "#0ea5e9", height: 48, borderRadius: 8, alignItems: "center", justifyContent: "center", marginTop: 8 },
  btnText: { color: "#fff", fontSize: 17, fontWeight: "600" },
});