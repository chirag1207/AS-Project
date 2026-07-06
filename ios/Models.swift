// Models.swift

import Foundation

// MARK: - Auth
struct LoginRequest: Encodable {
    let email: String
    let password: String
}
struct LoginResponse: Decodable {
    let token: String
    let user: ASUser
}
struct ASUser: Decodable {
    let email: String
    let name: String
    let role: String
    let cert: String
}

// MARK: - Aircraft
struct AircraftSummary: Decodable, Identifiable {
    var id: String { code }
    let code: String
    let name: String
    let mtow_lb: Int?
    let mlw_lb: Int?
    let oew_lb: Int?
    let mfc_lb: Int?
    let pax_max: Int?
    let cruise_mach: Double?
    let ceiling_ft: Int?
    let range_nm: Int?
    let engine: String?
}

struct AircraftDetail: Decodable {
    let code: String
    let name: String
    let weights: AircraftWeights
    let performance: AircraftPerf
    let engines: AircraftEngines
    let pax: PaxData?
}
struct AircraftWeights: Decodable {
    let mtow_lb: Int; let mlw_lb: Int; let oew_lb: Int; let mfc_lb: Int
    let mtow_kg: Int; let mlw_kg: Int; let oew_kg: Int; let mfc_kg: Int
}
struct AircraftPerf: Decodable {
    let cruise_mach: Double?; let cruise_alt_ft: Int?; let range_nm: Int?
    let vmo_kt: Double?; let mmo: Double?; let ceiling_ft: Int?
}
struct AircraftEngines: Decodable {
    let type: String?; let number: Int?; let `default`: String?
}
struct PaxData: Decodable {
    let max: Int?; let low: Int?; let high: Int?
}

// MARK: - Flight Plan
struct FlightPlanRequest: Encodable {
    var aircraft_type: String
    var departure: String
    var destination: String
    var flight_number: String?
    var cruise_alt_ft: Int
    var cruise_mach: Double
    var flight_rules: String
    var flight_type: String
    var pax: Int
    var crew: Int
    var cargo_lb: Double
}

struct FlightPlan: Decodable, Identifiable {
    let id: String
    let flight_number: String?
    let aircraft_type: String
    let aircraft_name: String
    let departure: String
    let destination: String
    let cruise_alt_ft: Int
    let cruise_mach: Double
    let flight_rules: String
    let crew: Int
    let pax: Int
    let weights: FlightWeights
    let route: RouteInfo
    let fuel: FuelInfo?
    let dep_weather: WeatherSummary?
    let arr_weather: WeatherSummary?
    let created_at: String
}

struct FlightWeights: Decodable {
    let oew_lb: Int; let tow_lb: Int; let lw_lb: Int; let zfw_lb: Int
    let fuel_total_lb: Int; let fuel_trip_lb: Int; let payload_lb: Int
}
struct RouteInfo: Decodable {
    let dist_nm: Int?; let eet_min: Int?; let route_string: String?
}
struct FuelInfo: Decodable {
    let trip_fuel_lb: Int?; let total_fuel_lb: Int?; let reserve_fuel_lb: Int?
    let cruise_ff_lb_hr: Int?; let tas_kt: Int?; let flight_time_min: Int?
    let co2_cruise_kg: Double?; let climb_min: Int?; let cruise_min: Int?; let desc_min: Int?
}
struct WeatherSummary: Decodable {
    let raw: String?; let temp_c: Double?; let dewpoint_c: Double?
    let wind_dir: Int?; let wind_kt: Int?; let gust_kt: Int?
    let vis_sm: Double?; let altim_inhg: Double?
    let wx: String?; let flight_cat: String?
}

// MARK: - Runway
struct RunwayResult: Decodable {
    let icao: String
    let aircraft_type: String
    let mass_lb: Double
    let flight_category: String
    let station: StationInfo
    let weather: WeatherSummary
    let performance: RunwayPerf
}
struct StationInfo: Decodable {
    let elevation_ft: Int?; let name: String?
}
struct RunwayPerf: Decodable {
    let pressure_alt_ft: Int?; let density_alt_ft: Int?; let density_ratio: Double?
    let headwind_kt: Double?; let crosswind_kt: Double?; let v2_kt: Double?
    let takeoff_thrust_lb: Int?; let tod_estimated_ft: Int?
    let mtow_lb: Int?; let mlw_lb: Int?; let weight_vs_mtow_pct: Double?
    let temp_deviation_isa: Double?
}

// MARK: - W&B
struct WBRequest: Encodable {
    var aircraft_type: String
    var crew: Int; var pax: Int
    var cargo_lb: Double; var fuel_lb: Double
    var crew_station_mac: Double
    var pax_station_mac: Double
    var cargo_station_mac: Double
}

struct WBResult: Decodable {
    let aircraft_type: String
    let aircraft_name: String
    let mac_m: Double; let lemac_m: Double
    let weights: WBWeights
    let cg: CGInfo
    let limits: WBLimits
    let envelope_points: [EnvelopePoint]
}
struct WBWeights: Decodable {
    let oew_lb: Int; let crew_lb: Int; let pax_lb: Int; let cargo_lb: Double; let fuel_lb: Double
    let zfw_lb: Int; let tow_lb: Int; let lw_lb: Int; let mtow_lb: Int; let mlw_lb: Int
}
struct CGInfo: Decodable {
    let zfw_pct_mac: Double; let tow_pct_mac: Double; let lw_pct_mac: Double
    let fwd_limit_mac: Double; let aft_limit_mac: Double
    let zfw_status: String; let tow_status: String; let lw_status: String
}
struct WBLimits: Decodable {
    let tow_vs_mtow_pct: Double?; let lw_vs_mlw_pct: Double?
    let tow_within_mtow: Bool; let lw_within_mlw: Bool
}
struct EnvelopePoint: Decodable, Identifiable {
    var id: String { label }
    let weight_lb: Int; let cg_mac: Double; let label: String
}

// MARK: - Helpers
extension FlightPlan {
    var eetFormatted: String {
        guard let min = route.eet_min else { return "--:--" }
        return String(format: "%02d:%02d", min / 60, min % 60)
    }
}
extension WeatherSummary {
    var flightCatColor: String {
        switch flight_cat {
        case "VFR":  return "CatVFR"
        case "MVFR": return "CatMVFR"
        case "IFR":  return "CatIFR"
        case "LIFR": return "CatLIFR"
        default:     return "CatUnknown"
        }
    }
}
