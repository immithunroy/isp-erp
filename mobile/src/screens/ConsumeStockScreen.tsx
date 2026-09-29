import { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  FlatList,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { SyncIndicator } from "../components/SyncIndicator";
import { useSync } from "../store/sync";
import { ApiError } from "../api/client";
import {
  listStockItems,
  listStockLevels,
  listWarehouses,
  createStockMovement,
} from "../api/inventory";
import { listNetworkAssets } from "../api/network";
import { enqueue } from "../db/queue";
import { generateIdempotencyKey } from "../utils/idempotency";
import type {
  NetworkAsset,
  StockItem,
  StockLevel,
  StockMovementCreate,
  Warehouse,
} from "../types";

const ORGANIZATION_ID = 1;
const MAX_ROWS = 50;

export function ConsumeStockScreen() {
  const { isOnline, refreshCounts } = useSync();

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [assets, setAssets] = useState<NetworkAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [item, setItem] = useState<StockItem | null>(null);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [itemQuery, setItemQuery] = useState("");

  const [asset, setAsset] = useState<NetworkAsset | null>(null);
  const [assetQuery, setAssetQuery] = useState("");
  const [assetFocused, setAssetFocused] = useState(false);
  const [showAllAssetTypes, setShowAllAssetTypes] = useState(false);

  const [level, setLevel] = useState<StockLevel | null>(null);
  const [levelLoading, setLevelLoading] = useState(false);
  const [warehousePickerOpen, setWarehousePickerOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [w, i, a] = await Promise.all([
          listWarehouses({ is_active: true, page_size: 200 }),
          listStockItems({ is_active: true, page_size: 200 }),
          listNetworkAssets({ page_size: 200 }),
        ]);
        setWarehouses(w.items);
        setItems(i.items);
        setAssets(a.items);
        setLoadError(null);
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : "Could not load stock data."
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!warehouse || !item) {
      setLevel(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLevelLoading(true);
      try {
        const data = await listStockLevels({
          warehouse_id: warehouse.id,
          item_id: item.id,
        });
        if (!cancelled) setLevel(data.items[0] ?? null);
      } catch {
        if (!cancelled) setLevel(null);
      } finally {
        if (!cancelled) setLevelLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [warehouse, item]);

  const parsedQty = parseFloat(quantity);
  const qtyValue = Number.isFinite(parsedQty) ? parsedQty : 0;
  const available = level ? level.available_quantity : null;
  const overAvailable = available !== null && qtyValue > available;
  const assetClass = item ? item.asset_class : null;

  const visibleItems = items
    .filter((i) => {
      const q = itemQuery.trim().toLowerCase();
      if (!q) return true;
      return i.sku.toLowerCase().includes(q) || i.name.toLowerCase().includes(q);
    })
    .slice(0, MAX_ROWS);

  const typeaheadAssets = assets
    .filter((a) =>
      assetClass && !showAllAssetTypes ? a.asset_type === assetClass : true
    )
    .filter((a) => {
      const q = assetQuery.trim().toLowerCase();
      if (!q) return true;
      return a.asset_code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
    })
    .slice(0, MAX_ROWS);

  const availabilityText = !item || !warehouse
    ? "Pick a warehouse and an item to see availability."
    : levelLoading
    ? "Checking availability..."
    : level
    ? `Available: ${level.available_quantity} ${item.unit}${level.is_low ? " — low stock" : ""}`
    : "No stock record for this item at this warehouse.";

  const selectItem = useCallback((selected: StockItem) => {
    setItem(selected);
    setQuantity("");
    setAsset(null);
    setAssetQuery("");
    setShowAllAssetTypes(false);
    setFormError(null);
  }, []);

  const clearItem = useCallback(() => {
    setItem(null);
    setQuantity("");
    setFormError(null);
  }, []);

  const resetForm = useCallback(() => {
    setItem(null);
    setQuantity("");
    setReason("");
    setItemQuery("");
    setAsset(null);
    setAssetQuery("");
    setAssetFocused(false);
    setShowAllAssetTypes(false);
    setFormError(null);
  }, []);

  const queueIssue = useCallback(
    (payload: StockMovementCreate) => {
      enqueue(
        generateIdempotencyKey(),
        "stock_movement",
        payload as unknown as Record<string, unknown>
      );
      refreshCounts();
      Alert.alert(
        "Queued",
        "No connection to the server, so the issue was queued. It will sync automatically.",
        [{ text: "OK", onPress: resetForm }]
      );
    },
    [refreshCounts, resetForm]
  );

  const handleSubmit = useCallback(async () => {
    if (!warehouse) {
      setFormError("Select a warehouse.");
      return;
    }
    if (!item) {
      setFormError("Select a stock item.");
      return;
    }
    if (qtyValue <= 0) {
      setFormError("Enter a quantity greater than zero.");
      return;
    }
    if (overAvailable && available !== null) {
      setFormError(
        `Only ${available} ${item.unit} available at ${warehouse.code}.`
      );
      return;
    }

    const payload: StockMovementCreate = {
      organization_id: ORGANIZATION_ID,
      movement_type: "issue",
      item_id: item.id,
      warehouse_id: warehouse.id,
      quantity: qtyValue,
      network_asset_id: asset ? asset.id : undefined,
      reason: reason.trim() || undefined,
    };

    setSubmitting(true);
    setFormError(null);
    if (!isOnline) {
      queueIssue(payload);
      setSubmitting(false);
      return;
    }
    try {
      const movement = await createStockMovement(payload);
      const balance =
        movement.balance_after !== null
          ? ` Balance is now ${movement.balance_after} ${item.unit}.`
          : "";
      Alert.alert(
        "Stock issued",
        `${movement.quantity} ${item.unit} of ${item.sku} issued from ${warehouse.code}.${balance}`,
        [{ text: "OK", onPress: resetForm }]
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        queueIssue(payload);
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    warehouse,
    item,
    qtyValue,
    overAvailable,
    available,
    asset,
    reason,
    isOnline,
    queueIssue,
    resetForm,
  ]);

  if (loading) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.title}>Consume Stock</Text>
        <SyncIndicator />
      </View>
      <Text style={styles.desc}>
        Issue spare parts from a warehouse and link them to the network asset
        they were installed into.
      </Text>

      {loadError && <Text style={styles.error}>{loadError}</Text>}

      <Card title="Warehouse">
        <TouchableOpacity
          style={styles.select}
          onPress={() => setWarehousePickerOpen(true)}
        >
          <Text style={warehouse ? styles.selectValue : styles.selectPlaceholder}>
            {warehouse ? `${warehouse.code} — ${warehouse.name}` : "Select warehouse..."}
          </Text>
        </TouchableOpacity>
        {warehouse && (
          <TouchableOpacity
            onPress={() => {
              setWarehouse(null);
              setQuantity("");
            }}
          >
            <Text style={styles.clearText}>Change warehouse</Text>
          </TouchableOpacity>
        )}
      </Card>

      <Card title="Item">
        <TextInput
          style={styles.input}
          value={itemQuery}
          onChangeText={setItemQuery}
          placeholder="Search by SKU or name..."
        />
        {item && (
          <View style={styles.selectedRow}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowCode}>{item.sku}</Text>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowMeta}>
                {item.unit}
                {item.asset_class ? ` · ${item.asset_class}` : ""}
              </Text>
            </View>
            <TouchableOpacity onPress={clearItem}>
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}
        {!item &&
          visibleItems.map((i) => (
            <TouchableOpacity
              key={i.id}
              style={styles.optionRow}
              onPress={() => selectItem(i)}
            >
              <Text style={styles.rowCode}>{i.sku}</Text>
              <Text style={styles.rowName}>{i.name}</Text>
              <Text style={styles.rowMeta}>
                {i.unit}
                {i.asset_class ? ` · ${i.asset_class}` : ""}
              </Text>
            </TouchableOpacity>
          ))}
        {!item && visibleItems.length === 0 && (
          <Text style={styles.emptyText}>No active items match that search.</Text>
        )}
      </Card>

      <Card title="Quantity">
        <TextInput
          style={styles.input}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="decimal-pad"
          placeholder="e.g. 2"
        />
        <Text
          style={[
            styles.hint,
            level !== null && level.is_low && styles.hintWarn,
            overAvailable && styles.error,
          ]}
        >
          {availabilityText}
        </Text>
      </Card>

      <Card title="Network Asset (optional)">
        {assetClass ? (
          <TouchableOpacity onPress={() => setShowAllAssetTypes((v) => !v)}>
            <Text style={styles.hint}>
              Typically installed into: {assetClass}
              {showAllAssetTypes ? " — showing all types" : " — tap to show all types"}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.hint}>
            {item
              ? "This item has no asset class. Link any asset, or leave it unlinked."
              : "Pick an item first to narrow the asset list by type."}
          </Text>
        )}
        {asset ? (
          <View style={styles.selectedRow}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowCode}>{asset.asset_code}</Text>
              <Text style={styles.rowName}>{asset.name}</Text>
              <Text style={styles.rowMeta}>{asset.asset_type}</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setAsset(null);
                setAssetQuery("");
              }}
            >
              <Text style={styles.clearText}>Not linked</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TextInput
            style={styles.input}
            value={assetQuery}
            onChangeText={setAssetQuery}
            onFocus={() => setAssetFocused(true)}
            onBlur={() => setAssetFocused(false)}
            placeholder="Search asset code or name..."
          />
        )}
        {!asset && (assetFocused || assetQuery.trim().length > 0) && (
          <View style={styles.typeahead}>
            {typeaheadAssets.length === 0 ? (
              <Text style={styles.emptyText}>No assets match that search.</Text>
            ) : (
              typeaheadAssets.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={styles.optionRow}
                  onPress={() => {
                    setAsset(a);
                    setAssetQuery("");
                    setAssetFocused(false);
                  }}
                >
                  <Text style={styles.rowCode}>{a.asset_code}</Text>
                  <Text style={styles.rowName}>
                    {a.name} · {a.asset_type}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
        {!asset && !assetFocused && (
          <TouchableOpacity onPress={() => setAssetFocused(true)}>
            <Text style={styles.clearText}>Browse assets</Text>
          </TouchableOpacity>
        )}
      </Card>

      <Card title="Reason (optional)">
        <TextInput
          style={styles.textArea}
          value={reason}
          onChangeText={setReason}
          placeholder="e.g. Replaced failed drop fibre during fault visit"
          multiline
        />
      </Card>

      <Card title="Submit">
        {formError && <Text style={styles.error}>{formError}</Text>}
        <Button
          title={isOnline ? "Issue Stock" : "Queue Issue"}
          onPress={handleSubmit}
          disabled={submitting}
        />
        {submitting && (
          <View style={styles.submittingRow}>
            <ActivityIndicator size="small" color="#0ea5e9" />
            <Text style={styles.hint}>Submitting issue...</Text>
          </View>
        )}
        {!isOnline && (
          <Text style={styles.hint}>
            Offline — the issue will be queued and synced later.
          </Text>
        )}
      </Card>

      <Modal
        visible={warehousePickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setWarehousePickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select Warehouse</Text>
            <FlatList
              data={warehouses}
              keyExtractor={(w) => String(w.id)}
              renderItem={({ item: w }) => (
                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={() => {
                    setWarehouse(w);
                    setWarehousePickerOpen(false);
                  }}
                >
                  <Text style={styles.rowCode}>{w.code}</Text>
                  <Text style={styles.rowName}>{w.name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No active warehouses</Text>
              }
            />
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setWarehousePickerOpen(false)}
            >
              <Text style={styles.clearText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9", padding: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 22, fontWeight: "700", color: "#1e293b" },
  desc: { fontSize: 14, color: "#64748b", marginTop: 6, marginBottom: 12 },
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
    minHeight: 80,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    backgroundColor: "#fff",
    textAlignVertical: "top",
  },
  select: {
    height: 44,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  selectValue: { fontSize: 15, color: "#1e293b", fontWeight: "500" },
  selectPlaceholder: { fontSize: 15, color: "#94a3b8" },
  selectedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f0f9ff",
    borderWidth: 1,
    borderColor: "#bae6fd",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  optionRow: {
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 10,
  },
  rowInfo: { flex: 1 },
  rowCode: { fontSize: 15, fontWeight: "600", color: "#1e293b" },
  rowName: { fontSize: 14, color: "#334155", marginTop: 2 },
  rowMeta: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  typeahead: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 10,
    maxHeight: 220,
  },
  clearText: { fontSize: 13, color: "#0ea5e9", fontWeight: "600", marginTop: 8 },
  hint: { fontSize: 13, color: "#64748b", marginTop: 8 },
  hintWarn: { color: "#b45309" },
  emptyText: { fontSize: 14, color: "#94a3b8", paddingVertical: 12 },
  error: { fontSize: 13, color: "#dc2626", marginBottom: 10 },
  submittingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: "70%",
  },
  modalTitle: { fontSize: 18, fontWeight: "600", color: "#1e293b", marginBottom: 8 },
  modalClose: { marginTop: 12, alignItems: "center" },
});
