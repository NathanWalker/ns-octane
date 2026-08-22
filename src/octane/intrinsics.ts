/**
 * JSX intrinsic elements for the NativeScript renderer.
 *
 * Tag names are all-lowercase, matching the keys the driver's element registry
 * instantiates. Props are derived from the installed `@nativescript/core` view
 * classes, so inherited attributes come along for free and the set tracks the
 * core version in `package.json` rather than a hand-maintained list.
 *
 * TypeScript resolves this namespace through the `jsxImportSource` mapping in
 * `tsconfig.json`; the Octane compiler resolves it through `intrinsics` in
 * `src/octane/config.ts`.
 */
import type * as NS from '@nativescript/core';
import type { SwiftUI } from '@nativescript/swift-ui';
import type { Embers } from '../elements/embers';

export type NativeScriptNode = unknown;

type Ref<TInstance> = ((instance: TInstance | null) => void) | { current: TInstance | null } | null;

/**
 * The driver assigns every non-event prop onto the view instance, so a JSX
 * attribute is a NativeScript view property rather than a DOM attribute.
 */
type ViewProperties<TInstance> = {
	[K in keyof TInstance as TInstance[K] extends (...args: never[]) => unknown ? never : K]?: TInstance[K];
};

/** NativeScript hands the raw event payload to the listener. */
type NSEventData<TInstance> = NS.EventData & { object: TInstance };

type NSGestureData<TInstance> = NS.GestureEventData & { object: TInstance };

/** NativeScript declares each event as a `static <name>Event` on the view class. */
type EventNames<TClass> = {
	[K in keyof TClass]: K extends `${infer Name}Event` ? Name : never;
}[keyof TClass];

type DerivedEvents<TClass, TInstance> = {
	[Name in Extract<EventNames<TClass>, string> as `on${Capitalize<Name>}`]?: (
		event: NSEventData<TInstance>,
	) => void;
};

/**
 * Gestures are available on every view rather than declared as `static …Event`,
 * and the driver aliases a few web-shaped names onto NativeScript events.
 */
interface CommonEvents<TInstance> {
	onTap?: (event: NSGestureData<TInstance>) => void;
	/** Alias for `tap`. */
	onClick?: (event: NSGestureData<TInstance>) => void;
	/** Alias for `tap`. */
	onPress?: (event: NSGestureData<TInstance>) => void;
	onDoubleTap?: (event: NSGestureData<TInstance>) => void;
	onLongPress?: (event: NSGestureData<TInstance>) => void;
	onSwipe?: (event: NS.SwipeGestureEventData) => void;
	onPan?: (event: NS.PanGestureEventData) => void;
	onPinch?: (event: NS.PinchGestureEventData) => void;
	onRotation?: (event: NS.RotationGestureEventData) => void;
	onTouch?: (event: NS.TouchGestureEventData) => void;
	/** Alias for `textChange`. */
	onChange?: (event: NSEventData<TInstance>) => void;
	/** Alias for `returnPress`. */
	onSubmit?: (event: NSEventData<TInstance>) => void;
	onFocus?: (event: NSEventData<TInstance>) => void;
	onBlur?: (event: NSEventData<TInstance>) => void;
}

interface CommonAttributes {
	/** Resolved against `app.css`. */
	className?: string;
	class?: string;
	/** A string is parsed as inline CSS; an object is assigned onto `view.style`. */
	style?: string | Partial<NS.Style>;

	/**
	 * Attached layout properties. The layout modules register these on `View` at
	 * runtime, so they are absent from the `@nativescript/core` class typings.
	 */
	row?: number | string;
	col?: number | string;
	rowSpan?: number | string;
	colSpan?: number | string;
	dock?: 'top' | 'right' | 'bottom' | 'left';
	left?: number | string;
	top?: number | string;
	flexGrow?: number | string;
	flexShrink?: number | string;
	flexWrapBefore?: boolean | string;
	alignSelf?: 'auto' | 'flex-start' | 'flex-end' | 'center' | 'baseline' | 'stretch';
	order?: number | string;
}

