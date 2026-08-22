import { Property, View, isIOS } from '@nativescript/core';

/**
 * `<embers heat={n} />` — glowing particles rising from the bottom edge.
 *
 * Written against the platform directly: a `CAEmitterLayer` on iOS, a radial
 * glow drawable on Android. No plugin, no native build — the whole element is
 * this file, so it can be registered into a running app by a hot update.
 */

/** Particles per second scale, 0 switches the emitter off. */
export const heatProperty = new Property<Embers, number>({
	name: 'heat',
	defaultValue: 1,
	valueConverter: Number,
});

const EMBER_COLOR = { r: 1, g: 0.42, b: 0.12 };

function sparkImage(): UIImage {
	const size = CGSizeMake(24, 24);
	const renderer = UIGraphicsImageRenderer.alloc().initWithSize(size);
	return renderer.imageWithActions((context) => {
		const cg = context.CGContext;
		const colors = NSArray.arrayWithArray([
			UIColor.alloc().initWithRedGreenBlueAlpha(1, 0.92, 0.7, 1).CGColor,
			UIColor.alloc().initWithRedGreenBlueAlpha(EMBER_COLOR.r, EMBER_COLOR.g, EMBER_COLOR.b, 0.9).CGColor,
			UIColor.alloc().initWithRedGreenBlueAlpha(EMBER_COLOR.r, EMBER_COLOR.g, EMBER_COLOR.b, 0).CGColor,
		]);
		const gradient = CGGradientCreateWithColors(CGColorSpaceCreateDeviceRGB(), colors as any, null as any);
		const center = CGPointMake(12, 12);
		CGContextDrawRadialGradient(cg, gradient, center, 0, center, 12, CGGradientDrawingOptions.kCGGradientDrawsAfterEndLocation);
	});
}

export class Embers extends View {
	heat: number;
	private emitter: CAEmitterLayer | null = null;

	createNativeView(): any {
		if (isIOS) {
			const view = UIView.new();
			view.userInteractionEnabled = false;
			const emitter = CAEmitterLayer.layer();
			emitter.emitterShape = kCAEmitterLayerLine;
			emitter.renderMode = kCAEmitterLayerAdditive;
			const cell = CAEmitterCell.emitterCell();
			cell.contents = sparkImage().CGImage;
			cell.lifetime = 2.4;
			cell.lifetimeRange = 0.8;
			cell.velocity = 90;
			cell.velocityRange = 40;
			cell.emissionLongitude = -Math.PI / 2;
			cell.emissionRange = Math.PI / 8;
			cell.yAcceleration = -30;
			cell.scale = 0.22;
			cell.scaleRange = 0.14;
			cell.scaleSpeed = -0.07;
			cell.alphaSpeed = -0.4;
			cell.spin = 1.2;
			cell.spinRange = 2;
			emitter.emitterCells = NSArray.arrayWithObject(cell);
			view.layer.addSublayer(emitter);
			this.emitter = emitter;
			return view;
		}
		const glow = new android.graphics.drawable.GradientDrawable();
		glow.setShape(android.graphics.drawable.GradientDrawable.OVAL);
		glow.setGradientType(android.graphics.drawable.GradientDrawable.RADIAL_GRADIENT);
		glow.setColors([android.graphics.Color.argb(200, 255, 107, 31), android.graphics.Color.argb(0, 255, 107, 31)]);
		const view = new android.view.View(this._context);
		view.setBackground(glow);
		return view;
	}

	disposeNativeView(): void {
		this.emitter = null;
		super.disposeNativeView();
	}

	onLayout(left: number, top: number, right: number, bottom: number): void {
		super.onLayout(left, top, right, bottom);
		const emitter = this.emitter;
		if (emitter === null) return;
		const bounds = (this.nativeViewProtected as unknown as UIView).bounds.size;
		emitter.frame = CGRectMake(0, 0, bounds.width, bounds.height);
		emitter.emitterPosition = CGPointMake(bounds.width / 2, bounds.height);
		emitter.emitterSize = CGSizeMake(bounds.width * 0.55, 1);
		this.applyHeat();
	}

	[heatProperty.setNative](value: number): void {
		this.applyHeat(value);
	}

	private applyHeat(value: number = this.heat): void {
		const emitter = this.emitter;
		if (emitter === null) return;
		const cell = emitter.emitterCells?.firstObject as CAEmitterCell | undefined;
		if (cell) cell.birthRate = 0;
		emitter.birthRate = Math.max(0, value);
		// A cell's birthRate is read when the cell is installed, so re-install.
		if (cell) {
			cell.birthRate = 26;
			emitter.emitterCells = NSArray.arrayWithObject(cell);
		}
		if (isIOS) {
			const glow = (this.nativeViewProtected as unknown as UIView).layer;
			glow.opacity = value > 0 ? 1 : 0;
		}
	}
}

heatProperty.register(Embers);
