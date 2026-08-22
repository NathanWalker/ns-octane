import {
	AbsoluteLayout,
	ActionBar,
	ActionItem,
	ActivityIndicator,
	Button,
	ContentView,
	DatePicker,
	DockLayout,
	FlexboxLayout,
	FormattedString,
	Frame,
	GridLayout,
	HtmlView,
	Image,
	Label,
	ListPicker,
	ListView,
	NavigationButton,
	Page,
	Placeholder,
	Progress,
	ProxyViewContainer,
	RootLayout,
	ScrollView,
	SearchBar,
	SegmentedBar,
	SegmentedBarItem,
	Slider,
	Span,
	StackLayout,
	Switch,
	TabView,
	TabViewItem,
	TextField,
	TextView,
	TimePicker,
	ViewBase,
	WebView,
	WrapLayout,
} from '@nativescript/core';
import { SwiftUI } from '@nativescript/swift-ui';
import { Embers } from '../elements/embers';

export type ElementConstructor = new () => ViewBase;

/**
 * Lowercase tag name -> view constructor. Keys must match `intrinsics.ts`.
 *
 * The map itself lives in `import.meta.hot.data`, so under HMR it is the same
 * object across re-evaluations of this module: the driver keeps the binding it
 * imported at boot, and a hot update to this file re-populates that map in
 * place. That is what lets a tag registered here reach a running app without
 * remounting it, and why this module accepts its own updates below.
 */
export const ELEMENTS: Map<string, ElementConstructor> = import.meta.hot?.data.elements ?? new Map();

type ElementReplacedListener = (tag: string, element: ElementConstructor) => void;

/** Lives beside the map in `hot.data` for the same reason: the driver subscribes once, at boot. */
const replacedListeners: Set<ElementReplacedListener> = import.meta.hot?.data.elementListeners ?? new Set();

/** Register (or replace) the view class a tag instantiates. Replacing notifies `onElementReplaced` listeners. */
export function registerElement(tag: string, element: ElementConstructor): void {
	const previous = ELEMENTS.get(tag);
	ELEMENTS.set(tag, element);
	if (previous !== undefined && previous !== element) {
		for (const listener of replacedListeners) listener(tag, element);
	}
}

/** Observe a tag's class being replaced — the driver recreates live instances. Returns the unsubscribe. */
export function onElementReplaced(listener: ElementReplacedListener): () => void {
	replacedListeners.add(listener);
	return () => {
		replacedListeners.delete(listener);
	};
}

const BUILTIN_ELEMENTS: ReadonlyArray<[string, ElementConstructor]> = [
	['absolutelayout', AbsoluteLayout],
	['actionbar', ActionBar],
	['actionitem', ActionItem],
	['activityindicator', ActivityIndicator],
	['button', Button],
	['contentview', ContentView],
	['datepicker', DatePicker],
	['docklayout', DockLayout],
	['flexboxlayout', FlexboxLayout],
	['formattedstring', FormattedString as unknown as new () => ViewBase],
	['frame', Frame],
	['gridlayout', GridLayout],
	['htmlview', HtmlView],
	['image', Image],
	['label', Label],
	['listpicker', ListPicker],
	['listview', ListView],
	['navigationbutton', NavigationButton],
	['page', Page],
	['placeholder', Placeholder],
	['progress', Progress],
	['proxyviewcontainer', ProxyViewContainer],
	['rootlayout', RootLayout],
	['scrollview', ScrollView],
	['searchbar', SearchBar],
	['segmentedbar', SegmentedBar],
	['segmentedbaritem', SegmentedBarItem as unknown as new () => ViewBase],
	['slider', Slider],
	['span', Span as unknown as new () => ViewBase],
	['stacklayout', StackLayout],
	['switch', Switch],
	['tabview', TabView],
	['tabviewitem', TabViewItem as unknown as new () => ViewBase],
	['textfield', TextField],
	['textview', TextView],
	['timepicker', TimePicker],
	['webview', WebView],
	['wraplayout', WrapLayout],
	['swiftui', SwiftUI as unknown as new () => ViewBase],
	['embers', Embers],
];

for (const [tag, element] of BUILTIN_ELEMENTS) registerElement(tag, element);

if (import.meta.hot) {
	import.meta.hot.data.elements = ELEMENTS;
	import.meta.hot.data.elementListeners = replacedListeners;
	import.meta.hot.accept();
}

/**
 * Web-shaped handler names NativeScript spells differently. Anything else
 * lowercases the first character after `on` (`onLoaded` -> `loaded`).
 */
const EVENT_ALIASES = new Map<string, string>([
	['onClick', 'tap'],
	['onPress', 'tap'],
	['onTap', 'tap'],
	['onDoubleTap', 'doubleTap'],
	['onLongPress', 'longPress'],
	['onChange', 'textChange'],
	['onSubmit', 'returnPress'],
]);

export const EVENT_PROP = /^on[A-Z]/;

export function eventNameFor(prop: string): string {
	const alias = EVENT_ALIASES.get(prop);
	if (alias !== undefined) return alias;
	const raw = prop.slice(2);
	return raw.charAt(0).toLowerCase() + raw.slice(1);
}
