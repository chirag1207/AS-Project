const BASE = "/api";

function getToken() {
  return localStorage.getItem("apg_token");
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Error ${res.status}`);
  return data;
}

export const api = {
  login:         (email, password) => apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me:            ()                => apiFetch("/auth/me"),
  aircraftList:  ()                => apiFetch("/aircraft"),
  aircraft:      (type)            => apiFetch(`/aircraft/${type}`),
  thrustCurve:   (type, alt)       => apiFetch(`/performance/thrust/${type}?alt_ft=${alt}`),
  fuelCurve:     (type, alt, mach) => apiFetch(`/performance/fuel/${type}?cruise_alt_ft=${alt}&cruise_mach=${mach}`),
  createFlight:  (data)            => apiFetch("/flights", { method: "POST", body: JSON.stringify(data) }),
  listFlights:   ()                => apiFetch("/flights"),
  getFlight:     (id)              => apiFetch(`/flights/${id}`),
  runwayAnalysis:(icao, acType, massLb, rwyHdg) =>
    apiFetch(`/runway/${icao}?ac_type=${acType}&mass_lb=${massLb}&rwy_hdg=${rwyHdg}`),
  weightBalance: (data)            => apiFetch("/wb", { method: "POST", body: JSON.stringify(data) }),
  airport:       (icao)            => apiFetch(`/airports/${icao}`),
  airportSearch: (q)               => apiFetch(`/airports?q=${q}`),
};
