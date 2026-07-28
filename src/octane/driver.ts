import {
	ActionBar,
	ContentView,
	type EventData,
	FormattedString,
	LayoutBase,
	Span,
	TextBase,
	View,
	type ViewBase,
	unsetValue,
} from '@nativescript/core';
import {
	createUniversalRoot,
	type UniversalEventListenerDescriptor,
	type UniversalHostCommand,
	type UniversalHostDriver,
	type UniversalRoot,
} from 'octane/universal/native';
import { NATIVESCRIPT_RENDERER_ID } from './config';
import { ELEMENTS, EVENT_PROP, eventNameFor } from './elements';

/** `#text` nodes carry no view; the driver folds them into the parent's `text`. */
const TEXT = '#text';

interface HostNode {
	readonly id: number;
	readonly type: string;
	readonly view: ViewBase | null;
	text: string;
	props: Readonly<Record<string, unknown>>;
	parent: HostNode | null;
	readonly children: HostNode[];
	readonly listeners: Map<string, (data: EventData) => void>;
	/** Whether this node's `text` has been driven by `#text` children. */
	textApplied: boolean;
}

export interface NativeScriptContainer {
	readonly host: ViewBase;
	readonly nodes: Map<number, HostNode>;
	readonly children: HostNode[];
	root: UniversalRoot | null;
}

function expect(container: NativeScriptContainer, id: number): HostNode {
	const node = container.nodes.get(id);
	if (node === undefined) throw new Error(`NativeScript driver: unknown host ${id}.`);
	return node;
}

function childrenOf(container: NativeScriptContainer, parent: HostNode | null): HostNode[] {
	return parent === null ? container.children : parent.children;
}

function hostViewOf(container: NativeScriptContainer, parent: HostNode | null): ViewBase | null {
	return parent === null ? container.host : parent.view;
}

function createNode(id: number, type: string, props: Readonly<Record<string, unknown>>): HostNode {
	const node: HostNode = {
		id,
		type,
		view: type === TEXT ? null : instantiate(type),
		text: '',
		props,
		parent: null,
		children: [],
		listeners: new Map(),
		textApplied: false,
	};
	applyProps(node, props);
	return node;
}

function instantiate(type: string): ViewBase {
	const Element = ELEMENTS.get(type);
	if (Element === undefined) {
		throw new Error(`NativeScript driver: <${type}> is not a registered element.`);
	}
	return new Element();
}

function applyProps(node: HostNode, props: Readonly<Record<string, unknown>>): void {
	if (node.view === null) {
		node.text = props.value == null ? '' : String(props.value);
		syncText(node.parent);
		return;
	}
	for (const name in props) setProp(node.view, name, props[name]);
}

function updateProps(node: HostNode, next: Readonly<Record<string, unknown>>): void {
	if (node.view !== null) {
		for (const name in node.props) {
			if (!(name in next)) setProp(node.view, name, unsetValue);
		}
	}
	applyProps(node, next);
	node.props = next;
}

function setProp(view: ViewBase, name: string, value: unknown): void {
	if (name === 'children' || name === 'key' || name === 'ref') return;
	// Event props arrive as their own `event` commands.
	if (EVENT_PROP.test(name)) return;
	if (name === 'className' || name === 'class') {
		view.className = value == null || value === unsetValue ? unsetValue : String(value);
		return;
	}
	if (name === 'style') {
		applyStyle(view, value);
		return;
	}
	(view as unknown as Record<string, unknown>)[name] = value;
}

function applyStyle(view: ViewBase, value: unknown): void {
	if (value == null || value === unsetValue) return;
	if (typeof value === 'string') {
		view.setInlineStyle(value);
		return;
	}
	if (typeof value === 'object') Object.assign(view.style, value);
}

