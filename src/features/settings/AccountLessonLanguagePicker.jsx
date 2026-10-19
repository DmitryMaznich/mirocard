import { useAppStore } from "@/core/store";
import { accountLanguages } from "@/core/languageSync.js";
import LessonLanguagePicker from "@/shared/components/LessonLanguagePicker.jsx";

export default function AccountLessonLanguagePicker() {
  const account = useAppStore(state => state.account);
  const token = useAppStore(state => state.token);
  const language = useAppStore(state => state.settings.cardLanguage);
  if (!account?.id || !token) return null;
  return <LessonLanguagePicker value={language} onChange={accountLanguages.chooseCardLanguage} />;
}
