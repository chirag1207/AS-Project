// Views.swift — Login + Tab shell + shared components

import SwiftUI

// MARK: - Login
struct LoginView: View {
    @EnvironmentObject var state: AppState
    @State private var email    = "pilot@aircraftsolutions.com"
    @State private var password = "demo1234"
    @State private var error    = ""
    @State private var loading  = false

    var body: some View {
        ZStack {
            Color("AppBG").ignoresSafeArea()
            VStack(spacing: 0) {
                Spacer()
                // Logo
                VStack(spacing: 10) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 18)
                            .fill(Color("Accent"))
                            .frame(width: 72, height: 72)
                        Image(systemName: "airplane")
                            .font(.system(size: 32, weight: .semibold))
                            .foregroundColor(.white)
                    }
                    Text("Aircraft Solutions")
                        .font(.system(size: 16, weight: .bold))
                    Text("Flight Operations Portal")
                        .font(.system(size: 13))
                        .foregroundColor(Color("TextMuted"))
                }
                .padding(.bottom, 40)

                // Form
                VStack(spacing: 14) {
                    ASTextField(label: "Email", text: $email, keyboard: .emailAddress)
                    ASTextField(label: "Password", text: $password, isSecure: true)

                    if !error.isEmpty {
                        HStack {
                            Image(systemName: "exclamationmark.triangle.fill").foregroundColor(.red)
                            Text(error).font(.system(size: 13)).foregroundColor(.red)
                        }
                        .padding(10)
                        .background(Color.red.opacity(0.1))
                        .cornerRadius(8)
                    }

                    ASButton(title: "Sign In", loading: loading) {
                        Task {
                            loading = true; error = ""
                            do { try await state.login(email: email, password: password) }
                            catch let e { error = e.localizedDescription }
                            loading = false
                        }
                    }
                }
                .padding(.horizontal, 28)

                Spacer()
                Text("Demo: pilot@aircraftsolutions.com / demo1234")
                    .font(.system(size: 11))
                    .foregroundColor(Color("TextDim"))
                    .padding(.bottom, 30)
            }
        }
    }
}

// MARK: - Main Tab View
struct MainTabView: View {
    @EnvironmentObject var state: AppState

    var body: some View {
        TabView {
            FlightPlanningView()
                .tabItem { Label("Flights", systemImage: "airplane") }

            RunwayView()
                .tabItem { Label("Runway", systemImage: "road.lanes") }

            WeightBalanceView()
                .tabItem { Label("W & B", systemImage: "scale.3d") }
        }
        .accentColor(Color("Accent"))
    }
}

// MARK: - Shared UI Components

struct ASTextField: View {
    let label: String
    @Binding var text: String
    var keyboard: UIKeyboardType = .default
    var isSecure: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label).font(.system(size: 11, weight: .semibold)).foregroundColor(Color("TextMuted")).textCase(.uppercase)
            Group {
                if isSecure {
                    SecureField("", text: $text)
                } else {
                    TextField("", text: $text)
                        .keyboardType(keyboard)
                        .autocapitalization(.none)
                        .disableAutocorrection(true)
                }
            }
            .font(.system(size: 14))
            .foregroundColor(.white)
            .padding(10)
            .background(Color("Surface2"))
            .cornerRadius(8)
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color("Border"), lineWidth: 1))
        }
    }
}

struct ASPickerRow<T: Hashable>: View {
    let label: String
    let options: [T]
    let display: (T) -> String
    @Binding var selection: T

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label).font(.system(size: 11, weight: .semibold)).foregroundColor(Color("TextMuted")).textCase(.uppercase)
            Menu {
                ForEach(options, id: \.self) { opt in
                    Button(display(opt)) { selection = opt }
                }
            } label: {
                HStack {
                    Text(display(selection)).font(.system(size: 14)).foregroundColor(.white)
                    Spacer()
                    Image(systemName: "chevron.up.chevron.down").font(.system(size: 11)).foregroundColor(Color("TextMuted"))
                }
                .padding(10)
                .background(Color("Surface2"))
                .cornerRadius(8)
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color("Border"), lineWidth: 1))
            }
        }
    }
}

struct ASButton: View {
    let title: String
    var loading: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if loading { ProgressView().tint(.white).scaleEffect(0.85) }
                Text(title).font(.system(size: 14, weight: .semibold))
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(12)
            .background(loading ? Color("Accent").opacity(0.6) : Color("Accent"))
            .cornerRadius(8)
        }
        .disabled(loading)
    }
}

struct StatItem: View {
    let label: String
    let value: String
    var highlight: Bool = false
    var mono: Bool = false

    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 12))
                .foregroundColor(Color("TextMuted"))
            Spacer()
            Text(value)
                .font(mono ? .system(size: 12, weight: .semibold, design: .monospaced) : .system(size: 13, weight: .semibold))
                .foregroundColor(highlight ? Color("Accent") : .white)
        }
        .padding(.vertical, 6)
        .overlay(Rectangle().frame(height: 1).foregroundColor(Color("Border")), alignment: .bottom)
    }
}

struct SectionLabel: View {
    let title: String
    var sub: String? = nil

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(title)
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(Color("TextMuted"))
                .textCase(.uppercase)
                .tracking(1)
            if let sub {
                Text(sub).font(.system(size: 10)).foregroundColor(Color("TextDim"))
            }
        }
        .padding(.bottom, 6)
    }
}

struct FlightCatPill: View {
    let cat: String?
    var body: some View {
        let c = cat ?? "UNKN"
        let col: Color = {
            switch c {
            case "VFR":  return Color("CatVFR")
            case "MVFR": return Color("CatMVFR")
            case "IFR":  return Color("CatIFR")
            case "LIFR": return Color("CatLIFR")
            default:     return Color("TextMuted")
            }
        }()
        Text(c)
            .font(.system(size: 10, weight: .bold, design: .monospaced))
            .foregroundColor(col)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(col.opacity(0.15))
            .overlay(RoundedRectangle(cornerRadius: 4).stroke(col.opacity(0.4), lineWidth: 1))
            .cornerRadius(4)
    }
}

struct ASCard<Content: View>: View {
    @ViewBuilder let content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 0) { content }
            .padding(16)
            .background(Color("Surface"))
            .cornerRadius(10)
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color("Border"), lineWidth: 1))
    }
}
