import {
	format as originalFormat,
	formatDistance as originalDistance,
	formatDistanceToNow as originalToNow,
	formatDistanceToNowStrict as originalToNowStrict,
	formatRelative as originalRelative,
} from "date-fns";
import { zhCN, enUS } from "date-fns/locale";
import { locale } from "./runtime";

export * from "date-fns";
export const dateLocale = locale === "zh-CN" ? zhCN : enUS;
export const format: typeof originalFormat = (date, pattern, options) => originalFormat(date, pattern, { locale: dateLocale, ...options });
export const formatDistance: typeof originalDistance = (date, base, options) =>
	originalDistance(date, base, { locale: dateLocale, ...options });
export const formatDistanceToNow: typeof originalToNow = (date, options) => originalToNow(date, { locale: dateLocale, ...options });
export const formatDistanceToNowStrict: typeof originalToNowStrict = (date, options) =>
	originalToNowStrict(date, { locale: dateLocale, ...options });
export const formatRelative: typeof originalRelative = (date, base, options) =>
	originalRelative(date, base, { locale: dateLocale, ...options });