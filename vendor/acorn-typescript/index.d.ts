import { Parser } from "../acorn/dist/acorn.d.mts";

export function tsPlugin(options?: {
	dts?: boolean;
	/** Whether to use JSX. Defaults to false */
	jsx?:
		| boolean
		| {
				allowNamespaces?: boolean;
				allowNamespacedObjects?: boolean;
		  };
}): (BaseParser: typeof Parser) => typeof Parser;
