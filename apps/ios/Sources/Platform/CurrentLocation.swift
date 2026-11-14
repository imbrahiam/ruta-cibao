import CoreLocation

/// Where the phone is right now, once, and only if location was already
/// allowed: it never raises the permission prompt. Forms use it to arrive
/// with "here" marked, since a road report is almost always about here.
enum CurrentLocation {
    static func once(timeout: Duration = .seconds(4)) async -> CLLocationCoordinate2D? {
        let status = CLLocationManager().authorizationStatus
        guard status == .authorizedWhenInUse || status == .authorizedAlways else { return nil }
        return await withTaskGroup(of: CLLocationCoordinate2D?.self) { group in
            group.addTask {
                do {
                    for try await update in CLLocationUpdate.liveUpdates() {
                        if let location = update.location { return location.coordinate }
                    }
                } catch {}
                return nil
            }
            group.addTask {
                try? await Task.sleep(for: timeout)
                return nil
            }
            let first = await group.next() ?? nil
            group.cancelAll()
            return first
        }
    }
}
