// FlightPlanningView.swift
import SwiftUI

struct FlightPlanningView: View {
    @EnvironmentObject var state: AppState
    @State private var flights: [FlightPlan] = []
    @State private var selected: FlightPlan?
    @State private var form = FlightPlanRequest(
        aircraft_type: "A320", departure: "", destination: "",
        flight_number: nil, cruise_alt_ft: 35000, cruise_mach: 0.78,
        flight_rules: "IFR", flight_type: "G", pax: 150, crew: 2, cargo_lb: 0
    )
    @State private var loading  = false
    @State private var error    = ""
    @State private var showForm = true

    var body: some View {
        NavigationStack {
            ZStack { Color("AppBG").ignoresSafeArea()
                if showForm {
                    formView
                } else if let f = selected {
                    FlightResultView(flight: f, onBack: { showForm = true; selected = nil })
                }
            }
            .navigationTitle("Flight Planning")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    if !flights.isEmpty {
                        Button("History") { showFlightList() }
                    }
                }
            }
        }
        .task { flights = (try? await ASService.listFlights()) ?? [] }
    }

    var formView: some View {
        ScrollView {
            VStack(spacing: 14) {
                ASCard {
                    SectionLabel(title: "NEW FLIGHT")
                    // Aircraft
                    ASPickerRow(label: "Aircraft", options: state.aircraft, display: { "\($0.code) — \($0.name)" }, selection: Binding(
                        get: { state.aircraft.first(where: { $0.code == form.aircraft_type }) ?? state.aircraft.first ?? AircraftSummary(code:"A320",name:"Airbus A320",mtow_lb:nil,mlw_lb:nil,oew_lb:nil,mfc_lb:nil,pax_max:nil,cruise_mach:nil,ceiling_ft:nil,range_nm:nil,engine:nil) },
                        set: { form.aircraft_type = $0.code; updateDefaults($0) }
                    ))
                    .padding(.bottom, 6)

                    HStack(spacing: 10) {
                        ASTextField(label: "Departure", text: Binding(get: { form.departure }, set: { form.departure = $0.uppercased() }))
                        ASTextField(label: "Destination", text: Binding(get: { form.destination }, set: { form.destination = $0.uppercased() }))
                    }

                    HStack(spacing: 10) {
                        ASTextField(label: "Cruise Alt", text: Binding(get: { "\(form.cruise_alt_ft)" }, set: { form.cruise_alt_ft = Int($0) ?? 35000 }), keyboard: .numberPad)
                        ASTextField(label: "Mach", text: Binding(get: { "\(form.cruise_mach)" }, set: { form.cruise_mach = Double($0) ?? 0.78 }), keyboard: .decimalPad)
                    }

                    HStack(spacing: 10) {
                        ASTextField(label: "Crew", text: Binding(get: { "\(form.crew)" }, set: { form.crew = Int($0) ?? 2 }), keyboard: .numberPad)
                        ASTextField(label: "PAX", text: Binding(get: { "\(form.pax)" }, set: { form.pax = Int($0) ?? 0 }), keyboard: .numberPad)
                        ASTextField(label: "Cargo lb", text: Binding(get: { "\(Int(form.cargo_lb))" }, set: { form.cargo_lb = Double($0) ?? 0 }), keyboard: .numberPad)
                    }

                    if !error.isEmpty {
                        Text(error).font(.system(size: 12)).foregroundColor(.red).padding(.top, 4)
                    }

                    ASButton(title: "✈  Compute Flight Plan", loading: loading) { Task { await submit() } }
                        .padding(.top, 4)
                }

                if !flights.isEmpty {
                    ASCard {
                        SectionLabel(title: "Recent Flights")
                        ForEach(flights.prefix(5)) { f in
                            Button { selected = f; showForm = false } label: {
                                HStack {
                                    VStack(alignment: .leading, spacing: 3) {
                                        HStack(spacing: 6) {
                                            Text(f.departure).font(.system(size: 14, weight: .bold, design: .monospaced))
                                            Image(systemName: "arrow.right").font(.system(size: 10)).foregroundColor(Color("TextMuted"))
                                            Text(f.destination).font(.system(size: 14, weight: .bold, design: .monospaced))
                                        }
                                        Text(f.aircraft_type).font(.system(size: 11)).foregroundColor(Color("TextMuted"))
                                    }
                                    Spacer()
                                    Text(f.eetFormatted).font(.system(size: 12, design: .monospaced)).foregroundColor(Color("Accent"))
                                }
                                .padding(.vertical, 8)
                            }
                            .foregroundColor(.white)
                        }
                    }
                }
                Spacer(minLength: 30)
            }
            .padding(16)
        }
    }

    func updateDefaults(_ ac: AircraftSummary) {
        if let m = ac.cruise_mach { form.cruise_mach = m }
        if let p = ac.pax_max { form.pax = p }
    }

    func showFlightList() { /* could push a full list view */ }

    func submit() async {
        guard !form.departure.isEmpty, !form.destination.isEmpty else {
            error = "Enter departure and destination"; return
        }
        loading = true; error = ""
        do {
            let fl = try await ASService.createFlight(form)
            flights.insert(fl, at: 0)
            selected = fl
            showForm = false
        } catch let e { error = e.localizedDescription }
        loading = false
    }
}

