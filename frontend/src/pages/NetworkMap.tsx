import { useEffect, useMemo, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuth } from "../lib/auth";
import { listOrganizations, type Organization } from "../lib/core-api";
import {
  createNetworkAsset,
  getMapBbox,
  listFiberCables,
  listNetworkAssets,
  type BboxParams,
  type FiberCable,
  type MapItem,
  type NetworkAsset,
  type NetworkAssetCreate,
} from "../lib/network-api";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Modal } from "../components/Modal";
import { Field, NoAccess, ServerError } from "../components/ui";
import { Spinner } from "../components/Spinner";

const ASSET_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  olt: { label: "OLT", color: "#dc2626" },
  pop: { label: "POP", color: "#2563eb" },
  odf: { label: "ODF", color: "#7c3aed" },
  tj_box: { label: "TJ Box", color: "#d97706" },
  enclosure: { label: "Enclosure", color: "#16a34a" },
  splitter: { label: "Splitter", color: "#0891b2" },
  pole: { label: "Pole", color: "#475569" },
  manhole: { label: "Manhole", color: "#ea580c" },
  customer_premise: { label: "Customer Premise", color: "#db2777" },
  other: { label: "Other", color: "#64748b" },
};

const ALL_ASSET_TYPES = Object.keys(ASSET_TYPE_CONFIG);

const ASSET_STATUSES: { value: string; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "active", label: "Active" },
  { value: "maintenance", label: "Maintenance" },
  { value: "faulty", label: "Faulty" },
  { value: "decommissioned", label: "Decommissioned" },
];

type Cluster =
  | { type: "single"; item: MapItem }
  | { type: "cluster"; items: MapItem[]; lat: number; lng: number };

