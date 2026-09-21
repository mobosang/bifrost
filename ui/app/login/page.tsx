import LoginView from "@enterprise/components/login/loginView";
import LanguageSwitcher from "@/components/languageSwitcher";

export default function LoginPage() {
	return (
		<div className="overflow-hidden">
			<div className="fixed top-4 right-4 z-50">
				<LanguageSwitcher />
			</div>
			<LoginView />
		</div>
	);
}