// MARK: - Flight Result
struct FlightResultView: View {
    let flight: FlightPlan
    let onBack: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                // Back + route header
                ASCard {
                    Button(action: onBack) {
                        HStack { Image(systemName: "chevron.left"); Text("New Flight") }
                            .font(.system(size: 13)).foregroundColor(Color("Accent"))
                    }
                    .padding(.bottom, 10)

                    HStack(alignment: .top) {
                        VStack(spacing: 4) {
                            Text(flight.departure).font(.system(size: 30, weight: .black, design: .monospaced))
                            if let w = flight.dep_weather { FlightCatPill(cat: w.flight_cat) }
                        }
                        VStack(spacing: 0) {
                            Image(systemName: "airplane").font(.system(size: 18)).foregroundColor(Color("Accent"))
                            Rectangle().frame(height: 1).foregroundColor(Color("Border")).padding(.horizontal, -4)
                        }.frame(maxWidth: .infinity).padding(.top, 8)
                        VStack(spacing: 4) {
                            Text(flight.destination).font(.system(size: 30, weight: .black, design: .monospaced))
                            if let w = flight.arr_weather { FlightCatPill(cat: w.flight_cat) }
                        }
                    }

                    HStack(spacing: 10) {
                        chip(text: flight.aircraft_type)
                        chip(text: "EET \(flight.eetFormatted)")
                        chip(text: "\(flight.route.dist_nm ?? 0) NM")
                        chip(text: flight.flight_rules)
                    }
                    .padding(.top, 8)
                }

                // Weights
                ASCard {
                    SectionLabel(title: "Weight Summary")
                    StatItem(label: "Zero Fuel Wt",  value: "\(flight.weights.zfw_lb.formatted()) lb", highlight: true)
                    StatItem(label: "Take-off Wt",   value: "\(flight.weights.tow_lb.formatted()) lb", highlight: true)
                    StatItem(label: "Landing Wt",    value: "\(flight.weights.lw_lb.formatted()) lb")
                    StatItem(label: "OEW",            value: "\(flight.weights.oew_lb.formatted()) lb")
                    StatItem(label: "Payload",        value: "\(flight.weights.payload_lb.formatted()) lb")
                    StatItem(label: "Crew / PAX",     value: "\(flight.crew) / \(flight.pax)")
                }

                // Fuel
                ASCard {
                    SectionLabel(title: "Fuel Summary")
                    StatItem(label: "Ramp Fuel",      value: "\(flight.weights.fuel_total_lb.formatted()) lb", highlight: true)
                    StatItem(label: "Trip Fuel",       value: "\(flight.weights.fuel_trip_lb.formatted()) lb")
                    if let f = flight.fuel {
                        StatItem(label: "Reserve Fuel", value: "\((f.reserve_fuel_lb ?? 0).formatted()) lb")
                        StatItem(label: "Cruise FF",    value: "\((f.cruise_ff_lb_hr ?? 0).formatted()) lb/hr")
                        StatItem(label: "TAS",          value: "\(f.tas_kt ?? 0) kt")
                        StatItem(label: "CO₂ (cruise)", value: "\(f.co2_cruise_kg ?? 0, specifier: "%.1f") kg")
                    }
                }

                // Weather
                if let dw = flight.dep_weather {
                    weatherCard(label: "Departure — \(flight.departure)", w: dw)
                }
                if let aw = flight.arr_weather {
                    weatherCard(label: "Arrival — \(flight.destination)", w: aw)
                }
                Spacer(minLength: 30)
            }
            .padding(16)
        }
    }

    func chip(text: String) -> some View {
        Text(text)
            .font(.system(size: 11, weight: .medium))
            .foregroundColor(Color("TextMuted"))
            .padding(.horizontal, 8).padding(.vertical, 4)
            .background(Color("Surface2"))
            .cornerRadius(4)
            .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color("Border"), lineWidth: 1))
    }

    func weatherCard(label: String, w: WeatherSummary) -> some View {
        ASCard {
            SectionLabel(title: label)
            HStack(spacing: 8) {
                FlightCatPill(cat: w.flight_cat)
                if let wx = w.wx { Text(wx).font(.system(size: 11)).foregroundColor(Color("Yellow")) }
            }.padding(.bottom, 6)

            if let wd = w.wind_dir, let ws = w.wind_kt {
                StatItem(label: "Wind", value: String(format: "%03d° @ %dkt", wd, ws) + (w.gust_kt != nil ? " G\(w.gust_kt!)kt" : ""))
            }
            StatItem(label: "Visibility", value: w.vis_sm != nil ? "\(w.vis_sm!) SM" : "—")
            StatItem(label: "Altimeter",  value: w.altim_inhg != nil ? String(format: "%.2f inHg", w.altim_inhg!) : "—")
            StatItem(label: "Temp / Dew", value: w.temp_c != nil ? "\(Int(w.temp_c!))°C / \(Int(w.dewpoint_c ?? 0))°C" : "—")

            if let raw = w.raw {
                Text(raw)
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundColor(Color("Blue"))
                    .padding(8).background(Color("AppBG")).cornerRadius(6)
                    .padding(.top, 8)
            }
        }
    }
}
