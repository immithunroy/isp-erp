import React, { useState, useCallback } from "react";
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert } from "react-native";
import { Card } from "../components/Card";
import { GPSCapture } from "../components/GPSCapture";
import { FaceCapture } from "../components/FaceCapture";
import { useAuth } from "../store/auth";
import { useSync } from "../store/sync";
import { getProfile, getSettings } from "../api/mobile";
import { enqueue } from "../db/queue";
import { generateIdempotencyKey } from "../utils/idempotency";
import { nowISO, todayDate } from "../utils/datetime";
import type { AttendanceType, MobileProfile, MobileSettings } from "../types";

const ATT_TYPES: { label: string; value: AttendanceType }[] = [
  { label: "Check In", value: "check_in" },
  { label: "Check Out", value: "check_out" },
  { label: "Break Resume", value: "break_resume" },
  { label: "Break End", value: "break_end" },
  { label: "Field Duty", value: "field" },
];

export function AttendanceScreen() {
  const { user } = useAuth();
  const { isOnline, triggerSync } = useSync();
  const [profile, setProfile] = useState<MobileProfile | null>(null);
  const [settings, setSettings] = useState<MobileSettings | null>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedType, setSelectedType] = useState<AttendanceType | null>(null);
  const [gps, setGps] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null>(null);
  const [face, setFace] = useState<{
    faceVerified: boolean;
    faceScore: number;
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
    if (!profile?.employee_id || !selectedType || !gps) return;
    const idemKey = generateIdempotencyKey();
    const payload = {
      employee_id: profile.employee_id,
      date: todayDate(),
      attendance_type: selectedType,
      local_ts: nowISO(),
      latitude: gps.latitude,
      longitude: gps.longitude,
      gps_accuracy: gps.accuracy,
      face_verified: face?.face_verified ?? false,
      face_score: face?.faceScore ?? 0,
      device_id: "mobile-app",
    };
    enqueue(idemKey, "attendance", payload);
    if (isOnline) triggerSync();
    Alert.alert("Success", "Attendance recorded. It will sync automatically.", [
      { text: "OK", onPress: () => resetForm() },
    ]);
  }, [profile, selectedType, gps, face, isOnline, triggerSync]);

  const resetForm = () => {
    setStep(1);
    setSelectedType(null);
    setGps(null);
    setFace(null);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.steps}>
        <Text style={step >= 1 ? styles.stepActive : styles.stepDone}>1. Type</Text>
        <Text style={step >= 2 ? styles.stepActive : styles.stepInactive}>2. GPS</Text>
        <Text style={step >= 3 ? styles.stepActive : styles.stepInactive}>3. Face</Text>
        <Text style={step >= 4 ? styles.stepActive : styles.stepInactive}>4. Submit</Text>
      </View>

      {step === 1 && (
        <Card title="Select Attendance Type">
          {ATT_TYPES.map((t) => (
            <TouchableOpacity
              key={t.value}
              style={styles.typeBtn}
              onPress={() => {
                setSelectedType(t.value);
                setStep(2);
              }}
            >
              <Text style={styles.typeBtnText}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </Card>
      )}

      {step === 2 && (
        <Card title="Capture GPS Location">
          <GPSCapture
            onCapture={(c) => {
              setGps(c);
              setStep(3);
            }}
            maxAccuracy={settings?.gps_max_accuracy_meters ?? 50}
          />
          <TouchableOpacity style={styles.skipBtn} onPress={() => setStep(3)}>
            <Text style={styles.skipText}>Skip (without GPS)</Text>
          </TouchableOpacity>
        </Card>
      )}

      {step === 3 && (
        <Card title="Face Verification">
          {settings?.face_verification_required ? (
            <FaceCapture
              onCapture={(f) => {
                setFace(f);
                setStep(4);
              }}
            />
          ) : (
            <View>
              <Text style={styles.optionalText}>Face verification is optional.</Text>
              <TouchableOpacity
                style={styles.skipBtn}
                onPress={() => {
                  setFace({ faceVerified: false, faceScore: 0 });
                  setStep(4);
                }}
              >
                <Text style={styles.skipText}>Skip</Text>
              </TouchableOpacity>
            </View>
          )}
        </Card>
      )}

      {step === 4 && (
        <Card title="Review & Submit">
          <Text style={styles.label}>Type: {selectedType}</Text>
          {gps && (
            <>
              <Text style={styles.label}>
                GPS: {gps.latitude.toFixed(4)}, {gps.longitude.toFixed(4)}
              </Text>
              <Text style={styles.label}>Accuracy: {gps.accuracy.toFixed(1)}m</Text>
            </>
          )}
          <Text style={styles.label}>
            Face: {face?.faceVerified ? "Verified" : "Not verified"}
          </Text>
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
            <Text style={styles.submitText}>Submit Attendance</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={resetForm}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9", padding: 16 },
  steps: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  stepActive: { fontSize: 13, fontWeight: "600", color: "#0ea5e9" },
  stepDone: { fontSize: 13, fontWeight: "600", color: "#22c55e" },
  stepInactive: { fontSize: 13, color: "#94a3b8" },
  typeBtn: {
    backgroundColor: "#f1f5f9",
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  typeBtnText: { fontSize: 16, color: "#1e293b", fontWeight: "500" },
  skipBtn: { marginTop: 12, alignItems: "center" },
  skipText: { color: "#94a3b8", fontSize: 14 },
  optionalText: { fontSize: 14, color: "#64748b", marginBottom: 12, textAlign: "center" },
  label: { fontSize: 14, color: "#334155", marginBottom: 6 },
  submitBtn: {
    backgroundColor: "#22c55e",
    height: 50,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  submitText: { color: "#fff", fontSize: 17, fontWeight: "600" },
  cancelBtn: { marginTop: 8, alignItems: "center" },
  cancelText: { color: "#ef4444", fontSize: 15 },
});