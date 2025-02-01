import type {
	Doc,
	DocHandle,
	DocHandleChangePayload,
} from "@automerge/automerge-repo"
import type {SignalsAdapter} from "./main.ts"
import {apply, fromAutomerge} from "cabbages"
import {getOwner} from "solid-js/web"
import {runWithOwner, type Owner} from "solid-js"

// todo can't actually be a symbol
type Path = (string | number | symbol)[]
interface Signal {
	track(): void
	notify(): void
}

function isACompletelyNormalObject(object: unknown): object is object {
	return (
		typeof object === "object" &&
		object !== null &&
		!Array.isArray(object) &&
		!(object instanceof Date)
	)
}

export const proxy = (adapter: SignalsAdapter, root: Path, owner: Owner) => {
	const signals = new Map<string, Signal>()
	function track(path: Path) {
		runWithOwner(owner, () => {
			const sub = signals.get(path.join("/"))
			if (sub) {
				sub.track()
			} else {
				signals.set(path.join("/"), adapter.create())
			}
		})
	}

	function notify(path: Path) {
		runWithOwner(owner, () => {
			const sub = signals.get(path.join("/"))
			if (sub) {
				console.log("hello", getOwner())
				sub.notify()
			} else {
				console.error("No signal found for path", path.join("/"))
			}
		})
	}

	function p<T extends object>(target: T, path = root): [T, () => void] {
		track(path)
		const view = new Proxy(target, {
			set() {
				return true
			},
			deleteProperty() {
				return true
			},
			ownKeys(target) {
				return Reflect.ownKeys(target)
			},
			has(target, key) {
				track([...path, key])
				return key in target
			},
			defineProperty() {
				return true
			},
			getOwnPropertyDescriptor(target, key) {
				track([...path, key])
				return Reflect.getOwnPropertyDescriptor(target, key)
			},
			get(target, key) {
				const keypath = [...path, key]
				track(keypath)
				const value = Reflect.get(target, key)
				if (isACompletelyNormalObject(value)) {
					return p(value, keypath)
				}
				return value
			},
		}) as T
		return [view, () => notify(path)]
	}
	return (doc: Doc<any>) => {
		// todo cache weakmap refcount &c
		return p(doc)
	}
}
