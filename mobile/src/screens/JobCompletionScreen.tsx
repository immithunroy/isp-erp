import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from "react-native";
import { Card } from "../components/Card";
import { useSync } from "../store/sync";
import { transitionWorkOrder } from "../api/customers";
import { enqueue } from "../db/queue";
import { generateIdempotencyKey } from "../utils/idempotency";
import { nowISO } from "../utils/datetime";
import type { WorkOrder } from "../types";

const TRANSITIONS: Record<string, string[]> = {
  open: ["assigned", "cancelled"],
  assigned: ["accepted", "cancelled"],
  accepted: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: ["approved"],
  cancelled: [],
  approved: [],
};

export function JobCompletionScreen({ route }: { route: any }) {
  const workOrder = (route?.params?.workOrder ?? {}) as WorkOrder;
  const { isOnline, triggerSync } = useSync();
  const [report, setReport] = useState("");
  const [notes, setNotes] = useState("");

  const allowedTransitions = TRANSITIONS[workOrder.status] ?? [];

  const handleTransition = useCallback(
    (newStatus: string) => {
      const idemKey = generateIdempotencyKey();
      const payload = {
        work_order_id: workOrder.id,
        status: newStatus,
        notes: notes || undefined,
        completion_report: report || undefined,
      };
      // Try immediate API call if online, otherwise queue
      if (isOnline) {
        transitionWorkOrder(workOrder.id, { status: newStatus, notes })
          .then(() => {
            Alert.alert("Success", `Work order ${newStatus}`);
          })
          .catch(() => {
            enqueue(idemKey, "work_order_transition", payload);
          });
      } else {
        enqueue(idemKey, "work_order_transition", payload);
      }
      if (isOnline) triggerSync();
      Alert.alert("Saved", `Work order transitioned to ${newStatus}.`, [
        { text: "OK", onPress: () => { setReport(""); setNotes(""); } },
      ]);
    },
    [workOrder, report, notes, isOnline, triggerSync]
  );

  return (
    <ScrollView style={styles.container}>
      <Card title={workOrder.work_order_code}>
        <Text style={styles.label}>Type</Text>
        <Text style={styles.value}>{workOrder.job_type}</Text>
        <Text style={styles.label}>Priority</Text>
        <Text style={styles.value}>{workOrder.priority}</Text>
        <Text style={styles.label}>Status</Text>
        <Text style={styles.value}>{workOrder.status}</Text>
        {workOrder.scheduled_date && (
          <>
            <Text style={styles.label}>Scheduled</Text>
            <Text style={styles.value}>{workOrder.scheduled_date}</Text>
          </>
        )}
      </Card>

      {workOrder.status === "in_progress" && (
        <Card title="Completion Report">
          <TextInput
            style={styles.textArea}
            value={report}
            onChangeText={setReport}
            placeholder="Describe work completed..."
            multiline
            numberOfLines={4}
          />
        </Card>
      )}

      <Card title="Add Notes (optional)">
        <TextInput
          style={styles.input}
          value={notes}
          onChangeText={setNotes}
          placeholder="Transition notes..."
        />
      </Card>

      {allowedTransitions.length > 0 ? (
        <Card title="Change Status">
          {allowedTransitions.map((status) => (
            <TouchableOpacity
              key={status}
              style={[styles.transBtn, { backgroundColor: status === "cancelled" ? "#ef4444" : "#0ea5e9" }]}
              onPress={() => handleTransition(status)}
            >
              <Text style={styles.transText}>
                Mark as {status.replace("_", " ")}
              </Text>
            </TouchableOpacity>
          ))}
        </Card>
      ) : (
        <Card>
          <Text style={styles.noTransitions}>
            No further status changes available.
          </Text>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9", padding: 16 },
  label: { fontSize: 13, color: "#94a3b8", marginTop: 8 },
  value: { fontSize: 16, color: "#334155", fontWeight: "500" },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    backgroundColor: "#fff",
  },
  textArea: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    backgroundColor: "#fff",
    textAlignVertical: "top",
  },
  transBtn: {
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  transText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  noTransitions: { fontSize: 15, color: "#94a3b8", textAlign: "center" },
});