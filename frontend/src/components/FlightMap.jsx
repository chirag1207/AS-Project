import { useEffect, useRef, useState } from "react";
import s from "./FlightMap.module.css";

// Leaflet loaded via CDN in index.html — we reference window.L
// This avoids ESM/SSR issues with Leaflet's DOM dependency

const TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const CAT_COLOR = { VFR: "#3fb950", MVFR: "#58a6ff", IFR: "#f85149", LIFR: "#bc8cff", UNKNOWN: "#8b949e" };

// Great-circle compass bearing between two points (proper formula, not planar atan2)
function bearingBetween(lat1, lon1, lat2, lon2) {
  const toRad = d => d * Math.PI / 180;
  const toDeg = r => r * 180 / Math.PI;
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  return (toDeg(Math.atan2(y, x)) + 360) % 360; // 0° = North, clockwise
}

// Great-circle arc interpolation
function gcArc(lat1, lon1, lat2, lon2, steps = 80) {
  const toRad = d => d * Math.PI / 180;
  const toDeg = r => r * 180 / Math.PI;

  const φ1 = toRad(lat1), λ1 = toRad(lon1);
  const φ2 = toRad(lat2), λ2 = toRad(lon2);

  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((φ2 - φ1) / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2
  ));

  if (d < 0.001) return [[lat1, lon1], [lat2, lon2]];

  const points = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    points.push([toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), toDeg(Math.atan2(y, x))]);
  }
  return points;
}

// Airport SVG marker
function makeMarker(L, cat, label, isOrigin) {
  const color = CAT_COLOR[cat] || CAT_COLOR.UNKNOWN;
  const size = isOrigin ? 14 : 14;
  const svg = `
    <svg width="${size * 2 + 2}" height="${size * 2 + 24}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size + 1}" cy="${size + 1}" r="${size}" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="2"/>
      <circle cx="${size + 1}" cy="${size + 1}" r="5" fill="${color}"/>
      <text x="${size + 1}" y="${size * 2 + 18}" text-anchor="middle"
        font-family="JetBrains Mono,monospace" font-size="11" font-weight="700" fill="${color}">${label}</text>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize:   [size * 2 + 2, size * 2 + 24],
    iconAnchor: [size + 1, size + 1],
  });
}

// Animated airplane along route — custom SVG, nose points north (0deg) by default
// so `bearing` from bearingBetween() can be applied directly with no offset.
function makePlaneIcon(L, bearing) {
  const svg = `
    <svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg"
         style="transform:rotate(${bearing}deg); transform-origin:14px 14px; filter:drop-shadow(0 0 4px #f97316)">
      <path d="M14 1 L18 11 L26 16 L18 17.5 L16.5 25 L14 21 L11.5 25 L10 17.5 L2 16 L10 11 Z"
            fill="#f97316" stroke="#fff" stroke-width="0.6"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize:   [28, 28],
    iconAnchor: [14, 14],
  });
}