/** Recompute a text host's `text` from its `#text` children. */
function syncText(parent: HostNode | null): void {
	if (parent === null) return;
	const view = parent.view;
	if (!(view instanceof TextBase)) return;
	let text = '';
	let found = false;
	for (const child of parent.children) {
		if (child.view !== null) continue;
		text += child.text;
		found = true;
	}
	if (!found && !parent.textApplied) return;
	parent.textApplied = found;
	view.text = text;
}

function addViewChild(parentView: ViewBase, view: ViewBase, index: number): void {
	if (parentView instanceof LayoutBase) {
		parentView.insertChild(view as View, Math.min(index, parentView.getChildrenCount()));
		return;
	}
	if (parentView instanceof ContentView) {
		parentView.content = view as View;
		return;
	}
	if (parentView instanceof FormattedString && view instanceof Span) {
		parentView.spans.splice(Math.min(index, parentView.spans.length), 0, view);
		return;
	}
	if (parentView instanceof TextBase && view instanceof FormattedString) {
		parentView.formattedText = view;
		return;
	}
	if (parentView instanceof ActionBar) {
		parentView.titleView = view as View;
		return;
	}
	throw new Error(
		`NativeScript driver: <${parentView.typeName}> cannot host a <${view.typeName}> child.`,
	);
}

/** NativeScript empties a single-child slot with `null`; the typings admit only the view type. */
const CLEARED = null as never;

function removeViewChild(parentView: ViewBase | null, view: ViewBase): void {
	if (parentView === null) return;
	if (parentView instanceof LayoutBase) {
		parentView.removeChild(view as View);
		return;
	}
	if (parentView instanceof ContentView) {
		if (parentView.content === view) parentView.content = CLEARED;
		return;
	}
	if (parentView instanceof FormattedString && view instanceof Span) {
		const index = parentView.spans.indexOf(view);
		if (index !== -1) parentView.spans.splice(index, 1);
		return;
	}
	if (parentView instanceof TextBase && parentView.formattedText === view) {
		parentView.formattedText = CLEARED;
		return;
	}
	if (parentView instanceof ActionBar && parentView.titleView === view) {
		parentView.titleView = CLEARED;
	}
}

function detach(container: NativeScriptContainer, node: HostNode): void {
	const parent = node.parent;
	const siblings = childrenOf(container, parent);
	const index = siblings.indexOf(node);
	if (index !== -1) siblings.splice(index, 1);
	if (node.view === null) syncText(parent);
	else removeViewChild(hostViewOf(container, parent), node.view);
	node.parent = null;
}

function attach(container: NativeScriptContainer, node: HostNode): void {
	const parent = node.parent;
	if (node.view === null) {
		syncText(parent);
		return;
	}
	const parentView = hostViewOf(container, parent);
	if (parentView === null) return;
	let index = 0;
	for (const sibling of childrenOf(container, parent)) {
		if (sibling === node) break;
		if (sibling.view !== null) index++;
	}
	addViewChild(parentView, node.view, index);
}

function insert(
	container: NativeScriptContainer,
	parent: HostNode | null,
	node: HostNode,
	before: number | null,
): void {
	detach(container, node);
	const siblings = childrenOf(container, parent);
	const index = before === null ? -1 : siblings.findIndex((sibling) => sibling.id === before);
	if (index === -1) siblings.push(node);
	else siblings.splice(index, 0, node);
	node.parent = parent;
	attach(container, node);
}

function setEvent(
	container: NativeScriptContainer,
	node: HostNode,
	type: string,
	listener: UniversalEventListenerDescriptor | null,
): void {
	const view = node.view;
	if (view === null) return;
	const previous = node.listeners.get(type);
	if (previous !== undefined) {
		view.off(type, previous);
		node.listeners.delete(type);
	}
	if (listener === null) return;
	const handler = (data: EventData) => {
		const root = container.root;
		if (root === null) return;
		root.eventScope(listener.priority, () => root.dispatchEvent(listener.id, data));
	};
	node.listeners.set(type, handler);
	view.on(type, handler);
}

