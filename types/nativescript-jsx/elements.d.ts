import type * as NS from '@nativescript/core';
import type { Key, ReactNode, Ref } from 'react';

/**
 * Tag names are all-lowercase because `@nativescript-community/react` aliases
 * dominative's PascalCase registry with a single `tag.toLowerCase()` pass. There
 * is no camelCase alias — `<gridLayout>` resolves to nothing and renders blank.
 */

/**
 * The renderer applies non-event props with `setAttribute(name, value)`, which
 * dominative assigns straight onto the view instance. A JSX attribute is
 * therefore a NativeScript view property, not a stringified DOM attribute.
 */
type ViewProperties<TInstance> = {
	[K in keyof TInstance as TInstance[K] extends (...args: never[]) => unknown ? never : K]?: TInstance[K];
};

/** dominative dispatches the raw NativeScript payload, tagged with `type`. */
type NSEventData<TInstance> = NS.EventData & { object: TInstance; type: string };

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
 * and the renderer aliases a handful of web-ish names onto NativeScript events
 * (see `EVENT_ALIASES` in `@nativescript-community/react/src/props.js`).
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
	/** Forwarded to NativeScript's `class`, which resolves against `app.css`. */
	className?: string;
	class?: string;
	/** A string is set as the `style` attribute; an object is assigned onto `view.style`. */
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

interface ReactAttributes<TInstance> {
	key?: Key | null;
	ref?: Ref<TInstance>;
	children?: ReactNode;
}

type Overridden = keyof CommonAttributes | keyof ReactAttributes<unknown> | keyof CommonEvents<unknown>;

type Attributes<TClass extends abstract new (...args: never[]) => unknown> = Omit<
	ViewProperties<InstanceType<TClass>> & DerivedEvents<TClass, InstanceType<TClass>>,
	Overridden
> &
	CommonAttributes &
	CommonEvents<InstanceType<TClass>> &
	ReactAttributes<InstanceType<TClass>>;

/**
 * dominative's virtual elements carry data into templated views instead of
 * rendering. `key` is unusable here — React consumes it before the renderer
 * sees it, so set the prop name via `attr` on `ItemTemplate` consumers.
 */
interface VirtualElementAttributes {
	key?: Key | null;
	type?: string;
	value?: unknown;
	class?: string;
	children?: ReactNode;
}

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

	prop: VirtualElementAttributes;
	keyprop: VirtualElementAttributes;
	arrayprop: VirtualElementAttributes;
	itemtemplate: VirtualElementAttributes;
}
