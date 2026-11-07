// Mississippi Eats brand (final: Nick's decisions, 2026-11-07): the app icon is concept C of
// scripts/icon-concepts.swift, a Gulf shrimp, on flag navy; the shared Eats Ranked icon style, state-prompts/ICON-STYLE.md, no backing
// shape. No school colours or marks, no flag star ring or motto.
// Usage, from ms-eats/: swift scripts/make-brand.swift   -> MississippiEats/Resources/Assets.xcassets/AppIcon.appiconset/icon-1024.png,
// docs/ favicons and touch icons, docs/og.png. scripts/make-site.py draws the same mark as its inline SVG: change both together.
import AppKit
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

func rgb(_ hex: UInt32) -> CGColor {
    CGColor(srgbRed: CGFloat((hex >> 16) & 255) / 255, green: CGFloat((hex >> 8) & 255) / 255, blue: CGFloat(hex & 255) / 255, alpha: 1)
}
let NAVY: UInt32 = 0x00205B, RED: UInt32 = 0xBF0A30, CREAM: UInt32 = 0xF6F1E4, GOLD: UInt32 = 0xC9A84C
let SHRIMP: UInt32 = 0xF08A5D, BAND: UInt32 = 0xD9663A, TAIL: UInt32 = 0xE46E43

/// C: the Gulf shrimp. Identical to icon-concepts.swift's concept C.
func shrimp(_ c: CGContext, _ s: CGFloat) {
    c.saveGState(); defer { c.restoreGState() }
    c.translateBy(x: -0.022 * s, y: 0.034 * s)   // centred (check.swift)
    let cx = 0.50 * s, cy = 0.50 * s, r = 0.255 * s
    c.setStrokeColor(rgb(SHRIMP)); c.setLineWidth(0.16 * s); c.setLineCap(.round)
    c.addArc(center: CGPoint(x: cx, y: cy), radius: r, startAngle: .pi * 0.65, endAngle: .pi * 1.85, clockwise: false); c.strokePath()
    c.setStrokeColor(rgb(BAND)); c.setLineWidth(0.035 * s); c.setLineCap(.round)
    for a in [0.95, 1.20, 1.45] {   // three shell bands across the body
        let t = CGFloat.pi * CGFloat(a)
        c.move(to: CGPoint(x: cx + cos(t) * (r - 0.06 * s), y: cy + sin(t) * (r - 0.06 * s)))
        c.addLine(to: CGPoint(x: cx + cos(t) * (r + 0.06 * s), y: cy + sin(t) * (r + 0.06 * s))); c.strokePath()
    }
    // the tail fan at the open end (upper right)
    let t0 = CGFloat.pi * 1.85, ex = cx + cos(t0) * r, ey = cy + sin(t0) * r
    let fan = CGMutablePath()
    fan.move(to: CGPoint(x: ex - 0.02 * s, y: ey))
    fan.addLine(to: CGPoint(x: ex + 0.13 * s, y: ey - 0.10 * s))
    fan.addLine(to: CGPoint(x: ex + 0.14 * s, y: ey + 0.06 * s)); fan.closeSubpath()
    c.setFillColor(rgb(TAIL)); c.addPath(fan); c.fillPath()
}

