import { useState, useEffect } from "react";
import { api } from "../utils/api";
import {
  Card, Button, Input, Select, ErrorBox, StatRow,
  SectionHeader, Badge, FlightCatBadge, Spinner,
} from "../components/UI";
import FlightMap from "../components/FlightMap";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import s from "./FlightPlanning.module.css";

const FMT_TIME = (min) => {
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
};

export default function FlightPlanning() {
  const [aircraft,   setAircraft]   = useState([]);
  const [flights,    setFlights]    = useState([]);
  const [selected,   setSelected]   = useState(null);
  const [activeTab,  setActiveTab]  = useState("map"); // "map" | "analysis"
  const [form, setForm] = useState({
    aircraft_type: "A320", departure: "", destination: "",
    flight_number: "", cruise_alt_ft: 35000, cruise_mach: 0.78,
    flight_rules: "IFR", flight_type: "G",
    pax: 0, crew: 2, cargo_lb: 0,
  });
  const [busy,      setBusy]      = useState(false);
  const [err,       setErr]       = useState("");
  const [fuelChart, setFuelChart] = useState(null);
  const [chartBusy, setChartBusy] = useState(false);

  useEffect(() => {
    api.aircraftList().then(setAircraft).catch(console.error);
    api.listFlights().then(setFlights).catch(console.error);
  }, []);

  function field(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleAircraftChange(type) {
    field("aircraft_type", type);
    setChartBusy(true);
    try {
      const data = await api.fuelCurve(type, form.cruise_alt_ft, form.cruise_mach);
      setFuelChart(data);
    } catch (_) {}
    setChartBusy(false);
  }

  useEffect(() => { handleAircraftChange(form.aircraft_type); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const fl = await api.createFlight({
        ...form,
        cruise_alt_ft: parseInt(form.cruise_alt_ft),
        cruise_mach:   parseFloat(form.cruise_mach),
        pax:           parseInt(form.pax),
        crew:          parseInt(form.crew),
        cargo_lb:      parseFloat(form.cargo_lb),
      });
      setFlights(prev => [fl, ...prev]);
      setSelected(fl);
      setActiveTab("map");
    } catch(e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  const acMap = Object.fromEntries(aircraft.map(a => [a.code, a]));

  return (
    <div className={s.root}>
      {/* ── LEFT PANEL: form + history ── */}
      <div className={s.left}>
        <Card className={s.formCard}>
          <div className={s.formHeader}>
            <span className={s.formTitle}>NEW FLIGHT</span>
            <Badge color="blue">{form.flight_rules}</Badge>
          </div>

          <form onSubmit={handleCreate} className={s.form}>
            <div className={s.row2}>
              <Select label="Aircraft" value={form.aircraft_type}
                onChange={e => handleAircraftChange(e.target.value)}>
                {aircraft.map(a => (
                  <option key={a.code} value={a.code}>{a.code} — {a.name}</option>
                ))}
              </Select>
              <Input label="Flight No" placeholder="(Optional)" value={form.flight_number}
                onChange={e => field("flight_number", e.target.value)} />
            </div>

            <div className={s.row2}>
              <Input label="Departure (ADEP)" placeholder="KDFW" value={form.departure}
                onChange={e => field("departure", e.target.value.toUpperCase())}
                maxLength={4} required />
              <Input label="Destination (ADES)" placeholder="KLAX" value={form.destination}
                onChange={e => field("destination", e.target.value.toUpperCase())}
                maxLength={4} required />
            </div>

            <div className={s.row3}>
              <Input label="Cruise Alt (ft)" type="number" value={form.cruise_alt_ft}
                onChange={e => field("cruise_alt_ft", e.target.value)} step={1000} />
              <Input label="Cruise Mach" type="number" value={form.cruise_mach}
                onChange={e => field("cruise_mach", e.target.value)} step={0.01} min={0.4} max={0.99} />
              <Select label="Rules" value={form.flight_rules}
                onChange={e => field("flight_rules", e.target.value)}>
                <option value="IFR">IFR</option>
                <option value="VFR">VFR</option>
              </Select>
            </div>

            <div className={s.row3}>
              <Input label="Crew" type="number" value={form.crew} min={1} max={10}
                onChange={e => field("crew", e.target.value)} />
              <Input label="Pax" type="number" value={form.pax} min={0}
                onChange={e => field("pax", e.target.value)} />
              <Input label="Cargo lb" type="number" value={form.cargo_lb} min={0}
                onChange={e => field("cargo_lb", e.target.value)} />
            </div>

            <ErrorBox message={err} />
            <Button type="submit" loading={busy} style={{ width:"100%", marginTop: 4 }}>
              ✈ Compute Flight Plan
            </Button>
          </form>
        </Card>

        {/* Flight history */}
        {flights.length > 0 && (
          <Card className={s.histCard}>
            <SectionHeader title="Saved Flights" />
            <div className={s.flightList}>
              {flights.map(f => (
                <button key={f.id}
                  className={`${s.flightItem} ${selected?.id === f.id ? s.flightActive : ""}`}
                  onClick={() => { setSelected(f); setActiveTab("map"); }}>
                  <div className={s.flightRoute}>
                    <span className={s.flightCode}>{f.departure}</span>
                    <span className={s.arrow}>→</span>
                    <span className={s.flightCode}>{f.destination}</span>
                  </div>
                  <div className={s.flightMeta}>
                    <span className="mono">{f.aircraft_type}</span>
                    <span>{FMT_TIME(f.route?.eet_min || 0)}</span>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* ── RIGHT PANEL: map + analysis tabs ── */}
      <div className={s.right}>
        {/* Tab bar */}
        <div className={s.tabBar}>
          <button className={`${s.tab} ${activeTab === "map" ? s.tabActive : ""}`}
            onClick={() => setActiveTab("map")}>
            🗺 Map
          </button>
          <button className={`${s.tab} ${activeTab === "analysis" ? s.tabActive : ""}`}
            onClick={() => setActiveTab("analysis")}>
            📊 Analysis
          </button>
          {selected && (
            <div className={s.tabFlight}>
              <span className={s.tabFlightCode}>{selected.departure} → {selected.destination}</span>
              <span className={s.tabFlightMeta}>{selected.aircraft_type} · {FMT_TIME(selected.route?.eet_min || 0)}</span>
            </div>
          )}
        </div>

        {/* Map view */}
        {activeTab === "map" && (
          <div className={s.mapPanel}>
            <FlightMap flight={selected} />
          </div>
        )}

        {/* Analysis view */}
        {activeTab === "analysis" && (
          <div className={s.analysisPanel}>
            {selected ? (
              <FlightAnalysis flight={selected} acMap={acMap} fuelChart={fuelChart} chartBusy={chartBusy} />
            ) : (
              <FlightChartOnly acMap={acMap} fuelChart={fuelChart} chartBusy={chartBusy} acType={form.aircraft_type} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Full analysis after a flight is computed ──────────────────────────────────
function FlightAnalysis({ flight: f, fuelChart, chartBusy }) {
  const w    = f.weights;
  const fuel = f.fuel;
  const dw   = f.dep_weather;
  const aw   = f.arr_weather;

  return (
    <div className={s.analysis}>
      {/* Route summary */}
      <Card className={s.summaryCard}>
        <div className={s.summaryRoute}>
          <div className={s.summaryAirport}>
            <div className={s.icao}>{f.departure}</div>
            {dw && <FlightCatBadge cat={dw.flight_cat} />}
          </div>
          <div className={s.summaryArrow}>
            <div className={s.arrowLine}/>
            <span>✈</span>
            <div className={s.arrowLine}/>
          </div>
          <div className={s.summaryAirport}>
            <div className={s.icao}>{f.destination}</div>
            {aw && <FlightCatBadge cat={aw.flight_cat} />}
          </div>
        </div>
        <div className={s.summaryMeta}>
          <div className={s.metaChip}><span className="mono">{f.aircraft_type}</span> {f.aircraft_name}</div>
          <div className={s.metaChip}>EET <strong>{FMT_TIME(f.route?.eet_min || 0)}</strong></div>
          <div className={s.metaChip}>{f.route?.dist_nm} NM</div>
          <div className={s.metaChip}><Badge color="blue">{f.flight_rules}</Badge></div>
          <div className={s.metaChip}>FL{Math.round(f.cruise_alt_ft / 100)} · M{f.cruise_mach}</div>
        </div>
      </Card>

      <div className={s.grid3}>
        <Card>
          <SectionHeader title="Weight Summary" />
          <StatRow label="Zero Fuel Wt"  value={`${w.zfw_lb?.toLocaleString()} lb`} highlight />
          <StatRow label="Take-off Wt"   value={`${w.tow_lb?.toLocaleString()} lb`} highlight />
          <StatRow label="Landing Wt"    value={`${w.lw_lb?.toLocaleString()} lb`} />
          <StatRow label="OEW"           value={`${w.oew_lb?.toLocaleString()} lb`} />
          <StatRow label="Payload"       value={`${w.payload_lb?.toLocaleString()} lb`} />
          <StatRow label="Crew / Pax"    value={`${f.crew} / ${f.pax}`} />
        </Card>

        <Card>
          <SectionHeader title="Fuel Summary" />
          <StatRow label="Ramp Fuel"     value={`${w.fuel_total_lb?.toLocaleString()} lb`} highlight />
          <StatRow label="Trip Fuel"     value={`${w.fuel_trip_lb?.toLocaleString()} lb`} />
          <StatRow label="Reserve Fuel"  value={`${fuel?.reserve_fuel_lb?.toLocaleString()} lb`} />
          <StatRow label="Cruise FF"     value={`${fuel?.cruise_ff_lb_hr?.toLocaleString()} lb/hr`} />
          <StatRow label="TAS"           value={`${fuel?.tas_kt} kt`} />
          <StatRow label="CO₂ (cruise)"  value={`${fuel?.co2_cruise_kg?.toLocaleString()} kg`} />
        </Card>

        <Card>
          <SectionHeader title="Route" />
          <StatRow label="Distance"      value={`${f.route?.dist_nm} NM`} />
          <StatRow label="EET"           value={FMT_TIME(f.route?.eet_min || 0)} mono />
          <StatRow label="Cruise Alt"    value={`FL${Math.round(f.cruise_alt_ft/100)}`} />
          <StatRow label="Mach"          value={`M${f.cruise_mach}`} />
          <StatRow label="Climb"         value={`${fuel?.climb_min} min`} />
          <StatRow label="Cruise"        value={`${fuel?.cruise_min} min`} />
        </Card>
      </div>

      {/* Fuel burn chart */}
      {fuelChart?.fuel_curve?.length > 0 && (
        <Card>
          <SectionHeader title={`Fuel Flow — ${f.aircraft_type}`}
            sub={`FL${Math.round(f.cruise_alt_ft/100)} · M${f.cruise_mach}`} />
          <FuelChart data={fuelChart.fuel_curve} tripNm={f.route?.dist_nm} />
        </Card>
      )}

      {/* Weather */}
      <div className={s.grid2}>
        {dw && <WeatherCard label={`Departure — ${f.departure}`} w={dw} />}
        {aw && <WeatherCard label={`Arrival — ${f.destination}`}  w={aw} />}
      </div>
    </div>
  );
}

// ── Pre-flight chart (no flight selected yet) ────────────────────────────────
function FlightChartOnly({ acMap, fuelChart, chartBusy, acType }) {
  const ac = acMap[acType];
  return (
    <div className={s.analysis}>
      <Card>
        <SectionHeader title={`Fuel Flow — ${acType}`} />
        {chartBusy
          ? <div className={s.chartLoading}><Spinner /></div>
          : <FuelChart data={fuelChart?.fuel_curve || []} />}
      </Card>
      {ac && (
        <Card>
          <SectionHeader title="Aircraft Limits" sub={ac.name} />
          {[
            ["MTOW",        `${ac.mtow_lb?.toLocaleString()} lb`],
            ["MLW",         `${ac.mlw_lb?.toLocaleString()} lb`],
            ["OEW",         `${ac.oew_lb?.toLocaleString()} lb`],
            ["Max Fuel",    `${ac.mfc_lb?.toLocaleString()} lb`],
            ["Ceiling",     `FL${Math.round((ac.ceiling_ft||0)/100)}`],
            ["Range",       `${ac.range_nm?.toLocaleString()} NM`],
            ["Cruise Mach", `M${ac.cruise_mach}`],
            ["Engine",      ac.engine],
          ].map(([k,v]) => <StatRow key={k} label={k} value={v} />)}
        </Card>
      )}
    </div>
  );
}

function FuelChart({ data, tripNm }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data.slice(0, 40)} margin={{ top: 8, right: 20, left: 0, bottom: 18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="dist_nm" stroke="var(--text-dim)" tick={{ fontSize: 11 }}
          label={{ value: "Distance (NM)", position: "insideBottom", offset: -10, fill: "var(--text-muted)", fontSize: 11 }} />
        <YAxis stroke="var(--text-dim)" tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={{ background:"var(--surface2)", border:"1px solid var(--border2)", borderRadius:6, fontSize:12 }}
          labelFormatter={v => `${v} NM`} />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        <Line type="monotone" dataKey="ff_lb_hr" name="Fuel Flow (lb/hr)"
          stroke="var(--accent)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="co2_g_min" name="CO₂ (g/min)"
          stroke="var(--blue)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function WeatherCard({ label, w }) {
  return (
    <Card>
      <SectionHeader title={label} />
      <div style={{ display:"flex", gap:8, marginBottom:10 }}>
        <FlightCatBadge cat={w.flight_cat} />
        {w.wx && <Badge color="yellow">{w.wx}</Badge>}
      </div>
      <StatRow label="Wind"
        value={w.wind_dir != null ? `${String(w.wind_dir).padStart(3,"0")}° @ ${w.wind_kt}kt${w.gust_kt ? ` G${w.gust_kt}kt` : ""}` : "Calm"} />
      <StatRow label="Visibility"  value={w.vis_sm  != null ? `${w.vis_sm} SM` : "—"} />
      <StatRow label="Altimeter"   value={w.altim_inhg ? `${w.altim_inhg.toFixed(2)} inHg` : "—"} />
      <StatRow label="Temp / Dew"  value={w.temp_c  != null ? `${w.temp_c}°C / ${w.dewpoint_c}°C` : "—"} />
      {w.clouds?.length > 0 && (
        <StatRow label="Clouds" value={w.clouds.map(c => `${c.cover}@${c.base}ft`).join(" ")} />
      )}
      {w.raw && (
        <div style={{ marginTop:10, background:"var(--bg)", borderRadius:5, padding:"8px 10px" }}>
          <code style={{ fontSize:10, color:"var(--blue)", fontFamily:"JetBrains Mono", wordBreak:"break-all" }}>{w.raw}</code>
        </div>
      )}
    </Card>
  );
}
