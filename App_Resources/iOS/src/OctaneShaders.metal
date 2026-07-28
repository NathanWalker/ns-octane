#include <metal_stdlib>
using namespace metal;

// Stitchable shaders for SwiftUI's `.distortionEffect` / `.colorEffect` (iOS 17+).
// SwiftUI supplies the leading parameters — `position` for a distortion, plus
// `color` for a colour effect — and appends the arguments passed at the call
// site in `OctaneLogo.swift`.

/// Rising heat haze.
///
/// A distortion shader maps a destination pixel back to the source pixel it
/// should sample, so the returned offset reads as the image bending. Amplitude
/// is weighted by `base^2` (1 at the bottom, 0 at the top) so the mark shimmers
/// like air over hot metal instead of wobbling as a rigid block, and the two
/// waves use incommensurate frequencies so the pattern never visibly repeats.
[[ stitchable ]] float2 octaneHeatHaze(float2 position, float time, float2 size, float intensity) {
	float2 uv = position / size;
	float base = 1.0 - uv.y;
	float wave = sin(uv.y * 26.0 - time * 3.1) * 0.6
	           + sin(uv.y * 11.0 - time * 1.9 + uv.x * 4.0) * 0.4;
	float amp = 2.4 * base * base * intensity;
	return position + float2(wave * amp, 0.0);
}

/// Ember sheen sweeping diagonally across the ink.
///
/// SwiftUI hands colour effects premultiplied alpha, so the colour has to be
/// un-premultiplied before mixing and re-premultiplied on the way out —
/// blending straight into premultiplied RGB would bleed the highlight into the
/// transparent surround and halo the glyph edges.
[[ stitchable ]] half4 octaneSheen(float2 position, half4 color, float time, float2 size, float intensity) {
	if (color.a < 0.004h) {
		return color;
	}
	half3 rgb = color.rgb / color.a;

	float2 uv = position / size;
	float sweep = fract(time * 0.22);
	float d = (uv.x * 0.85 + (1.0 - uv.y) * 0.35) - (sweep * 1.8 - 0.4);
	float band = exp(-(d * d) * 42.0);

	half3 ember = half3(1.0h, 0.255h, 0.353h); // the logo's #FF415A accent
	half3 gold = half3(1.0h, 0.72h, 0.36h);
	half3 hot = mix(ember, gold, half(band));

	half glow = half(band) * half(intensity);
	rgb = mix(rgb, hot, glow * 0.9h);
	rgb += half3(glow * 0.25h);

	return half4(saturate(rgb) * color.a, color.a);
}
