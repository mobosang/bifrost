import { useState } from "react";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogCancel,
} from "@/components/ui/alertDialog";
import { locale, saveLocale, t, type Locale } from "@/lib/i18n/runtime";

export default function LanguageSwitcher() {
	const [open, setOpen] = useState(false);
	const [next, setNext] = useState<Locale>(locale);
	const [failed, setFailed] = useState(false);
	return (
		<>
			<Button
				variant="ghost"
				size="sm"
				aria-label={t("Language")}
				title={t("Language")}
				data-testid="language-switcher-trigger"
				onClick={() => setOpen(true)}
			>
				<Languages className="size-4" />
				<span>{locale === "zh-CN" ? "中文" : "EN"}</span>
			</Button>
			<AlertDialog open={open} onOpenChange={setOpen}>
				<AlertDialogContent>
					<AlertDialogTitle>{t("Language")}</AlertDialogTitle>
					<AlertDialogDescription>{t("Changing the language reloads this page. Save any unfinished edits first.")}</AlertDialogDescription>
					<select
						data-i18n-ignore
						className="border-input bg-background h-9 rounded-md border px-3 text-sm"
						aria-label={t("Language")}
						data-testid="language-switcher-select"
						value={next}
						onChange={(event) => {
							setNext(event.target.value as Locale);
							setFailed(false);
						}}
					>
						<option value="zh-CN">简体中文</option>
						<option value="en-US">English</option>
					</select>
					{failed && (
						<p role="alert" className="text-destructive text-sm">
							{t("Unable to save your language preference. Enable browser storage and try again.")}
						</p>
					)}
					<AlertDialogFooter>
						<AlertDialogCancel data-testid="language-switcher-cancel">{t("Cancel")}</AlertDialogCancel>
						<Button
							data-testid="language-switcher-apply"
							disabled={next === locale}
							onClick={() => {
								if (!saveLocale(next)) {
									setFailed(true);
									return;
								}
								window.location.reload();
							}}
						>
							{t("Apply and reload")}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}