import Foundation
import RutaKit

extension KotlinInstant {
    var date: Date { Date(timeIntervalSince1970: TimeInterval(toEpochMilliseconds()) / 1000) }
}

/// "3 h", "2 sem": the shortest honest age for a list row.
enum CompactTime {
    private static let formatter: DateComponentsFormatter = {
        let f = DateComponentsFormatter()
        f.unitsStyle = .short
        f.maximumUnitCount = 1
        f.allowedUnits = [.minute, .hour, .day, .weekOfMonth, .month, .year]
        return f
    }()

    static func since(_ date: Date) -> String {
        formatter.string(from: max(60, Date.now.timeIntervalSince(date))) ?? ""
    }
}

func shareURL(_ slug: String) -> URL { URL(string: "https://rutacibao.app/consultas/\(slug)")! }

extension ConsultationsBrowseInput.Status {
    var label: String {
        switch self {
        case .open: L10n.Consultations.StatusLabel.open
        case .inReview: L10n.Consultations.StatusLabel.in_review
        case .answered: L10n.Consultations.StatusLabel.answered
        case .resolved: L10n.Consultations.StatusLabel.resolved
        case .rejected: L10n.Consultations.StatusLabel.rejected
        }
    }
}

extension ConsultationsRespondInput.StatusAfter {
    var label: String {
        switch self {
        case .inReview: L10n.Consultations.StatusLabel.in_review
        case .answered: L10n.Consultations.StatusLabel.answered
        case .resolved: L10n.Consultations.StatusLabel.resolved
        case .rejected: L10n.Consultations.StatusLabel.rejected
        }
    }
}

// Kotlin typealiases do not cross the bridge; these keep the screens readable.
typealias Consultation = ConsultationsBrowseOutput.Item
typealias ConsultationDetail = ConsultationsDetailOutput
typealias Comment = CommentsListOutput.Item
