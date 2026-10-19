import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useAppStore } from "@/core/store";
import { setUiLanguage } from "@/shared/i18n/uiLanguage.js";
import { api } from "@/core/api";
import AccountScreen from "./AccountScreen";
import HelpScreen from "@/features/help/HelpScreen";
import StatisticsScreen from "@/features/analytics/StatisticsScreen";

vi.mock("@/core/api", () => ({ api: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
let root, host;
const initial = useAppStore.getState();
const button = text => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text);
const mount = Component => act(async () => root.render(<Component />));
const switchLanguage = language => act(async () => setUiLanguage(language));
function setInput(input, value) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); setUiLanguage('sl');
  useAppStore.setState({ account: { id: 'adult', email: 'adult@example.test', firstName: 'Анна', role: 'parent' }, token: null, students: [{ id: 'kid', name: 'Миша' }], activeStudentId: 'kid', sessions: [], topicRecords: [] });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); setUiLanguage('ru'); useAppStore.setState(initial, true); });

it('keeps profile edits and account deletion confirmation intact across languages', async () => {
  await mount(AccountScreen);
  expect(host.querySelector('h1').textContent).toBe('Račun');
  expect(host.textContent).toContain('Geslo');
  expect(host.textContent).not.toContain('undefined');
  await act(async () => host.querySelector('[aria-label="Uredi profil"]').click());
  await act(async () => setInput(host.querySelector('[placeholder="Ime"]'), 'Новое имя'));
  await act(async () => button('Izbriši račun').click());
  await act(async () => setInput(host.querySelector('[placeholder="E-pošta za potrditev"]'), 'adult@example.test'));
  expect(button('Izbriši račun').disabled).toBe(false);
  await switchLanguage('ru');
  expect(host.querySelector('[placeholder="Имя"]').value).toBe('Новое имя');
  expect(host.querySelector('[placeholder="Email для подтверждения"]').value).toBe('adult@example.test');
  expect(button('Удалить аккаунт').disabled).toBe(false);
  expect(api.patch).not.toHaveBeenCalled(); expect(api.delete).not.toHaveBeenCalled();
});

it('updates a password validation error when language changes without submitting or clearing input', async () => {
  await mount(AccountScreen);
  await act(async () => button('Spremeni geslo').click());
  const form = host.querySelector('form');
  await act(async () => {
    setInput(form.querySelector('[autocomplete="current-password"]'), 'original');
    setInput(form.querySelector('[placeholder="Novo geslo (vsaj 8 znakov)"]'), 'short');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  expect(form.textContent).toContain('Novo geslo mora imeti vsaj 8 znakov');
  await switchLanguage('ru');
  expect(form.textContent).toContain('Новый пароль должен содержать минимум 8 символов');
  expect(form.querySelector('[autocomplete="current-password"]').value).toBe('original');
  expect(api.post).not.toHaveBeenCalled();
});

it('preserves the expanded FAQ and statistics period across live switching', async () => {
  await mount(HelpScreen);
  expect(host.textContent).toContain('Pogosta vprašanja');
  await act(async () => button('Kako spremenim temo ali način vadbe?').click());
  await switchLanguage('ru');
  expect(host.querySelector('.faq-item--open').textContent).toContain('Как поменять тему или режим занятия?');
  await mount(() => <StatisticsScreen onClose={() => {}} />);
  await act(async () => {
    const select=host.querySelectorAll('select')[1]; select.value='all'; select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await switchLanguage('sl');
  expect(host.querySelectorAll('select')[1].value).toBe('all');
  expect(host.textContent).toContain('V izbranem obdobju ni učnih ur.');
  expect(api.get).not.toHaveBeenCalled();
});