func render(_ n: Int, _ path: String, background: Bool) {
    let ctx = CGContext(data: nil, width: n, height: n, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                        bitmapInfo: background ? CGImageAlphaInfo.noneSkipLast.rawValue : CGImageAlphaInfo.premultipliedLast.rawValue)!
    ctx.setShouldAntialias(true)
    if background { ctx.setFillColor(rgb(NAVY)); ctx.fill(CGRect(x: 0, y: 0, width: n, height: n)) }
    shrimp(ctx, CGFloat(n))
    let d = CGImageDestinationCreateWithURL(URL(fileURLWithPath: path) as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(d, ctx.makeImage()!, nil)
    guard CGImageDestinationFinalize(d) else { fatalError("could not write \(path)") }
    print("wrote", path)
}
render(1024, "MississippiEats/Resources/Assets.xcassets/AppIcon.appiconset/icon-1024.png", background: true)
try? FileManager.default.createDirectory(atPath: "docs", withIntermediateDirectories: true)
for (n, name) in [(512, "icon-512.png"), (192, "icon-192.png"), (180, "apple-touch-icon.png"), (32, "favicon-32.png")] {
    render(n, "docs/" + name, background: true)
}

/// The share image (1200 x 630): flag navy, the shrimp at the left, the name in cream and the tagline in gold, and the app's magnolia
/// band (Theme.swift's Stripes) along the bottom on cream.
func og(_ path: String) {
    let W = 1200, H = 630
    let ctx = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
    ctx.setShouldAntialias(true)
    ctx.setFillColor(rgb(NAVY)); ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
    ctx.setFillColor(rgb(CREAM)); ctx.fill(CGRect(x: 0, y: 0, width: W, height: 92))
    let line: CGFloat = 46, r: CGFloat = 20
    ctx.setFillColor(rgb(NAVY)); ctx.fill(CGRect(x: 0, y: line - 3, width: CGFloat(W), height: 6))
    let n = Int(CGFloat(W) / (r * 4.2))
    for i in 0..<n {
        let cx = (CGFloat(i) + 0.5) * CGFloat(W) / CGFloat(n)
        for k in 0..<6 {
            let a = CGFloat(k) * 2 * .pi / 6 + .pi / 2
            let px = cx + cos(a) * r * 0.52, py = line + sin(a) * r * 0.52
            let rect = CGRect(x: px - r * 0.52, y: py - r * 0.52, width: r * 1.04, height: r * 1.04)
            ctx.setFillColor(CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 1)); ctx.fillEllipse(in: rect)
            ctx.setStrokeColor(rgb(NAVY).copy(alpha: 0.35)!); ctx.setLineWidth(1.2); ctx.strokeEllipse(in: rect)
        }
        ctx.setFillColor(rgb(GOLD)); ctx.fillEllipse(in: CGRect(x: cx - r * 0.3, y: line - r * 0.3, width: r * 0.6, height: r * 0.6))
    }
    ctx.saveGState(); ctx.translateBy(x: 20, y: 100); shrimp(ctx, 500); ctx.restoreGState()
    let ns = NSGraphicsContext(cgContext: ctx, flipped: false)
    NSGraphicsContext.saveGraphicsState(); NSGraphicsContext.current = ns
    let title = NSFont(name: "AvenirNextCondensed-Heavy", size: 92) ?? NSFont.boldSystemFont(ofSize: 80)
    let sub = NSFont(name: "AvenirNextCondensed-DemiBold", size: 32) ?? NSFont.boldSystemFont(ofSize: 28)
    let cream = NSColor(srgbRed: 0xF6 / 255, green: 0xF1 / 255, blue: 0xE4 / 255, alpha: 1)
    let gold = NSColor(srgbRed: 0xC9 / 255, green: 0xA8 / 255, blue: 0x4C / 255, alpha: 1)
    NSAttributedString(string: "MISSISSIPPI", attributes: [.font: title, .foregroundColor: cream]).draw(at: NSPoint(x: 540, y: 390))
    NSAttributedString(string: "EATS", attributes: [.font: title, .foregroundColor: cream]).draw(at: NSPoint(x: 540, y: 296))
    NSAttributedString(string: "TAMALES, CATFISH & GULF SEAFOOD", attributes: [.font: sub, .foregroundColor: gold]).draw(at: NSPoint(x: 544, y: 246))
    NSGraphicsContext.restoreGraphicsState()
    let d = CGImageDestinationCreateWithURL(URL(fileURLWithPath: path) as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(d, ctx.makeImage()!, nil)
    guard CGImageDestinationFinalize(d) else { fatalError("could not write \(path)") }
    print("wrote", path)
}
og("docs/og.png")
