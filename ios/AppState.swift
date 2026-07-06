// AppState.swift
import Foundation
import SwiftUI

@MainActor
class AppState: ObservableObject {
    @Published var user: ASUser?       = nil
    @Published var isLoading: Bool      = true
    @Published var aircraft: [AircraftSummary] = []

    init() { Task { await restore() } }

    func restore() async {
        guard TokenStore.load() != nil else { isLoading = false; return }
        do {
            let u = try await ASService.me()
            user = u
            await loadAircraft()
        } catch { TokenStore.clear() }
        isLoading = false
    }

    func login(email: String, password: String) async throws {
        let res = try await ASService.login(email: email, password: password)
        user = res.user
        await loadAircraft()
    }

    func logout() {
        TokenStore.clear()
        user = nil
        aircraft = []
    }

    func loadAircraft() async {
        aircraft = (try? await ASService.aircraftList()) ?? []
    }
}
