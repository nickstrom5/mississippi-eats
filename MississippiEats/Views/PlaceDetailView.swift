import SwiftUI
import MapKit

struct PlaceDetailView: View {
    @Environment(AppModel.self) private var model
    @Environment(LocationService.self) private var location
    let place: Place

    @State private var mapItem: MKMapItem?
    @State private var lookingUp = false
    @State private var notOnAppleMaps = false
    @State private var appleMapsFailed = false
    /// county records, any published inspection history, phone and website, from the place's region file (read when the place opens)
    @State private var detail: PlaceDetail?
    @State private var detailLoaded = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                header
                actions
                if let c = place.coordinate { mapSnippet(c) }
                if place.handChecked && (place.note != nil || place.dishes != nil || place.founded != nil || place.seasonal != nil) { checked }
                if place.hasHonors { honors }
                records
                inspections
                listing
            }
            .padding(16)
        }
        .background(Theme.surface)
        .inlineTitle(place.name)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button { model.toggleSaved(place) } label: {
                    Label(model.isSaved(place) ? "Saved" : "Save", systemImage: model.isSaved(place) ? "heart.fill" : "heart")
                }
                .accessibilityIdentifier("saveHeart")   // the Saved tab is also a "Saved" button
                ShareLink(item: Links.share(place), subject: Text(place.name), message: Text(Links.shareMessage(place))) {
                    Label("Share", systemImage: "square.and.arrow.up")
                }
            }
        }
        .task(id: place.id) {
            detailLoaded = false
            detail = await model.detail(for: place)
            detailLoaded = true
        }
        .mapItemDetailSheet(item: $mapItem)
        .alert("Not on Apple Maps", isPresented: $notOnAppleMaps) {
            Button("Open Apple Maps anyway") { AppleMaps.openInMaps(place) }
            Button("OK", role: .cancel) {}
        } message: {
            Text("Apple Maps doesn't have a listing for \(place.name) at this spot, so there are no ratings or hours to show here.")
        }
        .alert("Couldn't reach Apple Maps", isPresented: $appleMapsFailed) {
            Button("Try again") { lookUp() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Check your connection and try again.")
        }
    }

    /// Apple's place card for this place; "not on Apple Maps" only when Apple answered and had no listing here.
    private func lookUp() {
        lookingUp = true
        Task {
            let result = await AppleMaps.findItem(for: place)
            lookingUp = false
            switch result {
            case .found(let item): mapItem = item
            case .notListed: notOnAppleMaps = true
            case .failed: appleMapsFailed = true
            }
        }
    }

    // MARK: sections

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            // "BESSEMER · JEFFERSON COUNTY" (the data's county names already end in "County")
            Text((place.city ?? "Mississippi").uppercased() + (place.county.map { " · " + $0.uppercased() } ?? ""))
                .monoFont(12).tracking(0.4).foregroundStyle(Theme.green2)
            Text(place.name.uppercased())
                .displayFont(38).foregroundStyle(Theme.green)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            Text([place.fullAddress, place.cuisine].filter { !$0.isEmpty }.joined(separator: " · "))
                .font(.subheadline).foregroundStyle(Theme.ink2)
                .textSelection(.enabled)
            if let here = model.screenshotLocation ?? location.location, let l = place.location {
                Text("\(here.milesText(to: l)) away").font(.subheadline).foregroundStyle(Theme.muted)
            }
            PlaceChips(place: place)
        }
    }

    private var actions: some View {
        VStack(spacing: 10) {
            Button { lookUp() } label: {
                HStack {
                    if lookingUp { ProgressView().tint(.white) } else { Image(systemName: "star.bubble") }
                    Text("Ratings, hours & photos").fontWeight(.semibold)
                    Spacer()
                    Text("Apple Maps").font(.caption).foregroundStyle(Theme.goldSoft)
                }
                .padding(14)
                .foregroundStyle(.white)
                .background(RoundedRectangle(cornerRadius: 12).fill(Theme.green))
            }
            .disabled(place.coordinate == nil || lookingUp)
            .accessibilityHint("Opens the Apple Maps place card with current ratings and hours")

            HStack(spacing: 10) {
                actionButton("Directions", "arrow.triangle.turn.up.right.diamond") { AppleMaps.openInMaps(place, directions: true) }
                if let phone = detail?.ph, let url = URL(string: "tel:\(phone.filter { $0.isNumber || $0 == "+" })") {
                    actionButton("Call", "phone") { UIApplication.shared.open(url) }
                }
                if let web = detail?.website {
                    actionButton("Website", "safari") { UIApplication.shared.open(web) }
                }
            }
        }
    }

    private func actionButton(_ title: String, _ icon: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: icon).font(.title3)
                Text(title).font(.caption.weight(.semibold))
            }
            .frame(maxWidth: .infinity, minHeight: 56)
            .foregroundStyle(Theme.green)
            .background(RoundedRectangle(cornerRadius: 12).strokeBorder(Theme.rule2))
        }
    }

    private func mapSnippet(_ c: CLLocationCoordinate2D) -> some View {
        Map(initialPosition: .region(MKCoordinateRegion(center: c, latitudinalMeters: 900, longitudinalMeters: 900)), interactionModes: []) {
            Marker(place.name, systemImage: place.tags.contains(.catfish) || place.tags.contains(.poboys) ? "fish.fill" : "fork.knife", coordinate: c).tint(Theme.green)
        }
        .frame(height: 170)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .onTapGesture { AppleMaps.openInMaps(place) }
        .accessibilityLabel("Map of \(place.name). Opens Apple Maps.")
        .accessibilityAddTraits(.isButton)
    }

    private var checked: some View {
        section("Hand-checked") {
            VStack(alignment: .leading, spacing: 8) {
                if let note = place.note { Text(note).font(.subheadline).foregroundStyle(Theme.ink2) }
                if let d = place.dishes { fact("On the menu", d.components(separatedBy: "; ").joined(separator: ", ")) }
                if let f = place.founded {
                    fact("Open here since", "\(f)")
                    // the note explains the year; without a year it only repeated the description above
                    if let fn = place.foundedNote { Text(fn).font(.caption).foregroundStyle(Theme.ink2) }
                }
                if let sea = place.seasonal { fact("Season", sea) }
                                Text("Checked by hand against a 2025 or 2026 source: a state or local tourism list, the MICHELIN Guide, or a dated local story. Menus and hours change, so check before you go.")
                    .font(.caption).foregroundStyle(Theme.ink2)
            }
        }
    }

    private var honors: some View {
        section("Honors") {
            VStack(alignment: .leading, spacing: 8) {
                if let m = place.michelin.label {
                    Label(m + " · MICHELIN Guide", systemImage: "rosette").font(.subheadline).foregroundStyle(Theme.ink)
                }
                ForEach(lines(place.jamesBeard, prefix: "James Beard: "), id: \.self) { l in
                    Label(l, systemImage: "rosette").font(.subheadline).foregroundStyle(Theme.ink)
                }
                Text("Honors are facts, not ratings. James Beard Foundation and James Beard Award are trademarks of the James Beard Foundation.")
                    .font(.caption).foregroundStyle(Theme.muted)
            }
        }
    }

    /// MSDH posts each inspection's grade (A, B or C): shown as posted, with its date and labeled official, never one of ours.
    private var inspections: some View {
        section("Health inspections") {
            VStack(alignment: .leading, spacing: 8) {
                if let ins = place.inspection, let res = model.resultText(ins.result),
                   let code = model.jurisdictionName(ins.jurisdiction), let list = Links.scoreList(code) {
                    kv("Latest grade (official)", "\(res) · \(DayFormat.text(ins.date) ?? ins.date)")
                    kv("Graded by", list.name)
                    Text(gradeNote(res)).font(.caption).foregroundStyle(Theme.muted)
                    Link(destination: list.url) {
                        Label("MSDH's food facility search", systemImage: "arrow.up.right.square").font(.subheadline.weight(.semibold))
                    }
                    .foregroundStyle(Theme.green)
                } else {
                    Text("The Mississippi State Department of Health inspects all food service in the state, but this place isn't matched to a grade in its records, so no grade is shown. This app computes no grade.")
                        .font(.caption).foregroundStyle(Theme.muted)
                    Link(destination: Links.inspections) {
                        Label("Search MSDH's food facilities", systemImage: "arrow.up.right.square").font(.subheadline.weight(.semibold))
                    }
                    .foregroundStyle(Theme.green)
                }
            }
        }
    }

    /// MSDH's own definitions of its grades, and the records' date.
    private func gradeNote(_ grade: String) -> String {
        let through = model.inspectionsThrough["msdh"].flatMap { DayFormat.text($0) }
        let meaning = switch grade {
        case "A": "A: no critical violations."
        case "B": "B: critical violations corrected during the inspection."
        case "C": "C: critical violations not corrected during the inspection, or repeated from the last one; fixes are due within 10 days, then a re-inspection."
        default: ""
        }
        return "MSDH's own grade for its latest inspection, as posted in the restaurant" + (through.map { " (records through \($0))" } ?? "")
            + ". " + meaning + " MSDH: \"Data are for informational purposes, not enforcement.\" An older grade may not reflect the place today."
    }

    private var records: some View {
        section("Official records") {
            VStack(alignment: .leading, spacing: 8) {
                if let ls = detail?.licenses, !ls.isEmpty {
                    ForEach(ls, id: \.self) { l in
                        kv(l.source, [l.type, l.id.map { "No. " + Self.unbroken($0) }].compactMap { $0 }.joined(separator: " · ").nonEmpty ?? "On the list")
                    }
                } else {
                    kv("License record", detailLoaded ? "—" : "…")
                }
                kv("Serves alcohol", place.servesAlcohol ? "Licensed to serve on the premises" : "—")
                Text(recordsNote).font(.caption).foregroundStyle(Theme.muted)
            }
        }
    }

    private var listing: some View {
        section("How we know it's here") {
            VStack(alignment: .leading, spacing: 8) {
                kv("Listed as", place.tier.label)
                if place.tier == .licensed { kv("Official record", detail?.licenses.first?.source ?? "County record") }
                if place.chainCount >= 2 { kv("Locations in Mississippi", place.chainCount.formatted()) }
                Text(listingNote).font(.caption).foregroundStyle(Theme.muted)
            }
        }
    }

    /// "0054748", never broken across lines
    private static func unbroken(_ id: String) -> String { id.replacingOccurrences(of: "-", with: "\u{2011}") }

    /// Where the records come from; a missing record is unknown, not "no license".
    private var recordsNote: String {
        "The Department of Revenue's alcohol permits are only searchable, and many counties are dry or partly dry, so this app shows no alcohol status: \u{2014} means unknown, never \"no\"."
    }

    private var listingNote: String {
        let checked = place.handChecked
        if place.source == "research" {
            return "On our hand-checked list (checked against a 2025 or 2026 source). The open map data didn't list it as a place to eat, so it's placed from its own map listing or street address."
        }
        switch place.tier {
        case .licensed:
            return place.source == "official"
                ? "From a county's official list. The open map data didn't have it, so it's placed on its listed street address."
                : "Matched to a county's official list."
        case .confirmed, .listing:
            let base = place.tier == .confirmed
                ? "A high-confidence listing in Overture's open map data."
                : "A single listing in Overture's open map data, so it may be closed or misfiled."
            return base + (checked ? " It's also on our hand-checked list, checked against a 2025 or 2026 source." : "")
        }
    }

    // MARK: helpers

    private func lines(_ s: String?, prefix: String) -> [String] {
        (s ?? "").components(separatedBy: "; ").filter { !$0.isEmpty }.map { prefix + $0 }
    }

    private func section<Content: View>(_ title: String, @ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title.uppercased()).font(.caption.weight(.bold)).tracking(1).foregroundStyle(Theme.ink2)
            Divider()
            content()
        }
    }

    private func fact(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.ink)
            Text(value).font(.subheadline).foregroundStyle(Theme.ink2)
        }
    }

    @ViewBuilder
    private func kv(_ k: String, _ v: String?) -> some View {
        if let v {
            HStack(alignment: .firstTextBaseline) {
                Text(k).font(.subheadline).foregroundStyle(Theme.ink2)
                Spacer(minLength: 12)
                Text(v).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.ink).multilineTextAlignment(.trailing)
            }
        }
    }
}

extension String {
    var nonEmpty: String? { isEmpty ? nil : self }
}
