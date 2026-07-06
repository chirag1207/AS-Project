// RunwayAndWB.swift
import SwiftUI

// MARK: - Runway Analysis
struct RunwayView: View {
    @EnvironmentObject var state: AppState
    @State private var icao     = ""
    @State private var acType   = "A320"
    @State private var massLb   = "140000"
    @State private var rwyHdg   = 180.0
    @State private var result: RunwayResult?
    @State private var loading  = false
    @State private var error    = ""

    let headings = stride(from: 10, through: 360, by: 10).map { Double($0) }

    var body: some View {
        NavigationStack {
            ZStack { Color("AppBG").ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 14) {
                        // Form
                        ASCard {
                            SectionLabel(title: "RUNWAY ANALYSIS")

                            ASTextField(label: "Airport ICAO", text: $icao)

                            ASPickerRow(label: "Aircraft", options: state.aircraft, display: { "\($0.code) — \($0.name)" },
                                selection: Binding(
                                    get: { state.aircraft.first(where: { $0.code == acType }) ?? state.aircraft.first! },
                                    set: { acType = $0.code }
                                ))

                            ASTextField(label: "Aircraft Mass (lb)", text: $massLb, keyboard: .numberPad)

                            ASPickerRow(label: "Runway Heading", options: headings,
                                display: { "RWY \(String(format: "%02d", Int($0/10))) (\(Int($0))°)" },
                                selection: $rwyHdg)

                            if !error.isEmpty {
                                Text(error).font(.system(size: 12)).foregroundColor(.red)
                            }

                            ASButton(title: "Analyze Runway", loading: loading) {
                                Task { await analyze() }
                            }
                        }

                        // Results
                        if let r = result {
                            runwayResults(r)
                        }

                        if loading {
                            ASCard {
                                HStack { Spacer(); ProgressView().tint(Color("Accent")); Spacer() }
                                    .padding()
                            }
                        }

                        Spacer(minLength: 30)
                    }
                    .padding(16)
                }
            }
            .navigationTitle("Runway Analysis")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    @ViewBuilder
    func runwayResults(_ r: RunwayResult) -> some View {
        let p = r.performance
        let w = r.weather
        let withinMTOW = (p.weight_vs_mtow_pct ?? 0) <= 100

        // Header
        ASCard {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(r.station.name ?? r.icao)
                        .font(.system(size: 13)).foregroundColor(Color("TextMuted"))
                    Text(r.icao)
                        .font(.system(size: 26, weight: .black, design: .monospaced))
                        .foregroundColor(Color("Accent"))
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 6) {
                    FlightCatPill(cat: r.flight_category)
                    HStack(spacing: 4) {
                        Circle().fill(withinMTOW ? Color("CatVFR") : Color.red)
                            .frame(width: 6, height: 6)
                        Text(withinMTOW ? "Within MTOW" : "EXCEEDS MTOW")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(withinMTOW ? Color("CatVFR") : .red)
                    }
                }
            }
            if let raw = w.raw {
                Text(raw)
                    .font(.system(size: 9, design: .monospaced))
                    .foregroundColor(Color("Blue"))
                    .padding(8).background(Color("AppBG")).cornerRadius(6)
                    .padding(.top, 8)
            }
        }

        // Two column cards
        HStack(alignment: .top, spacing: 14) {
            ASCard {
                SectionLabel(title: "Conditions")
                StatItem(label: "Temp", value: w.temp_c != nil ? "\(Int(w.temp_c!))°C" : "—")
                StatItem(label: "ISA Dev", value: p.temp_deviation_isa != nil ? String(format: "%+.1f°C", p.temp_deviation_isa!) : "—",
                    highlight: abs(p.temp_deviation_isa ?? 0) > 15)
                StatItem(label: "Altimeter", value: w.altim_inhg != nil ? String(format: "%.2f", w.altim_inhg!) : "—")
                StatItem(label: "Elevation", value: "\(r.station.elevation_ft ?? 0) ft")
                StatItem(label: "Pressure Alt", value: "\((p.pressure_alt_ft ?? 0).formatted()) ft")
                StatItem(label: "Density Alt",  value: "\((p.density_alt_ft ?? 0).formatted()) ft", highlight: true)
                StatItem(label: "σ Ratio",      value: String(format: "%.4f", p.density_ratio ?? 1))
                StatItem(label: "Headwind",     value: p.headwind_kt != nil ? String(format: "%@%.0f kt", (p.headwind_kt! >= 0 ? "HW " : "TW "), abs(p.headwind_kt!)) : "—",
                    highlight: (p.headwind_kt ?? 0) < 0)
                StatItem(label: "Crosswind",    value: "\(p.crosswind_kt ?? 0, specifier: "%.1f") kt")
            }

            ASCard {
                SectionLabel(title: "Performance")
                StatItem(label: "Plan TO Wt",   value: "\(Int(r.mass_lb).formatted()) lb", highlight: true)
                StatItem(label: "MTOW",          value: "\((p.mtow_lb ?? 0).formatted()) lb")
                StatItem(label: "Wt / MTOW",    value: "\(p.weight_vs_mtow_pct ?? 0, specifier: "%.1f")%",
                    highlight: (p.weight_vs_mtow_pct ?? 0) > 100)
                StatItem(label: "V2 Speed",      value: "\(p.v2_kt ?? 0, specifier: "%.1f") kt")
                StatItem(label: "TO Thrust",     value: "\((p.takeoff_thrust_lb ?? 0).formatted()) lb")
                StatItem(label: "Est. TOD",      value: "\((p.tod_estimated_ft ?? 0).formatted()) ft")
                StatItem(label: "MLW Limit",     value: "\((p.mlw_lb ?? 0).formatted()) lb")

                Text("⚠ Estimates only — not for flight ops")
                    .font(.system(size: 10))
                    .foregroundColor(Color("Yellow"))
                    .padding(8)
                    .background(Color("Yellow").opacity(0.08))
                    .cornerRadius(6)
                    .padding(.top, 10)
            }
        }
    }

    func analyze() async {
        guard !icao.isEmpty else { error = "Enter airport ICAO"; return }
        guard let mass = Double(massLb) else { error = "Enter valid mass"; return }
        loading = true; error = ""; result = nil
        do {
            result = try await ASService.runwayAnalysis(
                icao: icao.uppercased(), acType: acType,
                massLb: mass, rwyHdg: rwyHdg
            )
        } catch let e { error = e.localizedDescription }
        loading = false
    }
}

