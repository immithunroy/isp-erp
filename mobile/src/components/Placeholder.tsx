import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface PlaceholderProps {
  title: string;
  phase: string;
  description?: string;
}

export function Placeholder({ title, phase, description }: PlaceholderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.badge}>Coming in {phase}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 12,
  },
  badge: {
    fontSize: 14,
    color: "#0ea5e9",
    fontWeight: "500",
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },
});