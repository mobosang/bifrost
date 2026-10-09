import LoginView from "@enterprise/components/login/loginView";
import LanguageSwitcher from "@/components/languageSwitcher";
import { getRouteApi } from "@tanstack/react-router";
import SetupTokenView from "./views/setupTokenView";

const loginRoute = getRouteApi("/login");

export default function LoginPage() {
	const loaderData = loginRoute.useLoaderData();
	return (
		<div className="overflow-hidden">
			<div className="fixed top-4 right-4 z-50">
				<LanguageSwitcher />
			</div>
			{loaderData?.setupRequired ? <SetupTokenView setupTokenConfigured={loaderData.setupTokenConfigured} /> : <LoginView />}
		</div>
	);
}