// MARK: - Weight & Balance
struct WeightBalanceView: View {
    @EnvironmentObject var state: AppState
    @State private var acType   = "A320"
    @State private var crew     = "2"
    @State private var pax      = "150"
    @State private var cargoLb  = "5000"
    @State private var fuelLb   = "20000"
    @State private var crewSta  = "0.25"
    @State private var paxSta   = "0.30"
    @State private var cargoSta = "0.45"
    @State private var result: WBResult?
    @State private var loading  = false
    @State private var error    = ""

    var body: some View {
        NavigationStack {
            ZStack { Color("AppBG").ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 14) {
                        ASCard {
                            SectionLabel(title: "WEIGHT & BALANCE")

                            ASPickerRow(label: "Aircraft", options: state.aircraft, display: { "\($0.code) — \($0.name)" },
                                selection: Binding(
                                    get: { state.aircraft.first(where: { $0.code == acType }) ?? state.aircraft.first! },
                                    set: { acType = $0.code }
                                ))

                            HStack(spacing: 8) {
                                ASTextField(label: "Crew", text: $crew, keyboard: .numberPad)
                                ASTextField(label: "PAX",  text: $pax,  keyboard: .numberPad)
                            }
                            HStack(spacing: 8) {
                                ASTextField(label: "Cargo lb", text: $cargoLb, keyboard: .numberPad)
                                ASTextField(label: "Fuel lb",  text: $fuelLb,  keyboard: .numberPad)
                            }

                            VStack(alignment: .leading, spacing: 6) {
                                Text("CG Stations (fraction of MAC)")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(Color("TextDim"))
                                    .textCase(.uppercase)
                                HStack(spacing: 8) {
                                    ASTextField(label: "Crew", text: $crewSta, keyboard: .decimalPad)
                                    ASTextField(label: "Pax",  text: $paxSta,  keyboard: .decimalPad)
                                    ASTextField(label: "Cargo",text: $cargoSta,keyboard: .decimalPad)
                                }
                            }
                            .padding(10)
                            .background(Color("AppBG"))
                            .cornerRadius(8)

                            if !error.isEmpty {
                                Text(error).font(.system(size: 12)).foregroundColor(.red)
                            }

                            ASButton(title: "⚖  Compute W&B", loading: loading) {
                                Task { await compute() }
                            }
                        }

                        if let r = result { wbResults(r) }

                        Spacer(minLength: 30)
                    }
                    .padding(16)
                }
            }
            .navigationTitle("W & B")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    @ViewBuilder
    func wbResults(_ r: WBResult) -> some View {
        let w  = r.weights
        let cg = r.cg
        let lim = r.limits

        // Status header
        ASCard {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(r.aircraft_name).font(.system(size: 14, weight: .bold))
                    Text(r.aircraft_type).font(.system(size: 22, weight: .black, design: .monospaced)).foregroundColor(Color("Accent"))
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 6) {
                    statusBadge(ok: lim.tow_within_mtow, text: "TOW \(lim.tow_vs_mtow_pct ?? 0, specifier: "%.1f")% MTOW")
                    statusBadge(ok: lim.lw_within_mlw,  text: "LW \(lim.lw_vs_mlw_pct ?? 0, specifier: "%.1f")% MLW")
                }
            }
        }

        // CG Status
        ASCard {
            SectionLabel(title: "CG Status")
            cgRow(label: "ZFW CG", val: "\(cg.zfw_pct_mac, specifier: "%.2f")% MAC", ok: cg.zfw_status == "NORMAL")
            cgRow(label: "TOW CG", val: "\(cg.tow_pct_mac, specifier: "%.2f")% MAC", ok: cg.tow_status == "NORMAL")
            cgRow(label: "LW CG",  val: "\(cg.lw_pct_mac,  specifier: "%.2f")% MAC", ok: cg.lw_status == "NORMAL")
            HStack {
                Text("Envelope").font(.system(size: 12)).foregroundColor(Color("TextMuted"))
                Spacer()
                Text("\(cg.fwd_limit_mac, specifier: "%.0f")% — \(cg.aft_limit_mac, specifier: "%.0f")% MAC")
                    .font(.system(size: 12, weight: .semibold))
            }.padding(.top, 4)
        }

        // Weight breakdown
        ASCard {
            SectionLabel(title: "Weight Breakdown")
            StatItem(label: "OEW",         value: "\(w.oew_lb.formatted()) lb")
            StatItem(label: "Crew",        value: "\(w.crew_lb.formatted()) lb")
            StatItem(label: "PAX",         value: "\(w.pax_lb.formatted()) lb")
            StatItem(label: "Cargo",       value: "\(Int(w.cargo_lb).formatted()) lb")
            Divider().background(Color("Border2")).padding(.vertical, 4)
            StatItem(label: "Zero Fuel Wt",value: "\(w.zfw_lb.formatted()) lb", highlight: true)
            StatItem(label: "Fuel",        value: "\(Int(w.fuel_lb).formatted()) lb")
            Divider().background(Color("Border2")).padding(.vertical, 4)
            StatItem(label: "Take-off Wt", value: "\(w.tow_lb.formatted()) lb", highlight: true)
            StatItem(label: "MTOW",        value: "\(w.mtow_lb.formatted()) lb")
            StatItem(label: "Landing Wt",  value: "\(w.lw_lb.formatted()) lb")
            StatItem(label: "MLW",         value: "\(w.mlw_lb.formatted()) lb")
        }

        // CG journey
        ASCard {
            SectionLabel(title: "CG Journey")
            ForEach(r.envelope_points) { pt in
                HStack {
                    Text(pt.label)
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundColor(Color("Accent"))
                        .frame(width: 36, alignment: .leading)
                    Text("\(pt.cg_mac, specifier: "%.2f")% MAC")
                        .font(.system(size: 12, design: .monospaced))
                    Spacer()
                    Text("\(pt.weight_lb.formatted()) lb")
                        .font(.system(size: 12)).foregroundColor(Color("TextMuted"))
                }
                .padding(.vertical, 6)
                .overlay(Rectangle().frame(height: 1).foregroundColor(Color("Border")), alignment: .bottom)
            }
        }
    }

    func statusBadge(ok: Bool, text: String) -> some View {
        HStack(spacing: 4) {
            Circle().fill(ok ? Color("CatVFR") : Color.red).frame(width: 6, height: 6)
            Text(text).font(.system(size: 11, weight: .semibold)).foregroundColor(ok ? Color("CatVFR") : .red)
        }
    }

    func cgRow(label: String, val: String, ok: Bool) -> some View {
        HStack {
            Text(label).font(.system(size: 12)).foregroundColor(Color("TextMuted"))
            Spacer()
            Text(val).font(.system(size: 12, weight: .semibold, design: .monospaced))
            Text(ok ? "✓" : "✗")
                .font(.system(size: 11, weight: .bold))
                .foregroundColor(ok ? Color("CatVFR") : .red)
                .padding(.leading, 6)
        }
        .padding(.vertical, 7)
        .overlay(Rectangle().frame(height: 1).foregroundColor(Color("Border")), alignment: .bottom)
    }

    func compute() async {
        loading = true; error = ""; result = nil
        do {
            let req = WBRequest(
                aircraft_type: acType,
                crew: Int(crew) ?? 2, pax: Int(pax) ?? 0,
                cargo_lb: Double(cargoLb) ?? 0, fuel_lb: Double(fuelLb) ?? 0,
                crew_station_mac: Double(crewSta) ?? 0.25,
                pax_station_mac:  Double(paxSta)  ?? 0.30,
                cargo_station_mac: Double(cargoSta) ?? 0.45
            )
            result = try await ASService.weightBalance(req)
        } catch let e { error = e.localizedDescription }
        loading = false
    }
}
