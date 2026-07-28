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

/** Lowercase tag name -> view constructor. Keys must match `intrinsics.ts`. */
export const ELEMENTS = new Map<string, new () => ViewBase>([
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
]);

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