export default function FlightMap({ flight, depCoords, arrCoords }) {
  const mapRef   = useRef(null);
  const leafRef  = useRef(null); // L instance
  const layersRef = useRef({});  // named layers
  const [mapReady, setMapReady] = useState(false);
  const [animPos, setAnimPos] = useState(0); // 0–1 along route

  // Load Leaflet CSS + JS once
  useEffect(() => {
    if (window.L) { setMapReady(true); return; }

    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => setMapReady(true);
    document.head.appendChild(script);
  }, []);

  // Init map once Leaflet is ready
  useEffect(() => {
    if (!mapReady || !mapRef.current || leafRef.current) return;
    const L = window.L;
    leafRef.current = L.map(mapRef.current, {
      center: [30, -40],
      zoom: 3,
      zoomControl: true,
      attributionControl: true,
    });
    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, subdomains: "abcd", maxZoom: 19 }).addTo(leafRef.current);
    layersRef.current = {};
  }, [mapReady]);

  // Animate plane position
  useEffect(() => {
    if (!flight?.dep_coords || !flight?.arr_coords) return;
    setAnimPos(0);
    const interval = setInterval(() => {
      setAnimPos(p => {
        if (p >= 1) { clearInterval(interval); return 1; }
        return Math.min(1, p + 0.008);
      });
    }, 40);
    return () => clearInterval(interval);
  }, [flight?.id]);

  // Draw/update route whenever flight changes
  useEffect(() => {
    if (!mapReady || !leafRef.current) return;
    const L = window.L;
    const map = leafRef.current;
    const layers = layersRef.current;

    // Clear previous layers
    Object.values(layers).forEach(l => { try { map.removeLayer(l); } catch (_) {} });
    layersRef.current = {};

    if (!flight) {
      // Default view: US map
      map.setView([38, -96], 4);
      return;
    }

    const dep = flight.dep_coords;
    const arr = flight.arr_coords;

    if (!dep || !arr) {
      map.setView([30, -40], 3);
      return;
    }

    // Great-circle arc
    const arc = gcArc(dep.lat, dep.lon, arr.lat, arr.lon);

    // Shadow arc (slightly thicker, dimmer)
    layers.arcShadow = L.polyline(arc, {
      color: "#f97316", weight: 4, opacity: 0.15, smoothFactor: 1,
    }).addTo(map);

    // Animated dashed arc
    layers.arc = L.polyline(arc, {
      color: "#f97316", weight: 2, opacity: 0.9,
      dashArray: "8 6", smoothFactor: 1,
    }).addTo(map);

    // Departure marker
    const depCat  = flight.dep_weather?.flight_cat || "UNKNOWN";
    const arrCat  = flight.arr_weather?.flight_cat || "UNKNOWN";

    layers.depMarker = L.marker([dep.lat, dep.lon], {
      icon: makeMarker(L, depCat, flight.departure, true),
    }).addTo(map);

    layers.arrMarker = L.marker([arr.lat, arr.lon], {
      icon: makeMarker(L, arrCat, flight.destination, false),
    }).addTo(map);

    // Popups
    const dw = flight.dep_weather;
    const aw = flight.arr_weather;

    layers.depMarker.bindPopup(`
      <div style="font-family:JetBrains Mono,monospace;font-size:12px;color:#e6edf3;background:#161b22;padding:4px 0;min-width:180px">
        <b style="font-size:14px;color:#f97316">${flight.departure}</b> <span style="font-size:10px;color:#8b949e">${dep.name}</span><br/>
        <span style="color:${CAT_COLOR[depCat]}">${depCat}</span> &nbsp;
        ${dw?.temp_c != null ? `${dw.temp_c}°C` : ""}
        ${dw?.wind_dir != null ? `· ${String(dw.wind_dir).padStart(3,"0")}°/${dw.wind_kt}kt` : ""}
        ${dw?.altim_inhg ? `<br/>${dw.altim_inhg.toFixed(2)} inHg` : ""}
        ${dw?.raw ? `<br/><span style="color:#58a6ff;font-size:10px;word-break:break-all">${dw.raw}</span>` : ""}
      </div>`, { className: s.popup }
    );

    layers.arrMarker.bindPopup(`
      <div style="font-family:JetBrains Mono,monospace;font-size:12px;color:#e6edf3;background:#161b22;padding:4px 0;min-width:180px">
        <b style="font-size:14px;color:#f97316">${flight.destination}</b> <span style="font-size:10px;color:#8b949e">${arr.name}</span><br/>
        <span style="color:${CAT_COLOR[arrCat]}">${arrCat}</span> &nbsp;
        ${aw?.temp_c != null ? `${aw.temp_c}°C` : ""}
        ${aw?.wind_dir != null ? `· ${String(aw.wind_dir).padStart(3,"0")}°/${aw.wind_kt}kt` : ""}
        ${aw?.altim_inhg ? `<br/>${aw.altim_inhg.toFixed(2)} inHg` : ""}
        ${aw?.raw ? `<br/><span style="color:#58a6ff;font-size:10px;word-break:break-all">${aw.raw}</span>` : ""}
      </div>`, { className: s.popup }
    );

    // Fit map to bounds with padding
    const bounds = L.latLngBounds([
      [dep.lat, dep.lon],
      [arr.lat, arr.lon],
    ]).pad(0.3);
    map.fitBounds(bounds);

  }, [mapReady, flight?.id]);

  // Animate plane marker
  useEffect(() => {
    if (!mapReady || !leafRef.current || !flight?.dep_coords || !flight?.arr_coords) return;
    const L = window.L;
    const map = leafRef.current;
    const layers = layersRef.current;
    const dep = flight.dep_coords;
    const arr = flight.arr_coords;

    const arc = gcArc(dep.lat, dep.lon, arr.lat, arr.lon);
    const idx = Math.min(Math.floor(animPos * (arc.length - 1)), arc.length - 2);
    const pos = arc[Math.floor(animPos * (arc.length - 1))];

    if (!pos) return;

    // Bearing for plane icon rotation — proper compass bearing toward the next point
    const next = arc[Math.min(idx + 1, arc.length - 1)];
    const bearing = bearingBetween(pos[0], pos[1], next[0], next[1]);

    if (layers.plane) { try { map.removeLayer(layers.plane); } catch (_) {} }
    layers.plane = L.marker(pos, {
      icon: makePlaneIcon(L, bearing),
      zIndexOffset: 1000,
    }).addTo(map);

  }, [animPos, mapReady]);

  return (
    <div className={s.mapWrapper}>
      <div ref={mapRef} className={s.map} />

      {/* Overlay info bar */}
      {flight && (
        <div className={s.overlay}>
          <div className={s.overlayRoute}>
            <span className={s.overlayIcao}>{flight.departure}</span>
            <span className={s.overlayArrow}>✈</span>
            <span className={s.overlayIcao}>{flight.destination}</span>
          </div>
          <div className={s.overlayStats}>
            {flight.route?.dist_nm && (
              <span className={s.overlayStat}>{flight.route.dist_nm} NM</span>
            )}
            {flight.route?.eet_min && (
              <span className={s.overlayStat}>
                EET {String(Math.floor(flight.route.eet_min / 60)).padStart(2,"0")}:{String(flight.route.eet_min % 60).padStart(2,"0")}
              </span>
            )}
            {flight.cruise_mach && (
              <span className={s.overlayStat}>M{flight.cruise_mach} · FL{Math.round(flight.cruise_alt_ft / 100)}</span>
            )}
            {flight.weights?.tow_lb && (
              <span className={s.overlayStat}>TOW {flight.weights.tow_lb.toLocaleString()} lb</span>
            )}
          </div>
          <div className={s.overlayWeather}>
            {flight.dep_weather?.flight_cat && (
              <span className={s.weatherChip} style={{ color: CAT_COLOR[flight.dep_weather.flight_cat], borderColor: CAT_COLOR[flight.dep_weather.flight_cat] + "44" }}>
                {flight.departure} {flight.dep_weather.flight_cat}
                {flight.dep_weather.wind_kt != null ? ` · ${flight.dep_weather.wind_kt}kt` : ""}
              </span>
            )}
            {flight.arr_weather?.flight_cat && (
              <span className={s.weatherChip} style={{ color: CAT_COLOR[flight.arr_weather.flight_cat], borderColor: CAT_COLOR[flight.arr_weather.flight_cat] + "44" }}>
                {flight.destination} {flight.arr_weather.flight_cat}
                {flight.arr_weather.wind_kt != null ? ` · ${flight.arr_weather.wind_kt}kt` : ""}
              </span>
            )}
          </div>
        </div>
      )}

      {!flight && (
        <div className={s.emptyOverlay}>
          <div className={s.emptyIcon}>🗺</div>
          <p>Enter departure and destination<br/>to visualize the route</p>
        </div>
      )}
    </div>
  );
}