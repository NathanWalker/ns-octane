import type * as React from 'react';
import type { NativeScriptElements } from './elements';

/**
 * TypeScript reads the JSX namespace from `<jsxImportSource>/jsx-runtime`, so
 * pointing `jsxImportSource` here replaces React's HTML/SVG intrinsics wholesale
 * instead of merging with them. Augmenting `React.JSX.IntrinsicElements` cannot
 * work: `button`, `image`, `label`, `progress`, `span`, `switch` and `webview`
 * already exist there, and redeclaring a key with a different type is an error.
 *
 * This is type-only. Vite drives the actual transform from
 * `esbuild.jsxImportSource: 'react'` in `@nativescript/vite/react`, so the
 * emitted runtime import stays `react/jsx-runtime`.
 */
export { Fragment, jsx, jsxs } from 'react/jsx-runtime';

export namespace JSX {
	type ElementType = string | React.JSXElementConstructor<any>;
	interface Element extends React.JSX.Element {}
	interface ElementClass extends React.JSX.ElementClass {}
	interface ElementAttributesProperty extends React.JSX.ElementAttributesProperty {}
	interface ElementChildrenAttribute extends React.JSX.ElementChildrenAttribute {}
	type LibraryManagedAttributes<C, P> = React.JSX.LibraryManagedAttributes<C, P>;
	interface IntrinsicAttributes extends React.JSX.IntrinsicAttributes {}
	interface IntrinsicClassAttributes<T> extends React.JSX.IntrinsicClassAttributes<T> {}
	interface IntrinsicElements extends NativeScriptElements {}
}