interface OctaneAttributes<TInstance> {
	key?: string | number;
	ref?: Ref<TInstance> | readonly Ref<TInstance>[];
	children?: NativeScriptNode;
}

type Overridden = keyof CommonAttributes | keyof OctaneAttributes<unknown> | keyof CommonEvents<unknown>;

type Attributes<TClass extends abstract new (...args: never[]) => unknown> = Omit<
	ViewProperties<InstanceType<TClass>> & DerivedEvents<TClass, InstanceType<TClass>>,
	Overridden
> &
	CommonAttributes &
	CommonEvents<InstanceType<TClass>> &
	OctaneAttributes<InstanceType<TClass>>;

export interface NativeScriptElements {
	absolutelayout: Attributes<typeof NS.AbsoluteLayout>;
	actionbar: Attributes<typeof NS.ActionBar>;
	actionitem: Attributes<typeof NS.ActionItem>;
	activityindicator: Attributes<typeof NS.ActivityIndicator>;
	button: Attributes<typeof NS.Button>;
	contentview: Attributes<typeof NS.ContentView>;
	datepicker: Attributes<typeof NS.DatePicker>;
	docklayout: Attributes<typeof NS.DockLayout>;
	flexboxlayout: Attributes<typeof NS.FlexboxLayout>;
	formattedstring: Attributes<typeof NS.FormattedString>;
	frame: Attributes<typeof NS.Frame>;
	gridlayout: Attributes<typeof NS.GridLayout>;
	htmlview: Attributes<typeof NS.HtmlView>;
	image: Attributes<typeof NS.Image>;
	label: Attributes<typeof NS.Label>;
	listpicker: Attributes<typeof NS.ListPicker>;
	listview: Attributes<typeof NS.ListView>;
	navigationbutton: Attributes<typeof NS.NavigationButton>;
	page: Attributes<typeof NS.Page>;
	placeholder: Attributes<typeof NS.Placeholder>;
	progress: Attributes<typeof NS.Progress>;
	proxyviewcontainer: Attributes<typeof NS.ProxyViewContainer>;
	rootlayout: Attributes<typeof NS.RootLayout>;
	scrollview: Attributes<typeof NS.ScrollView>;
	searchbar: Attributes<typeof NS.SearchBar>;
	segmentedbar: Attributes<typeof NS.SegmentedBar>;
	segmentedbaritem: Attributes<typeof NS.SegmentedBarItem>;
	slider: Attributes<typeof NS.Slider>;
	span: Attributes<typeof NS.Span>;
	stacklayout: Attributes<typeof NS.StackLayout>;
	switch: Attributes<typeof NS.Switch>;
	tabview: Attributes<typeof NS.TabView>;
	tabviewitem: Attributes<typeof NS.TabViewItem>;
	textfield: Attributes<typeof NS.TextField>;
	textview: Attributes<typeof NS.TextView>;
	timepicker: Attributes<typeof NS.TimePicker>;
	webview: Attributes<typeof NS.WebView>;
	wraplayout: Attributes<typeof NS.WrapLayout>;

	/** `@nativescript/swift-ui` host. `swiftId` selects a registered provider. */
	swiftui: Omit<Attributes<typeof NS.ContentView>, 'children' | 'ref'> & {
		swiftId: string;
		/** Sent to the provider's `updateData(data:)`. */
		data?: Record<string, unknown>;
		onSwiftUIEvent?: (event: NS.EventData & { data: unknown }) => void;
		ref?: ((instance: SwiftUI | null) => void) | { current: SwiftUI | null } | null;
	};

	/** Rising ember particles — an element this app defines itself; see `src/elements/embers.ts`. */
	embers: Attributes<typeof Embers>;
}

export namespace JSX {
	export interface IntrinsicElements extends NativeScriptElements {}
	export interface ElementChildrenAttribute {
		children: {};
	}
	export type Element = unknown;
	export type ElementType = string | ((props: any) => unknown);
}
