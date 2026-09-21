/**
 * Combinator Selector Component for CEL Rule Builder
 * Allows selection of AND/OR combinators between rules
 */

import { Button } from "@/components/ui/button";
import { CombinatorSelectorProps } from "react-querybuilder";
import { t } from "@/lib/i18n/runtime";

export function CombinatorSelector({ value, handleOnChange, options }: CombinatorSelectorProps) {
	return (
		<div className="flex gap-1">
			{options.map((option) => {
				if ("options" in option) return null; // Skip option groups
				return (
					<Button
						key={option.name}
						type="button"
						variant={value === option.name ? "default" : "outline"}
						size="sm"
						onClick={() => handleOnChange(option.name)}
						className="px-3"
					>
						{option.name === "and" ? t("AND") : option.name === "or" ? t("OR") : option.label.toUpperCase()}
					</Button>
				);
			})}
		</div>
	);
}