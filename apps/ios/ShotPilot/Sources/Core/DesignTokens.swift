import SwiftUI

/// Mirrors packages/design-tokens (tungsten on slate).
enum SPColor {
    static let accent = Color(light: 0xD9822B, dark: 0xF0A04B)
    static let background = Color(light: 0xF6F5F2, dark: 0x111317)
    static let surface = Color(light: 0xFFFFFF, dark: 0x181B20)
    static let rail = Color(light: 0x16181D, dark: 0x0B0C0F)
    static let ai = Color(light: 0x7C4DDE, dark: 0xA688F0)
}

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255)
    }
    init(light: UInt32, dark: UInt32) {
        self.init(UIColor { $0.userInterfaceStyle == .dark ? UIColor(Color(hex: dark)) : UIColor(Color(hex: light)) })
    }
}
