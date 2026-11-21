import SwiftUI
import UIKit

/// The status bar's ink. SwiftUI has no say over it without a navigation bar, and the tabs carry
/// their own green header, so the window's root is wrapped in a controller that answers for it:
/// light while a brand header is on screen, dark otherwise.
enum StatusBar {
    /// Brand headers on show. A pushed page or a turn-by-turn overlay takes the header away,
    /// and the clock goes back to dark.
    static var brandHeaders = 0 { didSet { host?.setNeedsStatusBarAppearanceUpdate() } }
    /// White screens laid over the tabs (the first-run welcome) while a header stays mounted below.
    static var whiteCovers = 0 { didSet { host?.setNeedsStatusBarAppearanceUpdate() } }
    fileprivate static weak var host: Host?

    fileprivate final class Host: UIViewController {
        private let content: UIViewController

        init(wrapping content: UIViewController) {
            self.content = content
            super.init(nibName: nil, bundle: nil)
        }

        @available(*, unavailable)
        required init?(coder: NSCoder) { fatalError("init(coder:) is not used") }

        override func viewDidLoad() {
            super.viewDidLoad()
            addChild(content)
            content.view.frame = view.bounds
            content.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            view.addSubview(content.view)
            content.didMove(toParent: self)
        }

        override var preferredStatusBarStyle: UIStatusBarStyle { StatusBar.brandHeaders > 0 && StatusBar.whiteCovers == 0 ? .lightContent : .darkContent }
        override var childForStatusBarStyle: UIViewController? { nil }
        override var childForHomeIndicatorAutoHidden: UIViewController? { content }
    }

    /// Sits in the shell; once it reaches a window it wraps that window's root, once.
    struct Anchor: UIViewRepresentable {
        func makeUIView(context: Context) -> UIView { Probe() }
        func updateUIView(_ view: UIView, context: Context) {}

        private final class Probe: UIView {
            override func didMoveToWindow() {
                super.didMoveToWindow()
                guard let window, let root = window.rootViewController, !(root is Host) else { return }
                let host = Host(wrapping: root)
                window.rootViewController = host
                StatusBar.host = host
            }
        }
    }
}

private struct LightStatusBar: ViewModifier {
    func body(content: Content) -> some View {
        content
            .onAppear { StatusBar.brandHeaders += 1 }
            .onDisappear { StatusBar.brandHeaders -= 1 }
    }
}

private struct DarkStatusBar: ViewModifier {
    func body(content: Content) -> some View {
        content
            .onAppear { StatusBar.whiteCovers += 1 }
            .onDisappear { StatusBar.whiteCovers -= 1 }
    }
}

extension View {
    /// The status bar reads in white while this view is on screen.
    func lightStatusBar() -> some View { modifier(LightStatusBar()) }
    /// The status bar reads in ink while this white overlay covers a green header.
    func darkStatusBar() -> some View { modifier(DarkStatusBar()) }
}
