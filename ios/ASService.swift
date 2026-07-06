// ASService.swift
// Shared networking for iOS app — mirrors the web frontend exactly

import Foundation

// ── Change to your deployed backend URL ──────────────────────────────────────
private let BASE_URL = "http://localhost:8000/api"

// MARK: - Token storage
enum TokenStore {
    static func save(_ token: String)  { UserDefaults.standard.set(token, forKey: "apg_token") }
    static func load() -> String?      { UserDefaults.standard.string(forKey: "apg_token") }
    static func clear()                { UserDefaults.standard.removeObject(forKey: "apg_token") }
}

// MARK: - API errors
enum ASError: LocalizedError {
    case noToken, httpError(Int, String), decodingError(Error), networkError(Error)
    var errorDescription: String? {
        switch self {
        case .noToken:                return "Not authenticated"
        case .httpError(_, let m):    return m
        case .decodingError(let e):   return "Data error: \(e.localizedDescription)"
        case .networkError(let e):    return "Network: \(e.localizedDescription)"
        }
    }
}

// MARK: - Generic fetch
@MainActor
func apgFetch<T: Decodable>(_ path: String, method: String = "GET", body: Encodable? = nil, requiresAuth: Bool = true) async throws -> T {
    guard let url = URL(string: "\(BASE_URL)\(path)") else { throw ASError.networkError(URLError(.badURL)) }
    var req = URLRequest(url: url)
    req.httpMethod = method
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    if requiresAuth, let token = TokenStore.load() {
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    }
    if let body {
        req.httpBody = try JSONEncoder().encode(body)
    }
    do {
        let (data, response) = try await URLSession.shared.data(for: req)
        let code = (response as? HTTPURLResponse)?.statusCode ?? 0
        if code >= 400 {
            let msg = (try? JSONDecoder().decode([String: String].self, from: data))?["detail"] ?? "HTTP \(code)"
            throw ASError.httpError(code, msg)
        }
        return try JSONDecoder().decode(T.self, from: data)
    } catch let e as ASError { throw e }
      catch let e as DecodingError { throw ASError.decodingError(e) }
      catch { throw ASError.networkError(error) }
}

// MARK: - API calls
struct ASService {

    // Auth
    static func login(email: String, password: String) async throws -> LoginResponse {
        let body = LoginRequest(email: email, password: password)
        let res: LoginResponse = try await apgFetch("/auth/login", method: "POST", body: body, requiresAuth: false)
        TokenStore.save(res.token)
        return res
    }

    static func me() async throws -> ASUser {
        try await apgFetch("/auth/me")
    }

    // Aircraft
    static func aircraftList() async throws -> [AircraftSummary] {
        try await apgFetch("/aircraft")
    }

    static func aircraft(_ type: String) async throws -> AircraftDetail {
        try await apgFetch("/aircraft/\(type)")
    }

    // Flights
    static func createFlight(_ req: FlightPlanRequest) async throws -> FlightPlan {
        try await apgFetch("/flights", method: "POST", body: req)
    }

    static func listFlights() async throws -> [FlightPlan] {
        try await apgFetch("/flights")
    }

    // Runway
    static func runwayAnalysis(icao: String, acType: String, massLb: Double, rwyHdg: Double) async throws -> RunwayResult {
        try await apgFetch("/runway/\(icao)?ac_type=\(acType)&mass_lb=\(massLb)&rwy_hdg=\(rwyHdg)")
    }

    // W&B
    static func weightBalance(_ req: WBRequest) async throws -> WBResult {
        try await apgFetch("/wb", method: "POST", body: req)
    }
}
