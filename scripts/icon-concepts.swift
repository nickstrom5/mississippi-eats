// Mississippi Eats icon concepts (2026-11-06), drawn in the shared Eats Ranked style (state-prompts/ICON-STYLE.md): one flat, level,
// centred food on a plain background in the state palette (the 2021 flag's navy #00205B and red #BF0A30, gold #C9A84C as a fill,
// cream #F6F1E4), no backing shape, no text or texture; no school colours or marks, no flag star ring or motto.
// Food hexes: husk #E6CC8E, husk shade #C9A660, tie #7A5A2E; fried catfish #B9772F, its top #D29A4E, lemon #F3D34A, rind #E2B526;
// shrimp #F08A5D, shell bands #D9663A, tail #E46E43.
//   A  three Delta hot tamales in their corn husks, tied as a bundle, on flag navy
//   B  a cornmeal-fried catfish fillet with a lemon wedge, on cream
//   C  a Gulf shrimp, side view, curled, on flag navy (the open curve and tail at the top right)
// Usage, from ms-eats/: swift scripts/icon-concepts.swift <out dir>   -> concept-{a,b,c}-1024.png
import AppKit
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

func rgb(_ hex: UInt32) -> CGColor {
    CGColor(srgbRed: CGFloat((hex >> 16) & 255) / 255, green: CGFloat((hex >> 8) & 255) / 255, blue: CGFloat(hex & 255) / 255, alpha: 1)
}
let NAVY: UInt32 = 0x00205B, RED: UInt32 = 0xBF0A30, CREAM: UInt32 = 0xF6F1E4, GOLD: UInt32 = 0xC9A84C
let HUSK: UInt32 = 0xE6CC8E, HUSK2: UInt32 = 0xC9A660, TIE: UInt32 = 0x7A5A2E
let FRY: UInt32 = 0xB9772F, FRYTOP: UInt32 = 0xD29A4E, LEMON: UInt32 = 0xF3D34A, RIND: UInt32 = 0xE2B526
let SHRIMP: UInt32 = 0xF08A5D, BAND: UInt32 = 0xD9663A, TAIL: UInt32 = 0xE46E43

func R(_ s: CGFloat, _ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ r: CGFloat) -> CGPath {
    CGPath(roundedRect: CGRect(x: x * s, y: y * s, width: w * s, height: h * s), cornerWidth: r * s, cornerHeight: r * s, transform: nil)
}
func P(_ s: CGFloat, _ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x * s, y: y * s) }

/// A: three tamales standing side by side in their husks, tied across the middle. CoreGraphics y-up.
func tamales(_ c: CGContext, _ s: CGFloat) {
    for (i, x) in [0.255, 0.405, 0.555].enumerated() {
        let y: CGFloat = i == 1 ? 0.150 : 0.165                       // the middle one stands a little taller
        let h: CGFloat = i == 1 ? 0.70 : 0.67
        c.setFillColor(rgb(HUSK)); c.addPath(R(s, CGFloat(x), y, 0.19, h, 0.07)); c.fillPath()
        c.setFillColor(rgb(HUSK2)); c.addPath(R(s, CGFloat(x) + 0.13, y + 0.03, 0.035, h - 0.06, 0.0175)); c.fillPath()   // the husk's fold
    }
    c.setFillColor(rgb(TIE)); c.addPath(R(s, 0.235, 0.455, 0.53, 0.06, 0.03)); c.fillPath()                              // the tie
}

/// B: a fried catfish fillet (a long rounded teardrop, its lighter top plane) and a lemon wedge.
func catfish(_ c: CGContext, _ s: CGFloat) {
    c.saveGState(); defer { c.restoreGState() }
    c.translateBy(x: 0, y: 0.022 * s)   // centred (check.swift)
    let fillet = CGMutablePath()
    fillet.move(to: P(s, 0.15, 0.47))
    fillet.addCurve(to: P(s, 0.52, 0.66), control1: P(s, 0.17, 0.62), control2: P(s, 0.36, 0.67))
    fillet.addCurve(to: P(s, 0.78, 0.50), control1: P(s, 0.66, 0.65), control2: P(s, 0.76, 0.58))
    fillet.addCurve(to: P(s, 0.50, 0.33), control1: P(s, 0.80, 0.40), control2: P(s, 0.66, 0.33))
    fillet.addCurve(to: P(s, 0.15, 0.47), control1: P(s, 0.32, 0.33), control2: P(s, 0.14, 0.38))
    fillet.closeSubpath()
    c.setFillColor(rgb(FRY)); c.addPath(fillet); c.fillPath()
    let top = CGMutablePath()   // the lighter, up-facing crust
    top.move(to: P(s, 0.20, 0.52))
    top.addCurve(to: P(s, 0.52, 0.64), control1: P(s, 0.24, 0.61), control2: P(s, 0.38, 0.645))
    top.addCurve(to: P(s, 0.74, 0.53), control1: P(s, 0.63, 0.635), control2: P(s, 0.71, 0.58))
    top.addCurve(to: P(s, 0.20, 0.52), control1: P(s, 0.55, 0.52), control2: P(s, 0.33, 0.50))
    top.closeSubpath()
    c.setFillColor(rgb(FRYTOP)); c.addPath(top); c.fillPath()
    // the lemon wedge: a half disc, rind below
    c.setFillColor(rgb(RIND)); c.fillEllipse(in: CGRect(x: 0.66 * s, y: 0.24 * s, width: 0.20 * s, height: 0.20 * s))
    c.setFillColor(rgb(LEMON)); c.fillEllipse(in: CGRect(x: 0.675 * s, y: 0.255 * s, width: 0.17 * s, height: 0.17 * s))
}

/// C: a Gulf shrimp, curled: a thick arc of body with round ends and shell bands, a fanned tail.
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

func render(_ n: Int, _ path: String, _ bg: UInt32, _ draw: (CGContext, CGFloat) -> Void) {
    let ctx = CGContext(data: nil, width: n, height: n, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
    ctx.setShouldAntialias(true)
    ctx.setFillColor(rgb(bg)); ctx.fill(CGRect(x: 0, y: 0, width: n, height: n))
    draw(ctx, CGFloat(n))
    let d = CGImageDestinationCreateWithURL(URL(fileURLWithPath: path) as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(d, ctx.makeImage()!, nil)
    guard CGImageDestinationFinalize(d) else { fatalError("could not write \(path)") }
    print("wrote", path)
}
let out = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "playbook/brand"
render(1024, out + "/concept-a-1024.png", NAVY, tamales)
render(1024, out + "/concept-b-1024.png", CREAM, catfish)
render(1024, out + "/concept-c-1024.png", NAVY, shrimp)
