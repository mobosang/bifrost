import { toast as originalToast, Toaster as OriginalToaster, type ToasterProps } from "sonner";
import { createElement } from "react";
import { t } from "./runtime";
import { displayError } from "./errors";

export * from "sonner";
export function Toaster(props: ToasterProps) {
	return createElement(OriginalToaster, {
		containerAriaLabel: t("Notifications"),
		...props,
		toastOptions: { closeButtonAriaLabel: t("Close"), ...props.toastOptions },
	});
}
export const toast = new Proxy(originalToast, {
	get(target, property, receiver) {
		if (property === "error")
			return (message: Parameters<typeof originalToast.error>[0], ...args: Tail<Parameters<typeof originalToast.error>>) =>
				originalToast.error(displayError(message), ...args);
		return Reflect.get(target, property, receiver);
	},
});
type Tail<T extends unknown[]> = T extends [unknown, ...infer Rest] ? Rest : never;