// ASApp.swift
import SwiftUI

@main
struct ASApp: App {
    @StateObject var state = AppState()

    var body: some Scene {
        WindowGroup {
            Group {
                if state.isLoading {
                    SplashView()
                } else if state.user == nil {
                    LoginView()
                } else {
                    MainTabView()
                }
            }
            .environmentObject(state)
            .preferredColorScheme(.dark)
        }
    }
}

struct SplashView: View {
    var body: some View {
        ZStack {
            Color("AppBG").ignoresSafeArea()
            VStack(spacing: 16) {
                Image(systemName: "airplane.circle.fill")
                    .font(.system(size: 60))
                    .foregroundColor(Color("Accent"))
                Text("AS").font(.system(size: 28, weight: .black)).foregroundColor(.white)
                ProgressView().tint(Color("Accent"))
            }
        }
    }
}
