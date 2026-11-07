import Foundation
import CoreLocation
import UIKit

/// `-screenshot <name>` opens one screen with fixed state for App Store screenshots (scripts/capture-screenshots.sh).
/// Names: home, tamales, catfish, poboys, plates, comeback, honors, oldest, inspections, detail, map, saved, about.
enum ScreenshotMode {
    /// Debug builds only: an App Store build ignores the launch argument, so no one can reach seeded screens or fake locations.
    static var name: String? {
        #if DEBUG
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: "-screenshot"), i + 1 < args.count else { return nil }
        return args[i + 1]
        #else
        return nil
        #endif
    }
    static var isActive: Bool { name != nil }

    @MainActor
    static func apply(to model: AppModel) {
        guard let name, model.isLoaded else { return }
        model.filters = Filters()
        // Jackson's Fondren, among the most picks, so "nearest" lists have distances without a permission prompt
        model.screenshotLocation = CLLocation(latitude: 32.3330, longitude: -90.1760)
        // by name and town, ignoring case, so a rebuild with a slightly different casing still finds the place; the hand-checked one first
        let pick = { (n: String, town: String?) -> Place? in
            let hits = model.places.filter { $0.name.caseInsensitiveCompare(n) == .orderedSame && (town == nil || $0.city == town) }
            return hits.first(where: \.handChecked) ?? hits.first
        }
        for p in [pick("Doe's Eat Place", "Greenville"), pick("Mayflower Café", "Jackson"), pick("Taylor Grocery", "Taylor")]
            .compactMap({ $0 }) where !model.isSaved(p) {
            model.toggleSaved(p)
        }
        let open = { (g: Guide) in model.tab = .guides; model.selectedGuide = g; model.guidesPath = [.guide(g)] }
        switch name {
        case "tamales": open(.tamales)
        case "catfish": open(.catfish)
        case "poboys":
            // Ocean Springs, among the coast's po'boys and oyster bars
            model.screenshotLocation = CLLocation(latitude: 30.4113, longitude: -88.8278)
            open(.poboys)
        case "plates": open(.plates)
        case "comeback": open(.comeback)
        case "honors": open(.honors)
        case "oldest": open(.oldest)
        case "inspections": open(.inspections)
        case "detail":
            // Doe's Eat Place: a James Beard America's Classic on the hot tamale list, seen from across Greenville (about a mile off)
            model.screenshotLocation = CLLocation(latitude: 33.3960, longitude: -91.0470)
            open(.tamales)
            if let p = pick("Doe's Eat Place", "Greenville") ?? model.places.first {
                model.selectedPlace = p; model.guidesPath.append(.place(p))
            }
        case "map":
            // downtown Jackson to Belhaven: the Mayflower, Big Apple Inn, Hal & Mal's and Elvie's within a few blocks, so the shot shows pins
            model.screenshotLocation = CLLocation(latitude: 32.3060, longitude: -90.1810)
            model.tab = .map
        case "saved": model.tab = .saved
        case "about": model.tab = .about
        default: model.tab = .guides; model.selectedGuide = nil
        }
        // iPad shows the place column next to every list, so give each shot a place instead of "Pick a place": a different
        // honored or hand-checked one per shot.
        guard UIDevice.current.userInterfaceIdiom == .pad, model.selectedPlace == nil else { return }
        let place: Place? = switch name {
        case "home": pick("Doe's Eat Place", "Greenville")
        case "tamales": pick("Hicks' World Famous Tamales", "Clarksdale")
        case "catfish": pick("Taylor Grocery", "Taylor")
        case "poboys": pick("Bacchus on the Beach", "Pass Christian")
        case "plates": pick("Bully's Restaurant", "Jackson")
        case "comeback": pick("Mayflower Café", "Jackson")
        case "honors": pick("Elvie's", "Jackson")
        case "oldest": pick("Mayflower Café", "Jackson")
        case "inspections": pick("Mayflower Café", "Jackson")
        case "map": pick("Elvie's", "Jackson")
        case "saved": pick("Doe's Eat Place", "Greenville")
        case "about": nil
        default: pick("Doe's Eat Place", "Greenville")
        }
        model.selectedPlace = place
    }
}
