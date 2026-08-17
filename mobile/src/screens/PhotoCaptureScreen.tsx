import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import { Card } from "../components/Card";
import * as ImagePicker from "expo-image-picker";
import { useSync } from "../store/sync";
import { enqueue } from "../db/queue";
import { generateIdempotencyKey } from "../utils/idempotency";
import { nowISO } from "../utils/datetime";

export function PhotoCaptureScreen({ route }: { route: any }) {
  const { isOnline, triggerSync } = useSync();
  const [photo, setPhoto] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const relatedType = route?.params?.relatedType ?? "general";
  const relatedId = route?.params?.relatedId ?? "";

  const takePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission denied", "Camera permission is required.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setPhoto(result.assets[0].uri);
    }
  }, []);

  const pickPhoto = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setPhoto(result.assets[0].uri);
    }
  }, []);

  const handleSave = useCallback(() => {
    if (!photo) return;
    const idemKey = generateIdempotencyKey();
    enqueue(idemKey, "photo", {
      uri: photo,
      caption,
      related_type: relatedType,
      related_id: String(relatedId),
      captured_at: nowISO(),
    });
    if (isOnline) triggerSync();
    Alert.alert("Saved", "Photo saved. It will sync automatically.", [
      { text: "OK", onPress: () => { setPhoto(null); setCaption(""); } },
    ]);
  }, [photo, caption, relatedType, relatedId, isOnline, triggerSync]);

  return (
    <View style={styles.container}>
      <Card title="Photo Capture">
        {photo ? (
          <Image source={{ uri: photo }} style={styles.preview} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>No photo selected</Text>
          </View>
        )}

        <TouchableOpacity style={styles.btn} onPress={takePhoto}>
          <Text style={styles.btnText}>Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { backgroundColor: "#64748b" }]} onPress={pickPhoto}>
          <Text style={styles.btnText}>Choose from Gallery</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Caption (optional)</Text>
        <TextInput
          style={styles.input}
          value={caption}
          onChangeText={setCaption}
          placeholder="Add a caption..."
        />

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: "#22c55e", marginTop: 12 }]}
          onPress={handleSave}
          disabled={!photo}
        >
          <Text style={styles.btnText}>Save Photo</Text>
        </TouchableOpacity>
      </Card>
    </View>
  );
}

// Need TextInput import
import { TextInput } from "react-native";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9", padding: 16 },
  preview: {
    width: "100%",
    height: 250,
    borderRadius: 12,
    marginBottom: 12,
  },
  placeholder: {
    height: 200,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  placeholderText: { fontSize: 15, color: "#94a3b8" },
  btn: {
    backgroundColor: "#0ea5e9",
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  label: { fontSize: 14, color: "#334155", marginBottom: 6, fontWeight: "500", marginTop: 12 },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    backgroundColor: "#fff",
  },
});