function clusterItems(items: MapItem[], zoom: number): Cluster[] {
  const decimals = Math.max(0, Math.min(6, Math.floor((zoom - 3) / 2)));
  const groups = new Map<string, MapItem[]>();
  for (const it of items) {
    const key = `${it.latitude.toFixed(decimals)}|${it.longitude.toFixed(decimals)}`;
    const arr = groups.get(key);
    if (arr) arr.push(it);
    else groups.set(key, [it]);
  }
  const out: Cluster[] = [];
  for (const arr of groups.values()) {
    if (arr.length === 1) {
      out.push({ type: "single", item: arr[0] });
    } else {
      const lat = arr.reduce((s, i) => s + i.latitude, 0) / arr.length;
      const lng = arr.reduce((s, i) => s + i.longitude, 0) / arr.length;
      out.push({ type: "cluster", items: arr, lat, lng });
    }
  }
  return out;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      (({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[c]),
  );
}

function makeAssetIcon(assetType: string, status: string): L.DivIcon {
  const color = ASSET_TYPE_CONFIG[assetType]?.color ?? "#64748b";
  const dim = status === "decommissioned" || status === "faulty" ? "opacity:0.5;" : "";
  return L.divIcon({
    className: "network-marker",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.45);${dim}"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  });
}

function makeClusterIcon(count: number): L.DivIcon {
  return L.divIcon({
    className: "network-cluster",
    html: `<div style="width:30px;height:30px;border-radius:50%;background:#1e293b;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.5)">${count}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function extractCableCoords(
  cable: FiberCable,
  assetMap: Map<number, { lat: number; lng: number }>,
): [number, number][] {
  const gj = cable.route_geojson as
    | {
        type?: string;
        geometry?: { type?: string; coordinates?: unknown };
        coordinates?: unknown;
      }
    | null;
  if (gj) {
    const geom = gj.geometry ?? gj;
    if (geom.type === "LineString" && Array.isArray(geom.coordinates)) {
      return geom.coordinates as [number, number][];
    }
    if (geom.type === "MultiLineString" && Array.isArray(geom.coordinates)) {
      const lines = geom.coordinates as [number, number][][];
      return lines[0] ?? [];
    }
  }
  const result: [number, number][] = [];
  if (cable.start_asset_id) {
    const a = assetMap.get(cable.start_asset_id);
    if (a) result.push([a.lng, a.lat]);
  }
  if (cable.end_asset_id) {
    const a = assetMap.get(cable.end_asset_id);
    if (a) result.push([a.lng, a.lat]);
  }
  return result;
}

interface AssetFormValues {
  organization_id: string;
  asset_code: string;
  asset_type: string;
  name: string;
  latitude: string;
  longitude: string;
  status: string;
  capacity: string;
  notes: string;
}

export function NetworkMap() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const canRead =
    hasPermission("network:map:read") || hasPermission("network:assets:read");
  const canWrite = hasPermission("network:assets:write");

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const cablesLayerRef = useRef<L.LayerGroup | null>(null);
  const bboxTimeoutRef = useRef<number | null>(null);

  const [bbox, setBbox] = useState<BboxParams | null>(null);
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(
    () => new Set(ALL_ASSET_TYPES),
  );
  const [showCables, setShowCables] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [center, setCenter] = useState<{ lat: number; lng: number }>({
    lat: 20,
    lng: 0,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [searchTrigger, setSearchTrigger] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom: 4,
      preferCanvas: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);
    cablesLayerRef.current = L.layerGroup().addTo(map);

    const updateBbox = () => {
      const c = map.getCenter();
      setCenter({ lat: c.lat, lng: c.lng });
      if (bboxTimeoutRef.current) window.clearTimeout(bboxTimeoutRef.current);
      bboxTimeoutRef.current = window.setTimeout(() => {
        const b = map.getBounds();
        setBbox({
          min_lon: b.getWest(),
          min_lat: b.getSouth(),
          max_lon: b.getEast(),
          max_lat: b.getNorth(),
        });
      }, 350);
    };
    updateBbox();
    map.on("moveend", updateBbox);
    map.on("zoomend", updateBbox);
    mapRef.current = map;
    window.setTimeout(() => map.invalidateSize(), 0);
    return () => {
      if (bboxTimeoutRef.current) window.clearTimeout(bboxTimeoutRef.current);
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
      cablesLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bboxKey = bbox
    ? `${bbox.min_lon.toFixed(4)},${bbox.min_lat.toFixed(4)},${bbox.max_lon.toFixed(4)},${bbox.max_lat.toFixed(4)}`
    : "";

  const assetsQ = useQuery({
    queryKey: ["network-map-bbox", bboxKey],
    queryFn: () => getMapBbox(bbox as BboxParams),
    enabled: !!bbox && canRead,
    staleTime: 10_000,
  });

  const cablesQ = useQuery({
    queryKey: ["network-map-cables"],
    queryFn: () => listFiberCables({ page: 1, page_size: 500 }),
    enabled: canRead,
    staleTime: 60_000,
  });

  const orgsQ = useQuery({
    queryKey: ["organizations-all"],
    queryFn: () => listOrganizations({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
  });

  const searchQ = useQuery({
    queryKey: ["network-asset-search", searchTrigger],
    queryFn: () => listNetworkAssets({ search: searchTrigger, page: 1, page_size: 10 }),
    enabled: !!searchTrigger,
    staleTime: 30_000,
  });

  const createM = useMutation({
    mutationFn: (b: NetworkAssetCreate) => createNetworkAsset(b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["network-map-bbox"] });
      qc.invalidateQueries({ queryKey: ["network-assets"] });
      setAddOpen(false);
    },
  });

  const items = useMemo(() => assetsQ.data ?? [], [assetsQ.data]);
  const assetCoordMap = useMemo(() => {
    const m = new Map<number, { lat: number; lng: number }>();
    for (const it of items) m.set(it.id, { lat: it.latitude, lng: it.longitude });
    return m;
  }, [items]);

  const filtered = useMemo(
    () => items.filter((i) => visibleTypes.has(i.asset_type)),
    [items, visibleTypes],
  );

  useEffect(() => {
    const layer = markersLayerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    const zoom = map.getZoom();
    const clusters = clusterItems(filtered, zoom);
    for (const c of clusters) {
      if (c.type === "single") {
        const it = c.item;
        const marker = L.marker([it.latitude, it.longitude], {
          icon: makeAssetIcon(it.asset_type, it.status),
        });
        const el = document.createElement("div");
        el.className = "text-sm";
        el.innerHTML = `
          <div class="font-semibold">${escapeHtml(it.name)}</div>
          <div class="text-xs text-slate-500">${escapeHtml(it.asset_code)} · ${escapeHtml(it.asset_type)}</div>
          <div class="text-xs text-slate-500">Status: ${escapeHtml(it.status)}</div>
          <a href="/network/assets" class="text-brand text-xs underline">Open in Assets</a>
        `;
        const link = el.querySelector("a");
        link?.addEventListener("click", (e) => {
          e.preventDefault();
          navigate("/network/assets");
        });
        marker.bindPopup(el);
        layer.addLayer(marker);
      } else {
        const marker = L.marker([c.lat, c.lng], {
          icon: makeClusterIcon(c.items.length),
        });
        marker.on("click", () => {
          map.setView([c.lat, c.lng], Math.min(zoom + 2, 18));
        });
        layer.addLayer(marker);
      }
    }
  }, [filtered, navigate]);

  useEffect(() => {
    const layer = cablesLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!showCables) return;
    const cables = cablesQ.data?.items ?? [];
    for (const cable of cables) {
      const coords = extractCableCoords(cable, assetCoordMap);
      if (coords.length < 2) continue;
      const latlngs = coords.map(([lng, lat]) => L.latLng(lat, lng));
      const line = L.polyline(latlngs, {
        color: "#0ea5e9",
        weight: 2,
        opacity: 0.7,
      });
      line.bindPopup(
        `<div class="text-sm"><div class="font-semibold">${escapeHtml(cable.name)}</div><div class="text-xs text-slate-500">${escapeHtml(cable.cable_code)} · ${cable.core_count} cores</div></div>`,
      );
      layer.addLayer(line);
    }
  }, [cablesQ.data, showCables, assetCoordMap]);

  if (!canRead) return <NoAccess />;

  const toggleType = (t: string) => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const flyToAsset = (a: NetworkAsset) => {
    const map = mapRef.current;
    if (!map || a.latitude == null || a.longitude == null) return;
    map.setView([a.latitude, a.longitude], 16);
    setSearchOpen(false);
  };

  const runSearch = () => {
    if (!searchTerm.trim()) return;
    setSearchTrigger(searchTerm.trim());
    setSearchOpen(true);
  };

  return (
    <div className="relative h-[calc(100vh-3.5rem)] w-full md:h-screen">
      <div ref={containerRef} className="absolute inset-0 z-0" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex items-start justify-between gap-2 p-3">
        <div className="pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-md bg-white p-2 shadow-md">
          <Input
            placeholder="Search assets by code or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                runSearch();
              }
            }}
            className="h-9"
          />
          <Button size="sm" onClick={runSearch} disabled={!searchTerm.trim()}>
            Search
          </Button>
          {canWrite && (
            <Button
              size="sm"
              onClick={() => setAddOpen(true)}
              title="Add asset at map center"
            >
              Add Asset
            </Button>
          )}
        </div>
      </div>

      {searchOpen && searchTrigger && (
        <div className="absolute left-3 top-16 z-[600] w-80 max-w-[90vw] rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-xs font-medium text-slate-500">
            <span>Search results</span>
            <button
              type="button"
              className="text-slate-400 hover:text-slate-600"
              onClick={() => setSearchOpen(false)}
            >
              close
            </button>
          </div>
          {searchQ.isLoading ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-slate-500">
              <Spinner /> Searching...
            </div>
          ) : searchQ.isError ? (
            <div className="px-3 py-3 text-sm text-red-600">Search failed.</div>
          ) : searchQ.data && searchQ.data.items.length > 0 ? (
            <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
              {searchQ.data.items.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={() => flyToAsset(a)}
                  >
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-slate-500">
                      {a.asset_code} · {a.asset_type}
                      {a.latitude != null && a.longitude != null
                        ? ` · ${a.latitude.toFixed(5)}, ${a.longitude.toFixed(5)}`
                        : ""}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-3 py-3 text-sm text-slate-500">No assets found.</div>
          )}
        </div>
      )}

      <div className="absolute right-3 top-16 z-[500] w-56 rounded-md border border-slate-200 bg-white p-3 shadow-md">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Layers
        </div>
        <ul className="space-y-1 text-sm">
          {ALL_ASSET_TYPES.map((t) => {
            const cfg = ASSET_TYPE_CONFIG[t];
            const checked = visibleTypes.has(t);
            return (
              <li key={t} className="flex items-center gap-2">
                <label className="flex flex-1 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleType(t)}
                    className="h-3.5 w-3.5"
                  />
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: cfg.color }}
                  />
                  <span className="text-slate-700">{cfg.label}</span>
                </label>
              </li>
            );
          })}
          <li className="mt-1 border-t border-slate-100 pt-1">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showCables}
                onChange={() => setShowCables((v) => !v)}
                className="h-3.5 w-3.5"
              />
              <span
                className="inline-block h-2.5 w-6 rounded-full"
                style={{ background: "#0ea5e9" }}
              />
              <span className="text-slate-700">Fiber routes</span>
            </label>
          </li>
        </ul>
      </div>

      <div className="absolute bottom-3 left-3 z-[500] rounded-md bg-white/90 px-3 py-1.5 text-xs text-slate-600 shadow-sm">
        {assetsQ.isLoading
          ? "Loading assets..."
          : assetsQ.isError
            ? "Failed to load assets"
            : `${filtered.length} assets in view`}
      </div>

      {addOpen && (
        <AddAssetForm
          organizations={orgsQ.data?.items ?? []}
          center={center}
          submitting={createM.isPending}
          serverError={createM.error}
          onCancel={() => setAddOpen(false)}
          onSubmit={(body) => createM.mutate(body)}
        />
      )}
    </div>
  );
}

function AddAssetForm({
  organizations,
  center,
  submitting,
  serverError,
  onCancel,
  onSubmit,
}: {
  organizations: Organization[];
  center: { lat: number; lng: number };
  submitting: boolean;
  serverError: unknown;
  onCancel: () => void;
  onSubmit: (body: NetworkAssetCreate) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AssetFormValues>({
    defaultValues: {
      organization_id: "",
      asset_code: "",
      asset_type: "olt",
      name: "",
      latitude: center.lat.toFixed(6),
      longitude: center.lng.toFixed(6),
      status: "planned",
      capacity: "",
      notes: "",
    },
  });

  const onSubmitValues = (values: AssetFormValues) => {
    const organization_id = Number(values.organization_id);
    if (!organization_id) return;
    const lat = Number(values.latitude);
    const lng = Number(values.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    const body: NetworkAssetCreate = {
      organization_id,
      asset_code: values.asset_code,
      asset_type: values.asset_type,
      name: values.name,
      status: values.status,
      latitude: lat,
      longitude: lng,
      capacity: values.capacity || undefined,
      notes: values.notes || undefined,
    };
    onSubmit(body);
  };

  const selectClass =
    "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm";

  return (
    <Modal
      open
      onClose={onCancel}
      title="Add network asset"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" form="network-asset-form" disabled={submitting}>
            {submitting ? "Saving..." : "Create"}
          </Button>
        </>
      }
    >
      <form
        id="network-asset-form"
        onSubmit={handleSubmit(onSubmitValues)}
        className="space-y-4"
        noValidate
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Organization" error={errors.organization_id?.message}>
            <select
              className={selectClass}
              {...register("organization_id", {
                required: "Organization is required",
              })}
            >
              <option value="">— Select —</option>
              {organizations.map((o) => (
                <option key={o.id} value={String(o.id)}>
                  {o.name} ({o.code})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Asset code" error={errors.asset_code?.message}>
            <Input
              {...register("asset_code", { required: "Asset code is required" })}
            />
          </Field>
          <Field label="Asset type" error={errors.asset_type?.message}>
            <select
              className={selectClass}
              {...register("asset_type", { required: "Asset type is required" })}
            >
              {ALL_ASSET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ASSET_TYPE_CONFIG[t].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Name" error={errors.name?.message}>
            <Input {...register("name", { required: "Name is required" })} />
          </Field>
          <Field label="Latitude" error={errors.latitude?.message}>
            <Input
              step="any"
              {...register("latitude", { required: "Latitude is required" })}
            />
          </Field>
          <Field label="Longitude" error={errors.longitude?.message}>
            <Input
              step="any"
              {...register("longitude", { required: "Longitude is required" })}
            />
          </Field>
          <Field label="Status" error={errors.status?.message}>
            <select className={selectClass} {...register("status")}>
              {ASSET_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Capacity" hint="Optional, e.g. 16-port">
            <Input {...register("capacity")} />
          </Field>
        </div>
        <Field label="Notes" hint="Optional">
          <textarea
            className="h-24 w-full rounded-md border border-slate-300 bg-white p-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            {...register("notes")}
            spellCheck={false}
          />
        </Field>
        <p className="text-xs text-slate-500">
          Coordinates are pre-filled with the current map center. Pan/zoom the map
          before opening this form to set the desired location.
        </p>
        <ServerError error={serverError} />
      </form>
    </Modal>
  );
}
