import type {SignalsAdapter} from "./main-vali.ts"

export const $RAW = Symbol("raw")
export const $NODE = Symbol("node")
export const $HAS = Symbol("has")
export const $SELF = Symbol("self")
export const $PROXY = Symbol("solid-proxy")
export const $TRACK = Symbol("solid-track")

type DataNode = {
	(): any
	$(value?: any): void
}
export type DataNodes = Record<PropertyKey, DataNode | undefined>

export type OnStoreNodeUpdate = (
	state: StoreNode,
	property: PropertyKey,
	value: StoreNode | NotWrappable,
	prev: StoreNode | NotWrappable
) => void

export interface StoreNode {
	[$NODE]?: DataNodes
	[key: PropertyKey]: any
}

export namespace SolidStore {
	export interface Unwrappable {}
}
export type NotWrappable =
	| string
	| number
	| bigint
	| symbol
	| boolean
	| Function
	| null
	| undefined
	| SolidStore.Unwrappable[keyof SolidStore.Unwrappable]
export type Store<T> = T

function wrap<T extends StoreNode>(value: T): T {
	let p = value[$PROXY]
	if (!p) {
		Object.defineProperty(value, $PROXY, {
			value: (p = new Proxy(value, proxyTraps)),
		})
		if (!Array.isArray(value)) {
			const keys = Object.keys(value),
				desc = Object.getOwnPropertyDescriptors(value)
			for (let i = 0, l = keys.length; i < l; i++) {
				const prop = keys[i]
				if (desc[prop].get) {
					Object.defineProperty(value, prop, {
						enumerable: desc[prop].enumerable,
						get: desc[prop].get!.bind(p),
					})
				}
			}
		}
	}
	return p
}

export function isWrappable<T>(obj: T | NotWrappable): obj is T
export function isWrappable(obj: any) {
	let proto
	return (
		obj != null &&
		typeof obj === "object" &&
		(obj[$PROXY] ||
			!(proto = Object.getPrototypeOf(obj)) ||
			proto === Object.prototype ||
			Array.isArray(obj))
	)
}

/**
 * Returns the underlying data in the store without a proxy.
 * @param item store proxy object
 * @example
 * ```js
 * const initial = {z...};
 * const [state, setState] = createStore(initial);
 * initial === state; // => false
 * initial === unwrap(state); // => true
 * ```
 */
export function unwrap<T>(item: T, set?: Set<unknown>): T
export function unwrap<T>(item: any, set = new Set()): T {
	let result, unwrapped, v, prop
	if ((result = item != null && item[$RAW])) return result
	if (!isWrappable(item) || set.has(item)) return item

	if (Array.isArray(item)) {
		if (Object.isFrozen(item)) item = item.slice(0)
		else set.add(item)
		for (let i = 0, l = item.length; i < l; i++) {
			v = item[i]
			if ((unwrapped = unwrap(v, set)) !== v) item[i] = unwrapped
		}
	} else {
		if (Object.isFrozen(item)) item = Object.assign({}, item)
		else set.add(item)
		const keys = Object.keys(item),
			desc = Object.getOwnPropertyDescriptors(item)
		for (let i = 0, l = keys.length; i < l; i++) {
			prop = keys[i]
			if (desc[prop].get) continue
			v = item[prop]
			if ((unwrapped = unwrap(v, set)) !== v) item[prop] = unwrapped
		}
	}
	return item
}

export function getNodes(
	target: StoreNode,
	symbol: typeof $NODE | typeof $HAS
): DataNodes {
	let nodes = target[symbol]
	if (!nodes)
		Object.defineProperty(target, symbol, {
			value: (nodes = Object.create(null) as DataNodes),
		})
	return nodes
}

export function getNode(nodes: DataNodes, property: PropertyKey, value?: any) {
	if (nodes[property]) return nodes[property]!
	const [s, set] = createSignal<any>(value, {
		equals: false,
		internal: true,
	})
	;(s as DataNode).$ = set
	return (nodes[property] = s as DataNode)
}

export function proxyDescriptor(target: StoreNode, property: PropertyKey) {
	const desc = Reflect.getOwnPropertyDescriptor(target, property)
	if (
		!desc ||
		desc.get ||
		!desc.configurable ||
		property === $PROXY ||
		property === $NODE
	)
		return desc
	delete desc.value
	delete desc.writable
	desc.get = () => target[$PROXY][property]
	return desc
}

export function trackSelf(target: StoreNode) {
	getListener() && getNode(getNodes(target, $NODE), $SELF)()
}

export function ownKeys(target: StoreNode) {
	trackSelf(target)
	return Reflect.ownKeys(target)
}

