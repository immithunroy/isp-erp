import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSync } from "../store/sync";

export function SyncIndicator() {
  const { isOnline, isSyncing, queueCounts } = useSync();

  const dotColor = !isOnline ? "#ef4444" : isSyncing ? "#f59e0b" : queueCounts.pending > 0 ? "#f59e0b" : "#22c55e";
  const statusText = !isOnline
    ? "Offline"
    : isSyncing
    ? "Syncing..."
    : queueCounts.pending > 0
    ? `${queueCounts.pending} pending`
    : "All synced";

  return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={styles.text}>{statusText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    fontSize: 12,
    color: "#64748b",
  },
});