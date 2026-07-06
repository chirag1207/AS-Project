import { useState, useEffect } from "react";
import { api } from "../utils/api";
import {
  Card, Button, Input, Select, ErrorBox, StatRow,
  SectionHeader, Badge, Spinner, StatusDot,
} from "../components/UI";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea,
} from "recharts";
import s from "./WeightBalance.module.css";

export default function WeightBalance() {
  const [aircraft, setAircraft] = useState([]);
  const [form, setForm] = useState({
    aircraft_type: "A320", crew: 2, pax: 150, cargo_lb: 5000, fuel_lb: 20000,
    crew_station_mac: 0.25, pax_station_mac: 0.30, cargo_station_mac: 0.45,
  });
  const [result, setResult] = useState(null);
  const [busy,   setBusy]   = useState(false);
  const [err,    setErr]    = useState("");

  useEffect(() => { api.aircraftList().then(setAircraft); }, []);

  function field(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleCompute(e) {
    e.preventDefault();
    setBusy(true); setErr(""); setResult(null);
    try {
      const r = await api.weightBalance({
        ...form,
        crew: parseInt(form.crew),
        pax:  parseInt(form.pax),
        cargo_lb: parseFloat(form.cargo_lb),
        fuel_lb:  parseFloat(form.fuel_lb),
        crew_station_mac:  parseFloat(form.crew_station_mac),
        pax_station_mac:   parseFloat(form.pax_station_mac),
        cargo_station_mac: parseFloat(form.cargo_station_mac),
      });
      setResult(r);
    } catch(e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  const w  = result?.weights;
  const cg = result?.cg;
  const lim = result?.limits;

  // Build envelope chart data
  const envelopeData = result?.envelope_points || [];
  const fwdEnvelope  = cg ? [
    { x: cg.fwd_limit_mac, y: 0 },
    { x: cg.fwd_limit_mac, y: (w?.mtow_lb || 200000) * 1.05 },
  ] : [];
  const aftEnvelope = cg ? [
    { x: cg.aft_limit_mac, y: 0 },
    { x: cg.aft_limit_mac, y: (w?.mtow_lb || 200000) * 1.05 },
  ] : [];

  function cgColor(status) {
    return status === "NORMAL" ? "green" : "red";
  }

  return (
    <div className={s.root}>
      <div className={s.left}>
        <Card>
          <div className={s.cardTitle}>WEIGHT & BALANCE</div>
          <form onSubmit={handleCompute} className={s.form}>
            <Select label="Aircraft" value={form.aircraft_type}
              onChange={e => field("aircraft_type", e.target.value)}>
              {aircraft.map(a => (
                <option key={a.code} value={a.code}>{a.code} — {a.name}</option>
              ))}
            </Select>

            <div className={s.row3}>
              <Input label="Crew"     type="number" value={form.crew}     min={1} max={10}
                onChange={e => field("crew", e.target.value)} />
              <Input label="PAX"      type="number" value={form.pax}      min={0}
                onChange={e => field("pax", e.target.value)} />
              <Input label="Cargo lb" type="number" value={form.cargo_lb} min={0}
                onChange={e => field("cargo_lb", e.target.value)} />
            </div>

            <Input label="Fuel On Board (lb)" type="number" value={form.fuel_lb} min={0}
              onChange={e => field("fuel_lb", e.target.value)} />

            <div className={s.stationSection}>
              <div className={s.stationTitle}>CG Stations (fraction of MAC)</div>
              <div className={s.row3}>
                <Input label="Crew Sta" type="number" value={form.crew_station_mac} step={0.01} min={0} max={1}
                  onChange={e => field("crew_station_mac", e.target.value)} />
                <Input label="Pax Sta"  type="number" value={form.pax_station_mac}  step={0.01} min={0} max={1}
                  onChange={e => field("pax_station_mac", e.target.value)} />
                <Input label="Cargo Sta" type="number" value={form.cargo_station_mac} step={0.01} min={0} max={1}
                  onChange={e => field("cargo_station_mac", e.target.value)} />
              </div>
            </div>

            <ErrorBox message={err} />
            <Button type="submit" loading={busy} style={{ width: "100%", marginTop: 4 }}>
              ⚖ Compute W&B
            </Button>
          </form>
        </Card>

        {/* CG Status */}
        {result && (
          <Card>
            <SectionHeader title="CG Status" />
            {[
              { label: "ZFW CG", val: `${cg.zfw_pct_mac}% MAC`, status: cg.zfw_status },
              { label: "TOW CG", val: `${cg.tow_pct_mac}% MAC`, status: cg.tow_status },
              { label: "LW CG",  val: `${cg.lw_pct_mac}% MAC`,  status: cg.lw_status  },
            ].map(({ label, val, status }) => (
              <div key={label} className={s.cgRow}>
                <span className={s.cgLabel}>{label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={s.cgVal}>{val}</span>
                  <Badge color={cgColor(status)}>{status === "NORMAL" ? "✓ OK" : "✗ " + status}</Badge>
                </div>
              </div>
            ))}
            <div className={s.limitRow}>
              <span className={s.cgLabel}>Envelope</span>
              <span className={s.cgVal}>{cg.fwd_limit_mac}% – {cg.aft_limit_mac}% MAC</span>
            </div>
          </Card>
        )}
      </div>

      <div className={s.right}>
        {busy && (
          <div className={s.loadingState}><Spinner size={32} /></div>
        )}

        {!result && !busy && (
          <div className={s.emptyState}>
            <div className={s.emptyIcon}>⚖</div>
            <p>Enter aircraft loading to compute<br/>weight & balance solution.</p>
            <p className={s.emptyHint}>CG computed from OpenAP MAC and fuselage data<br/>Generic transport category envelope applied</p>
          </div>
        )}

        {result && !busy && (
          <div className={s.results}>
            {/* Header */}
            <Card className={s.headerCard}>
              <div className={s.headerRow}>
                <div>
                  <div className={s.acName}>{result.aircraft_name}</div>
                  <div className={s.acCode}>{result.aircraft_type}</div>
                </div>
                <div className={s.headerBadges}>
                  <Badge color={lim?.tow_within_mtow ? "green" : "red"}>
                    <StatusDot ok={lim?.tow_within_mtow} />
                    TOW {lim?.tow_vs_mtow_pct}% of MTOW
                  </Badge>
                  <Badge color={lim?.lw_within_mlw ? "green" : "red"}>
                    <StatusDot ok={lim?.lw_within_mlw} />
                    LW {lim?.lw_vs_mlw_pct}% of MLW
                  </Badge>
                </div>
              </div>
            </Card>

            {/* Weight breakdown + CG chart */}
            <div className={s.grid2}>
              <div className={s.weightCol}>
                <Card>
                  <SectionHeader title="Weight Breakdown" />
                  <StatRow label="OEW"          value={`${w.oew_lb?.toLocaleString()} lb`} />
                  <StatRow label="Crew"         value={`${w.crew_lb?.toLocaleString()} lb`} />
                  <StatRow label="Pax"          value={`${w.pax_lb?.toLocaleString()} lb`} />
                  <StatRow label="Cargo"        value={`${w.cargo_lb?.toLocaleString()} lb`} />
                  <div style={{ borderTop: "2px solid var(--border2)", margin: "6px 0" }}/>
                  <StatRow label="Zero Fuel Wt" value={`${w.zfw_lb?.toLocaleString()} lb`} highlight />
                  <StatRow label="Fuel"         value={`${w.fuel_lb?.toLocaleString()} lb`} />
                  <div style={{ borderTop: "2px solid var(--border2)", margin: "6px 0" }}/>
                  <StatRow label="Take-off Wt"  value={`${w.tow_lb?.toLocaleString()} lb`} highlight />
                  <StatRow label="MTOW Limit"   value={`${w.mtow_lb?.toLocaleString()} lb`} />
                  <StatRow label="Landing Wt"   value={`${w.lw_lb?.toLocaleString()} lb`} />
                  <StatRow label="MLW Limit"    value={`${w.mlw_lb?.toLocaleString()} lb`} />
                </Card>

                <Card style={{ marginTop: 14 }}>
                  <SectionHeader title="CG Summary" />
                  <StatRow label="MAC"          value={`${result.mac_m} m`} />
                  <StatRow label="LEMAC"        value={`${result.lemac_m} m from datum`} />
                  <StatRow label="ZFW CG"       value={`${cg.zfw_pct_mac}% MAC`} highlight />
                  <StatRow label="TOW CG"       value={`${cg.tow_pct_mac}% MAC`} highlight />
                  <StatRow label="LW CG"        value={`${cg.lw_pct_mac}% MAC`} />
                  <StatRow label="Fwd Limit"    value={`${cg.fwd_limit_mac}% MAC`} />
                  <StatRow label="Aft Limit"    value={`${cg.aft_limit_mac}% MAC`} />
                </Card>
              </div>

              {/* CG Envelope chart */}
              <Card>
                <SectionHeader title="CG Envelope" sub="Weight vs CG (%MAC)" />
                <div className={s.chartWrap}>
                  <ResponsiveContainer width="100%" height={380}>
                    <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        type="number" dataKey="cg_mac" name="CG %MAC"
                        domain={[cg.fwd_limit_mac - 8, cg.aft_limit_mac + 8]}
                        stroke="var(--text-dim)" tick={{ fontSize: 11 }}
                        label={{ value: "CG (%MAC)", position: "insideBottom", offset: -10, fill: "var(--text-muted)", fontSize: 11 }}
                      />
                      <YAxis
                        type="number" dataKey="weight_lb" name="Weight lb"
                        tickFormatter={v => `${(v/1000).toFixed(0)}K`}
                        stroke="var(--text-dim)" tick={{ fontSize: 11 }}
                        label={{ value: "Weight (lb)", angle: -90, position: "insideLeft", fill: "var(--text-muted)", fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{ background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 6, fontSize: 12 }}
                        formatter={(v, n) => n === "Weight lb" ? [`${v?.toLocaleString()} lb`, "Weight"] : [`${v}% MAC`, "CG"]}
                      />

                      {/* Envelope area */}
                      <ReferenceArea
                        x1={cg.fwd_limit_mac} x2={cg.aft_limit_mac}
                        fill="rgba(63,185,80,.07)" stroke="none"
                      />
                      {/* Limits */}
                      <ReferenceLine x={cg.fwd_limit_mac} stroke="var(--red)" strokeDasharray="5,3" label={{ value: "FWD", fill: "var(--red)", fontSize: 10 }} />
                      <ReferenceLine x={cg.aft_limit_mac} stroke="var(--red)" strokeDasharray="5,3" label={{ value: "AFT", fill: "var(--red)", fontSize: 10 }} />
                      {/* MTOW line */}
                      <ReferenceLine y={w.mtow_lb} stroke="var(--yellow)" strokeDasharray="4,3"
                        label={{ value: "MTOW", fill: "var(--yellow)", fontSize: 10, position: "right" }} />
                      <ReferenceLine y={w.mlw_lb}  stroke="var(--blue)"   strokeDasharray="4,3"
                        label={{ value: "MLW",  fill: "var(--blue)",   fontSize: 10, position: "right" }} />

                      {/* CG journey points */}
                      <Scatter
                        data={envelopeData}
                        fill="var(--accent)"
                        name="CG Journey"
                        shape={(props) => {
                          const { cx, cy, payload } = props;
                          return (
                            <g key={payload.label}>
                              <circle cx={cx} cy={cy} r={7} fill="var(--accent)" stroke="var(--bg)" strokeWidth={2}/>
                              <text x={cx+10} y={cy+4} fill="var(--text)" fontSize={10} fontFamily="JetBrains Mono">{payload.label}</text>
                            </g>
                          );
                        }}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
                <div className={s.envelopeLegend}>
                  {envelopeData.map(p => (
                    <div key={p.label} className={s.legendItem}>
                      <span className={s.legendDot}>{p.label}</span>
                      <span className={s.legendVal}>{p.cg_mac}% MAC / {p.weight_lb?.toLocaleString()} lb</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