const proxyTraps: ProxyHandler<StoreNode> = {
	get(target, property, receiver) {
		if (property === $RAW) return target
		if (property === $PROXY) return receiver
		if (property === $TRACK) {
			trackSelf(target)
			return receiver
		}
		const nodes = getNodes(target, $NODE)
		const tracked = nodes[property]
		let value = tracked ? tracked() : target[property]
		if (property === $NODE || property === $HAS || property === "__proto__")
			return value

		if (!tracked) {
			const desc = Object.getOwnPropertyDescriptor(target, property)
			if (
				getListener() &&
				(typeof value !== "function" || target.hasOwnProperty(property)) &&
				!(desc && desc.get)
			)
				value = getNode(nodes, property, value)()
		}
		return isWrappable(value) ? wrap(value) : value
	},

	has(target, property) {
		if (
			property === $RAW ||
			property === $PROXY ||
			property === $TRACK ||
			property === $NODE ||
			property === $HAS ||
			property === "__proto__"
		)
			return true
		getListener() && getNode(getNodes(target, $HAS), property)()
		return property in target
	},
	set() {
		return true
	},
	deleteProperty() {
		return true
	},
	ownKeys: ownKeys,
	getOwnPropertyDescriptor: proxyDescriptor,
}

export function setProperty(
	state: StoreNode,
	property: PropertyKey,
	value: any,
	deleting: boolean = false
): void {
	if (!deleting && state[property] === value) return
	const prev = state[property],
		len = state.length

	if (value === undefined) {
		delete state[property]
		if (state[$HAS] && state[$HAS][property] && prev !== undefined)
			state[$HAS][property].$()
	} else {
		state[property] = value
		if (state[$HAS] && state[$HAS][property] && prev === undefined)
			state[$HAS][property].$()
	}
	let nodes = getNodes(state, $NODE),
		node: DataNode | undefined
	if ((node = getNode(nodes, property, prev))) node.$(() => value)

	if (Array.isArray(state) && state.length !== len) {
		for (let i = state.length; i < len; i++) (node = nodes[i]) && node.$()
		;(node = getNode(nodes, "length", len)) && node.$(state.length)
	}
	;(node = nodes[$SELF]) && node.$()
}

/** @deprecated */
export type DeepReadonly<T> = 0 extends 1 & T
	? T
	: T extends NotWrappable
		? T
		: {
				readonly [K in keyof T]: DeepReadonly<T[K]>
			}
/** @deprecated */
export type DeepMutable<T> = 0 extends 1 & T
	? T
	: T extends NotWrappable
		? T
		: {
				-readonly [K in keyof T]: DeepMutable<T[K]>
			}

export type CustomPartial<T> = T extends readonly unknown[]
	? "0" extends keyof T
		? {[K in Extract<keyof T, `${number}`>]?: T[K]}
		: {[x: number]: T[number]}
	: Partial<T>

export type PickMutable<T> = {
	[K in keyof T as (<U>() => U extends {[V in K]: T[V]} ? 1 : 2) extends <
		U,
	>() => U extends {
		-readonly [V in K]: T[V]
	}
		? 1
		: 2
		? K
		: never]: T[K]
}

export type StorePathRange = {from?: number; to?: number; by?: number}

export type ArrayFilterFn<T> = (item: T, index: number) => boolean

export type StoreSetter<T, U extends PropertyKey[] = []> =
	| T
	| CustomPartial<T>
	| ((prevState: T, traversed: U) => T | CustomPartial<T>)

export type Part<T, K extends KeyOf<T> = KeyOf<T>> =
	| K
	| ([K] extends [never] ? never : readonly K[])
	| ([T] extends [readonly unknown[]]
			? ArrayFilterFn<T[number]> | StorePathRange
			: never)

// shortcut to avoid writing `Exclude<T, NotWrappable>` too many times
type W<T> = Exclude<T, NotWrappable>

// specially handle keyof to avoid errors with arrays and any
type KeyOf<T> = number extends keyof T // have to check this otherwise ts won't allow KeyOf<T> to index T
	? 0 extends 1 & T // if it's any just return keyof T
		? keyof T
		: [T] extends [never]
			? never // keyof never is PropertyKey, which number extends. this must go before
			: // checking [T] extends [readonly unknown[]] because never extends everything
				[T] extends [readonly unknown[]]
				? number // it's an array or tuple; exclude the non-number properties
				: keyof T // it's something which contains an index signature for strings or numbers
	: keyof T

type MutableKeyOf<T> = KeyOf<T> & keyof PickMutable<T>

// rest must specify at least one (additional) key, followed by a StoreSetter if the key is mutable.
type Rest<T, U extends PropertyKey[], K extends KeyOf<T> = KeyOf<T>> = [
	T,
] extends [never]
	? never
	: K extends MutableKeyOf<T>
		? [Part<T, K>, ...RestSetterOrContinue<T[K], [K, ...U]>]
		: K extends KeyOf<T>
			? [Part<T, K>, ...RestContinue<T[K], [K, ...U]>]
			: never

type RestContinue<T, U extends PropertyKey[]> = 0 extends 1 & T
	? [...Part<any>[], StoreSetter<any, PropertyKey[]>]
	: Rest<W<T>, U>

type RestSetterOrContinue<T, U extends PropertyKey[]> =
	| [StoreSetter<T, U>]
	| RestContinue<T, U>

/**
 * Creates a reactive store that can be read through a proxy object and written with a setter function
 *
 * @description https://docs.solidjs.com/reference/store-utilities/create-store
 */
export const deeply = (signals: SignalsAdapter) =>
	function deeply<T extends object = {}>(object: T): Store<T> {
		return wrap(signals)(object)
	}
