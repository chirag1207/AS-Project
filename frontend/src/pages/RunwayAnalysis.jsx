import { useState, useEffect } from "react";
import { api } from "../utils/api";
import {
  Card, Button, Input, Select, ErrorBox, StatRow,
  SectionHeader, Badge, FlightCatBadge, Spinner, StatusDot,
} from "../components/UI";
import s from "./RunwayAnalysis.module.css";

const RWY_DIRECTIONS = Array.from({ length: 36 }, (_, i) => {
  const hdg = (i + 1) * 10;
  const rwy = String(Math.round(hdg / 10)).padStart(2, "0");
  return { value: hdg, label: `RWY ${rwy} (${hdg}°)` };
});

export default function RunwayAnalysis() {
  const [aircraft, setAircraft] = useState([]);
  const [form, setForm] = useState({
    icao: "", ac_type: "A320", mass_lb: 140000, rwy_hdg: 180,
  });
  const [result, setResult] = useState(null);
  const [busy,   setBusy]   = useState(false);
  const [err,    setErr]    = useState("");

  useEffect(() => { api.aircraftList().then(setAircraft); }, []);

  function field(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleAnalyze(e) {
    e.preventDefault();
    setBusy(true); setErr(""); setResult(null);
    try {
      const r = await api.runwayAnalysis(form.icao, form.ac_type, form.mass_lb, form.rwy_hdg);
      setResult(r);
    } catch(e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  const perf = result?.performance;
  const wx   = result?.weather;

  function withinMTOW() {
    if (!perf) return null;
    return form.mass_lb <= perf.mtow_lb;
  }

  return (
    <div className={s.root}>
      <div className={s.left}>
        <Card>
          <div className={s.cardTitle}>RUNWAY ANALYSIS</div>

          <form onSubmit={handleAnalyze} className={s.form}>
            <Input label="Airport ICAO" placeholder="KDFW" value={form.icao}
              onChange={e => field("icao", e.target.value.toUpperCase())}
              maxLength={4} required />

            <Select label="Aircraft Type" value={form.ac_type}
              onChange={e => field("ac_type", e.target.value)}>
              {aircraft.map(a => (
                <option key={a.code} value={a.code}>{a.code} — {a.name}</option>
              ))}
            </Select>

            <Input label="Aircraft Mass (lb)" type="number" value={form.mass_lb}
              onChange={e => field("mass_lb", parseFloat(e.target.value))}
              step={500} min={1000} />

            <Select label="Runway Heading" value={form.rwy_hdg}
              onChange={e => field("rwy_hdg", parseFloat(e.target.value))}>
              {RWY_DIRECTIONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </Select>

            <ErrorBox message={err} />
            <Button type="submit" loading={busy} style={{ width: "100%", marginTop: 4 }}>
              Analyze Runway
            </Button>
          </form>
        </Card>

        {/* Quick reference table */}
        <Card>
          <SectionHeader title="Interpretation Guide" />
          <div className={s.guide}>
            <div className={s.guideRow}><span className={s.term}>Density Altitude</span><span className={s.def}>Performance altitude considering temp & pressure. Higher = worse performance.</span></div>
            <div className={s.guideRow}><span className={s.term}>σ (Density Ratio)</span><span className={s.def}>Air density vs ISA sea level. Affects thrust and lift directly.</span></div>
            <div className={s.guideRow}><span className={s.term}>V2</span><span className={s.def}>Takeoff safety speed (1.2 × Vs). Minimum airspeed after engine failure.</span></div>
            <div className={s.guideRow}><span className={s.term}>ISA Dev</span><span className={s.def}>Temperature deviation from standard atmosphere. +ISA = hotter = longer TOD.</span></div>
          </div>
        </Card>
      </div>

      <div className={s.right}>
        {busy && (
          <div className={s.loadingState}><Spinner size={32} /><p>Fetching METAR and computing performance…</p></div>
        )}

        {!result && !busy && (
          <div className={s.emptyState}>
            <div className={s.emptyIcon}>⬜</div>
            <p>Enter an airport ICAO code and aircraft mass<br/>to compute runway performance.</p>
            <p className={s.emptyHint}>Live weather is fetched from aviationweather.gov<br/>Aerodynamic computations via OpenAP</p>
          </div>
        )}

        {result && !busy && (
          <div className={s.results}>
            {/* Header */}
            <Card className={s.headerCard}>
              <div className={s.headerRow}>
                <div>
                  <div className={s.airportName}>{result.station?.name}</div>
                  <div className={s.airportIcao}>{result.icao}</div>
                </div>
                <div className={s.headerBadges}>
                  <FlightCatBadge cat={result.flight_category} />
                  <Badge color={withinMTOW() ? "green" : "red"}>
                    <StatusDot ok={withinMTOW()} />
                    {withinMTOW() ? "Within MTOW" : "EXCEEDS MTOW"}
                  </Badge>
                </div>
              </div>
              {wx?.raw && (
                <div className={s.metarRaw}>
                  <span className={s.metarLabel}>METAR</span>
                  <code>{wx.raw}</code>
                </div>
              )}
            </Card>

            <div className={s.grid2}>
              {/* Departure conditions */}
              <Card>
                <SectionHeader title={`Departure — ${result.icao}`} sub={`Runway ${String(Math.round(form.rwy_hdg/10)).padStart(2,"0")} (${form.rwy_hdg}°)`} />
                <StatRow label="Temperature"    value={wx?.temp_c != null ? `${wx.temp_c}°C` : "—"} />
                <StatRow label="ISA Deviation"  value={perf?.temp_deviation_isa != null ? `${perf.temp_deviation_isa > 0 ? "+" : ""}${perf.temp_deviation_isa}°C` : "—"}
                  highlight={Math.abs(perf?.temp_deviation_isa || 0) > 15} />
                <StatRow label="Altimeter"      value={wx?.altim_inhg ? `${wx.altim_inhg.toFixed(2)} inHg` : "—"} />
                <StatRow label="Elevation"      value={`${result.station?.elevation_ft?.toLocaleString()} ft`} />
                <StatRow label="Pressure Alt"   value={`${perf?.pressure_alt_ft?.toLocaleString()} ft`} />
                <StatRow label="Density Alt"    value={`${perf?.density_alt_ft?.toLocaleString()} ft`} highlight />
                <StatRow label="Density Ratio σ" value={perf?.density_ratio?.toFixed(4)} />
                <StatRow label="Wind"           value={wx?.wind_dir != null ? `${String(wx.wind_dir).padStart(3,"0")}° @ ${wx.wind_kt}kt` : "Calm"} />
                <StatRow label="Headwind"       value={perf?.headwind_kt != null ? `${perf.headwind_kt > 0 ? "HW" : "TW"} ${Math.abs(perf.headwind_kt)} kt` : "—"}
                  highlight={perf?.headwind_kt < 0} />
                <StatRow label="Crosswind"      value={perf?.crosswind_kt != null ? `${perf.crosswind_kt} kt` : "—"} />
                {wx?.wx && <StatRow label="Wx" value={wx.wx} />}
              </Card>

              {/* Performance output */}
              <Card>
                <SectionHeader title="Takeoff Performance" sub="OpenAP computed" />
                <StatRow label="Plan TO Wt"    value={`${parseInt(form.mass_lb).toLocaleString()} lb`} highlight />
                <StatRow label="MTOW Limit"    value={`${perf?.mtow_lb?.toLocaleString()} lb`} />
                <StatRow label="Wt vs MTOW"    value={`${perf?.weight_vs_mtow_pct}%`}
                  highlight={perf?.weight_vs_mtow_pct > 100} />
                <StatRow label="V2 Speed"      value={`${perf?.v2_kt} kt`} />
                <StatRow label="TO Thrust"     value={`${perf?.takeoff_thrust_lb?.toLocaleString()} lb`} />
                <StatRow label="Est. TOD"      value={`${perf?.tod_estimated_ft?.toLocaleString()} ft`} />

                <div className={s.divider} />
                <SectionHeader title="Landing" sub="MLW limit" />
                <StatRow label="MLW Limit"     value={`${perf?.mlw_lb?.toLocaleString()} lb`} />

                <div className={s.disclaimer}>
                  ⚠ Performance values are estimates computed from OpenAP aerodynamic models.
                  Always use AFM-certified data for actual operations.
                </div>
              </Card>
            </div>

            {/* Wind components visual */}
            {wx && (
              <Card>
                <SectionHeader title="Wind Component Analysis" sub={`RWY ${String(Math.round(form.rwy_hdg/10)).padStart(2,"0")}`} />
                <WindRose wind_kt={wx.wind_kt || 0} wind_dir={wx.wind_dir || 0} rwy_hdg={form.rwy_hdg} hw={perf?.headwind_kt || 0} xw={perf?.crosswind_kt || 0} />
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function WindRose({ wind_kt, wind_dir, rwy_hdg, hw, xw }) {
  const SIZE = 200;
  const CX = SIZE / 2, CY = SIZE / 2, R = 80;

  // Runway direction line
  const rwyRad = (rwy_hdg - 90) * Math.PI / 180;
  const rx1 = CX + R * Math.cos(rwyRad + Math.PI);
  const ry1 = CY + R * Math.sin(rwyRad + Math.PI);
  const rx2 = CX + R * Math.cos(rwyRad);
  const ry2 = CY + R * Math.sin(rwyRad);

  // Wind arrow
  const wRad = (wind_dir - 90) * Math.PI / 180;
  const len  = Math.min(R * 0.9, (wind_kt / 30) * R * 0.9);
  const wx2  = CX + len * Math.cos(wRad + Math.PI);
  const wy2  = CY + len * Math.sin(wRad + Math.PI);

  return (
    <div className={s.windRose}>
      <svg width={SIZE} height={SIZE}>
        <circle cx={CX} cy={CY} r={R}   fill="none" stroke="var(--border2)" strokeWidth="1"/>
        <circle cx={CX} cy={CY} r={R/2} fill="none" stroke="var(--border)"  strokeWidth="1" strokeDasharray="3,3"/>
        {["N","E","S","W"].map((d, i) => {
          const a = (i * 90 - 90) * Math.PI / 180;
          return <text key={d} x={CX + (R+12)*Math.cos(a)} y={CY + (R+12)*Math.sin(a)}
            textAnchor="middle" dominantBaseline="middle" fill="var(--text-dim)" fontSize="10">{d}</text>;
        })}
        {/* Runway */}
        <line x1={rx1} y1={ry1} x2={rx2} y2={ry2} stroke="var(--accent)" strokeWidth="3" strokeLinecap="round"/>
        {/* Wind */}
        {wind_kt > 0 && (
          <>
            <line x1={CX} y1={CY} x2={wx2} y2={wy2} stroke="var(--blue)" strokeWidth="2" strokeLinecap="round"/>
            <circle cx={wx2} cy={wy2} r={4} fill="var(--blue)"/>
          </>
        )}
        <circle cx={CX} cy={CY} r={4} fill="var(--text-muted)"/>
      </svg>
      <div className={s.windStats}>
        <div className={s.windStat}>
          <span className={s.wsLabel}>Wind</span>
          <span className={s.wsVal}>{wind_dir != null ? `${String(wind_dir).padStart(3,"0")}° / ${wind_kt}kt` : "Calm"}</span>
        </div>
        <div className={s.windStat}>
          <span className={s.wsLabel}>Headwind</span>
          <span className={s.wsVal} style={{ color: hw >= 0 ? "var(--green)" : "var(--red)" }}>
            {hw >= 0 ? "▲" : "▼"} {Math.abs(hw)} kt
          </span>
        </div>
        <div className={s.windStat}>
          <span className={s.wsLabel}>Crosswind</span>
          <span className={s.wsVal}>{xw} kt</span>
        </div>
      </div>
    </div>
  );
}
