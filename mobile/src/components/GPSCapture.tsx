import React, { useState, useEffect } from "react";
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from "react-native";
import * as Location from "expo-location";

interface GPSCaptureProps {
  onCapture: (coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
  }) => void;
  maxAccuracy?: number;
}

export function GPSCapture({ onCapture, maxAccuracy = 50 }: GPSCaptureProps) {
  const [coords, setCoords] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getLocation = async () => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Location permission denied");
        setLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const data = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy ?? 0,
      };
      setCoords(data);
      onCapture(data);
    } catch (err) {
      setError("Failed to get location");
    } finally {
      setLoading(false);
    }
  };

  const accuracyWarning =
    coords && coords.accuracy > maxAccuracy;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={getLocation} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Capture GPS</Text>
        )}
      </TouchableOpacity>
      {error && <Text style={styles.error}>{error}</Text>}
      {coords && (
        <View style={styles.coords}>
          <Text style={styles.coordText}>Lat: {coords.latitude.toFixed(6)}</Text>
          <Text style={styles.coordText}>Lon: {coords.longitude.toFixed(6)}</Text>
          <Text style={styles.coordText}>Accuracy: {coords.accuracy.toFixed(1)}m</Text>
          {accuracyWarning && (
            <Text style={styles.warning}>
              Warning: Accuracy exceeds {maxAccuracy}m threshold
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  button: {
    backgroundColor: "#0ea5e9",
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  error: { color: "#ef4444", marginTop: 8, fontSize: 14 },
  coords: { marginTop: 12, padding: 12, backgroundColor: "#f1f5f9", borderRadius: 8 },
  coordText: { fontSize: 14, color: "#334155", marginBottom: 4 },
  warning: { color: "#f59e0b", marginTop: 4, fontSize: 13, fontWeight: "500" },
});