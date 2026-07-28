/**
 * Serializable compiler metadata for the NativeScript renderer.
 *
 * Loaded by `vite.config.ts` on the Node side, so it must not import
 * `@nativescript/core` or an Octane runtime.
 */
export const NATIVESCRIPT_RENDERER_ID = 'nativescript';

export const nativeScriptRenderer = {
	module: '/src/octane/renderer.ts',
	target: 'universal',
	/** There is no server half of a NativeScript app. */
	server: 'unsupported',
	intrinsics: '/src/octane/intrinsics.ts',
	/** `<label>text</label>` lowers to a `#text` host the driver folds into the parent's `text`. */
	text: 'host',
} as const;

/**
 * Scoped to `.tsx` rather than set as `default` so the renderer's own plain
 * `.ts` modules stay unowned — a `server: 'unsupported'` renderer cannot own
 * them, and the compiler rejects the config if a rule selects one.
 */
export const nativeScriptRenderers = {
	registry: { [NATIVESCRIPT_RENDERER_ID]: nativeScriptRenderer },
	rules: [{ include: 'src/**/*.tsx', renderer: NATIVESCRIPT_RENDERER_ID }],
} as const;

export default nativeScriptRenderers;
