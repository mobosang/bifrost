import { getLocale } from "./runtime";

// Only known protocol errors are translated at display boundaries. Keep the
// original getErrorMessage result available for upstream control flow.
const messages: Record<string, string> = {
	"Invalid username or password": "用户名或密码错误",
	"Invalid credentials": "凭据无效",
	Unauthorized: "未授权，请登录后重试",
	Forbidden: "没有执行此操作的权限",
	"Network Error": "网络错误",
	"Failed to fetch": "请求失败，请检查网络连接",
	"An unexpected error occurred": "发生了意外错误",
};

export function displayError<T>(message: T): T | string {
	return getLocale() === "zh-CN" && typeof message === "string" ? (messages[message] ?? message) : message;
}