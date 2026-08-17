import React, { useState, useRef } from "react";
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";

interface FaceCaptureProps {
  onCapture: (result: { faceVerified: boolean; faceScore: number }) => void;
}

export function FaceCapture({ onCapture }: FaceCaptureProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const handleCapture = async () => {
    setCapturing(true);
    // Placeholder: in production, this would capture a photo and run
    // face verification against a stored embedding. For now, we return
    // a success with score 0.0 — the architecture is in place for
    // future face recognition integration.
    setTimeout(() => {
      onCapture({ faceVerified: true, faceScore: 0.0 });
      setCapturing(false);
    }, 1000);
  };

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Camera Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
          mirror
        />
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={handleCapture}
        disabled={capturing}
      >
        {capturing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Capture Face</Text>
        )}
      </TouchableOpacity>
      <Text style={styles.note}>
        Face verification is a placeholder. Actual face recognition will be
        integrated in a future update.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  cameraContainer: {
    height: 300,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
  },
  camera: { flex: 1 },
  button: {
    backgroundColor: "#0ea5e9",
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  note: { fontSize: 12, color: "#94a3b8", marginTop: 8, textAlign: "center" },
});