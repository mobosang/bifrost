/**
 * Action Button Component for CEL Rule Builder
 * Used for Add/Remove actions in query builder
 */

import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { ActionProps } from "react-querybuilder";
import { t } from "@/lib/i18n/runtime";

export function ActionButton({ handleOnClick, label, className, title }: ActionProps) {
	const labelStr = typeof label === "string" ? label : "";
	const labelLower = labelStr.toLowerCase();
	const isAddButton = labelLower.includes("add") || [t("Add Rule"), t("Add Rule Group")].includes(labelStr);
	const isRemoveButton =
		labelLower.includes("remove") ||
		labelLower === "x" ||
		labelStr === "x" ||
		label?.toString().toLowerCase() === "x" ||
		title === "Remove rule" ||
		title === "Remove group" ||
		title === t("Remove rule") ||
		title === t("Remove group");

	// Icon-only remove button needs an accessible name (no visible label is rendered)
	const iconOnly = isRemoveButton;
	const ariaLabel = iconOnly ? labelStr?.trim() || (typeof title === "string" ? title.trim() : "") || "Remove" : undefined;

	return (
		<Button
			type="button"
			onClick={(e) => handleOnClick(e)}
			variant={isRemoveButton ? "ghost" : "outline"}
			size="sm"
			className={className}
			aria-label={ariaLabel}
		>
			{isRemoveButton && <X className="h-4 w-4" />}
			{isAddButton && <Plus className="mr-1 h-4 w-4" />}
			{!isRemoveButton && label}
		</Button>
	);
}