function disposeListeners(node: HostNode): void {
	const view = node.view;
	if (view !== null) {
		for (const [type, handler] of node.listeners) view.off(type, handler);
	}
	node.listeners.clear();
}

/** A non-numeric parent is the root container; portals are not enabled. */
function resolveParent(container: NativeScriptContainer, parent: unknown): HostNode | null {
	return typeof parent === 'number' ? expect(container, parent) : null;
}

function applyCommand(container: NativeScriptContainer, command: UniversalHostCommand): void {
	switch (command.op) {
		case 'create': {
			container.nodes.set(command.id, createNode(command.id, command.type, command.props));
			return;
		}
		case 'recreate': {
			const previous = expect(container, command.id);
			const parent = previous.parent;
			const siblings = childrenOf(container, parent);
			const index = siblings.indexOf(previous);
			detach(container, previous);
			disposeListeners(previous);
			const node = createNode(command.id, command.type, command.props);
			container.nodes.set(command.id, node);
			if (index === -1) return;
			siblings.splice(index, 0, node);
			node.parent = parent;
			attach(container, node);
			return;
		}
		case 'update': {
			updateProps(expect(container, command.id), command.props);
			return;
		}
		case 'insert':
		case 'move': {
			insert(
				container,
				resolveParent(container, command.parent),
				expect(container, command.id),
				command.before,
			);
			return;
		}
		case 'remove': {
			detach(container, expect(container, command.id));
			return;
		}
		case 'destroy': {
			const node = container.nodes.get(command.id);
			if (node === undefined) return;
			disposeListeners(node);
			container.nodes.delete(command.id);
			return;
		}
		case 'event': {
			setEvent(container, expect(container, command.id), command.type, command.listener);
			return;
		}
		case 'visibility': {
			const view = expect(container, command.id).view;
			if (view instanceof View) {
				view.visibility = command.state === 'hidden' ? 'collapse' : 'visible';
			}
			return;
		}
		default:
			return;
	}
}

export const nativeScriptDriver: UniversalHostDriver<NativeScriptContainer, ViewBase | null> = {
	id: NATIVESCRIPT_RENDERER_ID,
	capabilities: { text: 'host' },
	events: {
		classify(name) {
			if (!EVENT_PROP.test(name)) return null;
			return { type: eventNameFor(name), priority: 'discrete' };
		},
	},
	prepareBatch(container, batch) {
		if (batch.renderer !== NATIVESCRIPT_RENDERER_ID) {
			throw new Error(
				`NativeScript driver: batch renderer ${JSON.stringify(batch.renderer)} does not match.`,
			);
		}
		return {
			apply() {
				for (const command of batch.commands) applyCommand(container, command);
			},
			// Nothing is staged ahead of `apply`, so there is nothing to release.
			abort() {},
		};
	},
	getPublicInstance(container, id) {
		return container.nodes.get(id)?.view ?? null;
	},
};

/**
 * Mount an Octane component into an existing NativeScript view.
 *
 * The cast is the one unavoidable seam: the compiler brands renderer-owned
 * components with `defineUniversalComponent`, but TypeScript still sees the
 * authored function signature at the call site.
 */
export function renderNativeScriptApp<P extends object>(
	host: ViewBase,
	component: (props: P) => unknown,
	props: P = {} as P,
): UniversalRoot {
	const root = createNativeScriptRoot(host);
	root.render(component as never, props);
	return root;
}

/** Mount an Octane tree into an existing NativeScript view. */
export function createNativeScriptRoot(host: ViewBase): UniversalRoot {
	const container: NativeScriptContainer = {
		host,
		nodes: new Map(),
		children: [],
		root: null,
	};
	const root = createUniversalRoot(container, nativeScriptDriver, {
		scheduleMicrotask: (callback) => {
			Promise.resolve().then(callback);
		},
	});
	container.root = root;
	return root;
}
