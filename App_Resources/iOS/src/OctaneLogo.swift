import SwiftUI
import UIKit

/// Bridges NativeScript's `data` property onto SwiftUI's observation system.
final class OctaneLogoModel: ObservableObject {
	@Published var intensity: Double = 1.0

	/// Monotonic token from NativeScript. Only a *change* arms a burst, so the
	/// same value arriving again (any unrelated `data` update) is inert.
	@Published private(set) var burstToken: Int = 0

	private var burstStart: Date?
	private let burstDuration: TimeInterval = 1.15

	func arm(token: Int) {
		guard token != burstToken else { return }
		burstToken = token
		// Timing lives here rather than in JavaScript: the bridge only says
		// "go", and the 60fps ramp stays on the UI thread.
		burstStart = Date()
	}

	func burstProgress(at date: Date) -> Double {
		guard let start = burstStart else { return 0 }
		let elapsed = date.timeIntervalSince(start)
		return elapsed >= burstDuration ? 0 : elapsed / burstDuration
	}
}

struct OctaneLogoView: View {
	@ObservedObject var model: OctaneLogoModel
	var onTap: () -> Void

	/// `TimelineView` reports absolute dates; the shaders need a small elapsed
	/// value. Feeding `timeIntervalSinceReferenceDate` straight to a `float`
	/// uniform would quantise it to ~60s steps at that magnitude and freeze the
	/// animation.
	private let start = Date()

	var body: some View {
		TimelineView(.animation) { context in
			let time = context.date.timeIntervalSince(start)
			let burst = model.burstProgress(at: context.date)

			// The padding sits outside the reader so `geometry.size` is the box
			// the artwork actually occupies — the shaders normalise position by
			// it, and measuring the unpadded width would skew every uv.
			GeometryReader { geometry in
				Image("octane")
					.resizable()
					.scaledToFit()
					.frame(width: geometry.size.width, height: geometry.size.height)
					.distortionEffect(
						ShaderLibrary.octaneHeatHaze(
							.float(time),
							.float2(geometry.size),
							.float(model.intensity)
						),
						// Must cover the shader's peak offset or SwiftUI clips
						// the sampled region and the edges tear.
						maxSampleOffset: CGSize(width: 8, height: 8)
					)
					.colorEffect(
						ShaderLibrary.octaneSheen(
							.float(time),
							.float2(geometry.size),
							.float(model.intensity)
						)
					)
					// Layered last so the shatter samples the already-hazed,
					// already-lit mark rather than the flat artwork.
					.layerEffect(
						ShaderLibrary.octaneShatter(
							.float2(geometry.size),
							.float(burst)
						),
						maxSampleOffset: CGSize(width: 140, height: 90)
					)
			}
			.padding(.horizontal, 24)
		}
		.contentShape(Rectangle())
		.onTapGesture(perform: onTap)
	}
}

@objc
class OctaneLogoProvider: UIViewController, SwiftUIProvider {
	required init?(coder aDecoder: NSCoder) {
		super.init(coder: aDecoder)
	}

	required init() {
		super.init(nibName: nil, bundle: nil)
	}

	private let model = OctaneLogoModel()

	override func viewDidLoad() {
		super.viewDidLoad()
		setupSwiftUIView(
			content: OctaneLogoView(model: model) { [weak self] in
				self?.onEvent?(["action": "tapped"])
			}
		)
	}

	/// Receive data from NativeScript.
	func updateData(data: NSDictionary) {
		if let intensity = data["intensity"] as? NSNumber {
			model.intensity = intensity.doubleValue
		}
		if let burst = data["burst"] as? NSNumber {
			model.arm(token: burst.intValue)
		}
	}

	/// Allow sending of data to NativeScript.
	var onEvent: ((NSDictionary) -> ())?
}
