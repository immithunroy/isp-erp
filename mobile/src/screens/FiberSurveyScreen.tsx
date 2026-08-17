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

export function FiberSurveyScreen() {
  const { isOnline, triggerSync } = useSync();
  const [profile, setProfile] = useState<MobileProfile | null>(null);
  const [gps, setGps] = useState<{latitude: number; longitude: number; accuracy: number} | null>(null);  const [cableCode, setCableCode] = useState("");
  const [cableName, setCableName] = useState("");
  const [cableType, setCableType] = useState("");
  const [coreCount, setCoreCount] = useState("48");
  const [startAsset, setStartAsset] = useState("");
  const [endAsset, setEndAsset] = useState("");
  const [notes, setNotes] = useState("");

  React.useEffect(() => { getProfile().then(setProfile).catch(() => {}); }, []);

  const handleSubmit = useCallback(() => {
    if (!cableCode || !coreCount) return;
    const idemKey = generateIdempotencyKey();
    const payload = {
      organization_id: profile?.employee_id ? 1 : 1,
      cable_code: cableCode,
      name: cableName || cableCode,
      cable_type: cableType || undefined,
      core_count: parseInt(coreCount, 10),
      start_asset_id: startAsset ? parseInt(startAsset, 10) : undefined,
      end_asset_id: endAsset ? parseInt(endAsset, 10) : undefined,
      notes: notes || undefined,
    };
    enqueue(idemKey, "fiber_cable", payload);
    if (isOnline) triggerSync();
    Alert.alert("Saved", "Fiber cable recorded. It will sync automatically.", [
      { text: "OK", onPress: () => { setCableCode(""); setCableName(""); setCoreCount("48"); setStartAsset(""); setEndAsset(""); setNotes(""); } },
    ]);
  }, [cableCode, cableName, cableType, coreCount, startAsset, endAsset, notes, profile, isOnline, triggerSync]);

  return (
    <ScrollView style={styles.container}>
      <Card title="Fiber Cable Survey">
        <Text style={styles.desc}>Register a fiber cable with core count and route.</Text>
        <Text style={styles.label}>Cable Code *</Text>
        <TextInput style={styles.input} value={cableCode} onChangeText={setCableCode} placeholder="e.g. FIB-001" />
        <Text style={styles.label}>Cable Name</Text>
        <TextInput style={styles.input} value={cableName} onChangeText={setCableName} placeholder="e.g. Main Road Fiber" />
        <Text style={styles.label}>Cable Type</Text>
        <TextInput style={styles.input} value={cableType} onChangeText={setCableType} placeholder="e.g. underground" />
        <Text style={styles.label}>Core Count *</Text>
        <TextInput style={styles.input} value={coreCount} onChangeText={setCoreCount} keyboardType="numeric" placeholder="48" />
        <Text style={styles.label}>Start Asset ID</Text>
        <TextInput style={styles.input} value={startAsset} onChangeText={setStartAsset} keyboardType="numeric" placeholder="1" />
        <Text style={styles.label}>End Asset ID</Text>
        <TextInput style={styles.input} value={endAsset} onChangeText={setEndAsset} keyboardType="numeric" placeholder="2" />
        <Text style={styles.label}>Notes</Text>
        <TextInput style={styles.input} value={notes} onChangeText={setNotes} placeholder="Notes..." multiline />
        <TouchableOpacity style={styles.btn} onPress={handleSubmit} disabled={!cableCode || !coreCount}>
          <Text style={styles.btnText}>Save Fiber Cable</Text>
        </TouchableOpacity>
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