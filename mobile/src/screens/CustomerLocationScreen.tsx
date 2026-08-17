import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { Card } from "../components/Card";
import { GPSCapture } from "../components/GPSCapture";
import { useSync } from "../store/sync";
import { getProfile } from "../api/mobile";
import { addCustomerLocation } from "../api/customers";
import { enqueue } from "../db/queue";
import { generateIdempotencyKey } from "../utils/idempotency";
import { nowISO } from "../utils/datetime";
import type { MobileProfile } from "../types";

export function CustomerLocationScreen({ route }: { route: any }) {
  const customerId = route?.params?.customerId ?? 0;
  const { isOnline, triggerSync } = useSync();
  const [profile, setProfile] = useState<MobileProfile | null>(null);
  const [gps, setGps] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null>(null);
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  React.useEffect(() => {
    getProfile().then(setProfile).catch(() => {});
  }, []);

  const handleSubmit = useCallback(() => {
    if (!gps || !customerId) return;
    const idemKey = generateIdempotencyKey();
    const payload = {
      customer_id: customerId,
      latitude: gps.latitude,
      longitude: gps.longitude,
      accuracy: gps.accuracy,
      address: address || undefined,
      source: "mobile",
      collected_by: profile?.employee_id ?? undefined,
      collection_method: "gps",
      notes: notes || undefined,
    };
    enqueue(idemKey, "customer_location", payload);
    if (isOnline) triggerSync();
    Alert.alert("Success", "Customer location saved. It will sync automatically.", [
      { text: "OK", onPress: () => { setGps(null); setAddress(""); setNotes(""); } },
    ]);
  }, [gps, customerId, address, notes, profile, isOnline, triggerSync]);

  return (
    <ScrollView style={styles.container}>
      <Card title="Capture Customer Location">
        <Text style={styles.label}>Customer ID: {customerId}</Text>
        <GPSCapture onCapture={setGps} />
        {gps && (
          <View>
            <Text style={styles.label}>Address (optional)</Text>
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={setAddress}
              placeholder="Street address"
            />
            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              style={styles.input}
              value={notes}
              onChangeText={setNotes}
              placeholder="Notes about this location"
            />
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
              <Text style={styles.submitText}>Save Location</Text>
            </TouchableOpacity>
          </View>
        )}
      </Card>
    </ScrollView>
  );
}

// Need TextInput import
import { TextInput } from "react-native";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9", padding: 16 },
  label: { fontSize: 14, color: "#334155", marginBottom: 6, fontWeight: "500" },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  submitBtn: {
    backgroundColor: "#22c55e",
    height: 50,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  submitText: { color: "#fff", fontSize: 17, fontWeight: "600" },
});