import SwiftUI
import UIKit
import CoreText

/// Mississippi palette (provisional, 2026-11-06; Nick decides, playbook/05-naming.md), light only. The Egg Bowl splits the state, so the
/// 2021 flag's colors (2021 HB 1 names Pantone 282, 200 and 7563): navy #00205B (15.5:1 on white) for titles, tint and accents; red
/// #BF0A30 (white on it 6.4:1) for the hand-checked guide cards; a deep navy #1B2F5E for honors chips (white 13:1); gold #C9A84C
/// (Pantone 7563's warmer gold) only as a fill under coal #1E1E1E (8.0:1), never as text; cream #F6F1E4 pages. The names
/// `green`/`gold` are kept from Wisconsin Eats so the shared views read the same; here `green` is flag navy and `gold` is flag red.
enum Theme {
    static let green = Color(hex: 0x00205B)      // flag navy: titles, tint, primary text accents
    static let green2 = Color(hex: 0x23407A)
    static let gold = Color(hex: 0xBF0A30)       // flag red: card fills under white text
    static let goldSoft = Color(hex: 0xF8DCE1)   // soft red
    static let lime = Color(hex: 0xC9A84C)       // flag gold, fills only (hand-checked pins, the title shadow), under coal
    static let limeSoft = Color(hex: 0xF3E9C8)
    static let sand = Color(hex: 0xF6F1E4)       // the Home background, cream
    static let red = Color(hex: 0x1B2F5E)        // deep navy: honors chips
    static let sandstone = Color(hex: 0xBF0A30)  // red accent (6.4:1 on white)
    static let teal = Color(hex: 0x1F6F78)       // river teal accent (5.6:1 on white)
    static let ink = Color(hex: 0x1E1E1E)
    static let ink2 = Color(hex: 0x2E3440)
    static let muted = Color(hex: 0x5B6270)
    static let surface = Color.white
    static let surface2 = Color(hex: 0xF1ECDF)
    static let surface3 = Color(hex: 0xE4DED0)
    static let rule = Color(hex: 0xE4DED0)
    static let rule2 = Color(hex: 0xCCC4B3)
}

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255)
    }
}

/// A small uppercase label: "STONE CRAB", "1 MICHELIN STAR".
struct Chip: View {
    enum Style { case gold, green, red, plain, dashed }
    let text: String
    var style: Style = .plain

    var body: some View {
        Text(text.uppercased())
            .font(.caption2.weight(.bold))
            .tracking(0.4)
            .padding(.horizontal, 7).padding(.vertical, 3)
            .foregroundStyle(style == .green || style == .red ? Color.white : style == .dashed ? Theme.muted : style == .gold ? Theme.ink : Theme.green)
            .background {
                RoundedRectangle(cornerRadius: 5).fill(style == .gold ? Theme.goldSoft : style == .green ? Theme.green : style == .red ? Theme.red
                                                       : style == .dashed ? .clear : Theme.surface2)
            }
            .overlay {
                if style == .dashed { RoundedRectangle(cornerRadius: 5).strokeBorder(Theme.rule2, style: StrokeStyle(lineWidth: 1, dash: [3, 2])) }
            }
            .accessibilityLabel(text)
    }
}

/// Mississippi Eats' lettering: the system face drawn compressed and heavy for titles and guide names, and the
/// system monospaced face for numbers, dates and small labels. No bundled fonts.
struct DisplayFont: ViewModifier {
    let size: CGFloat
    var weight: Font.Weight = .black
    @ScaledMetric(relativeTo: .body) private var scale: CGFloat = 1

    func body(content: Content) -> some View {
        content.font(.system(size: size * min(scale, 1.6), weight: weight).width(.compressed))
    }
}

/// Numbers, dates and small labels in the system monospaced face, scaled like DisplayFont.
struct MonoFont: ViewModifier {
    let size: CGFloat
    var weight: Font.Weight = .semibold
    @ScaledMetric(relativeTo: .body) private var scale: CGFloat = 1

    func body(content: Content) -> some View {
        content.font(.system(size: size * min(scale, 1.6), weight: weight, design: .monospaced))
    }
}

extension View {
    func displayFont(_ size: CGFloat, weight: Font.Weight = .black) -> some View {
        modifier(DisplayFont(size: size, weight: weight))
    }

    func monoFont(_ size: CGFloat, weight: Font.Weight = .semibold) -> some View {
        modifier(MonoFont(size: size, weight: weight))
    }
}

/// The header band: a row of magnolia blossoms (the state flower) in white with gold centers, on a flag-navy line.
struct Stripes: View {
    var height: CGFloat = 9

    var body: some View {
        Canvas { ctx, size in
            let w = size.width, h = size.height, line = h * 0.5
            ctx.fill(Path(CGRect(x: 0, y: line - 1.5, width: w, height: 3)), with: .color(Theme.green))
            let r = h * 0.42, n = max(3, Int(w / (r * 4.2)))
            for i in 0..<n {
                let cx = (CGFloat(i) + 0.5) * w / CGFloat(n), cy = line
                for k in 0..<6 {   // six round petals around the center
                    let a = CGFloat(k) * 2 * .pi / 6 - .pi / 2
                    let px = cx + cos(a) * r * 0.52, py = cy + sin(a) * r * 0.52
                    ctx.fill(Path(ellipseIn: CGRect(x: px - r * 0.52, y: py - r * 0.52, width: r * 1.04, height: r * 1.04)), with: .color(.white))
                    ctx.stroke(Path(ellipseIn: CGRect(x: px - r * 0.52, y: py - r * 0.52, width: r * 1.04, height: r * 1.04)), with: .color(Theme.green.opacity(0.35)), lineWidth: 0.8)
                }
                ctx.fill(Path(ellipseIn: CGRect(x: cx - r * 0.3, y: cy - r * 0.3, width: r * 0.6, height: r * 0.6)), with: .color(Theme.lime))
            }
        }
        .frame(height: height * 2.4)
        .accessibilityHidden(true)
    }
}

extension View {
    /// An inline navigation title in the display type. UINavigationBar.appearance() didn't reach every SwiftUI bar on iOS 27
    /// (the Map title went from compressed blue to plain black after a push and pop; place titles were always plain), so the
    /// title is our own view in the bar. The navigation title is still set, for the back button and VoiceOver.
    func inlineTitle(_ title: String) -> some View {
        navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text(title).displayFont(19, weight: .heavy).foregroundStyle(Theme.green)
                        .lineLimit(1).minimumScaleFactor(0.7)
                        .accessibilityAddTraits(.isHeader)
                }
            }
    }
}
