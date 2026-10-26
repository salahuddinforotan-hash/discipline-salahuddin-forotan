import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import {
  Bell,
  BookOpen,
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  Download,
  Flame,
  Info,
  Languages,
  HardDrive,
  KeyRound,
  Laptop,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Moon,
  Palette,
  Play,
  Sparkles,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Trash2,
  UserRound,
  Volume2,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api, defaultAppSettings } from "../services/api";
import type {
  AccentPreference,
  AppSettings,
  AuthUser,
  MoodPreference,
  ThemePreference,
} from "../services/api";
import {
  announceSettingsUpdated,
  applyAppearance,
  cacheAppSettings,
  mergeAppSettings,
} from "../services/preferences";
import { applyLanguage } from "../services/language";
import { isNativeNotificationsAvailable, requestNativeNotificationPermission, testNativeNotificationSound } from "../services/nativeNotifications";

type SectionCardProps = {
  title: string;
  description: string;
  Icon: LucideIcon;
  children: ReactNode;
};

function SectionCard({ title, description, Icon, children }: SectionCardProps) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3 border-b border-white/[0.06] pb-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-slate-950/40 text-slate-400">
          <Icon size={17} />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-200">{title}</p>
        {description && <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full border transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 ${checked ? "border-indigo-300/40 bg-indigo-300/80" : "border-white/10 bg-slate-950/70"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  min,
  max,
  step,
  autoComplete,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium text-slate-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        autoComplete={autoComplete}
        className="h-11 w-full rounded-xl border border-white/[0.08] bg-slate-950/50 px-3.5 text-sm text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-indigo-300/40 focus:ring-2 focus:ring-indigo-300/[0.08]"
      />
    </label>
  );
}

const sections: Array<{ slug: string; label: string; description: string; Icon: LucideIcon }> = [
  { slug: "profile", label: "Profile", description: "Name, email, photo, and password", Icon: UserRound },
  { slug: "appearance", label: "Appearance", description: "Theme, accent, and sidebar density", Icon: Palette },
  { slug: "region", label: "Language & Region", description: "Language, calendar, and week start", Icon: Languages },
  { slug: "notifications", label: "Notifications", description: "Reminders and alerts you actually use", Icon: Bell },
  { slug: "dashboard", label: "Dashboard", description: "Daily discipline and journal defaults", Icon: SlidersHorizontal },
  { slug: "finance", label: "Finance", description: "Currency and spending alerts", Icon: CircleDollarSign },
  { slug: "ai", label: "AI", description: "Provider, privacy, memory, and history", Icon: Sparkles },
  { slug: "security", label: "Security & Privacy", description: "Session, privacy, and account deletion", Icon: ShieldCheck },
  { slug: "data", label: "Data & Storage", description: "Export your account records", Icon: HardDrive },
  { slug: "backup", label: "Backup & Recovery", description: "Export a backup of your data", Icon: Download },
  { slug: "about", label: "About", description: "App info and version", Icon: Info },
];

function AISettingsCard() {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof api.getAIStatus>> | null>(null);
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof api.getAISettings>> | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [clearing, setClearing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [savingProvider, setSavingProvider] = useState(false);
  const [providerChoice, setProviderChoice] = useState<NonNullable<Awaited<ReturnType<typeof api.getAISettings>>["provider"]>>("server-default");
  const [modelChoice, setModelChoice] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([api.getAIStatus(), api.getAISettings()]).then(([statusResult, settingsResult]) => {
      if (cancelled) return;
      if (statusResult.status === "fulfilled") setStatus(statusResult.value);
      if (settingsResult.status === "fulfilled") {
        setSettings(settingsResult.value);
        setProviderChoice(settingsResult.value.provider ?? "server-default");
        setModelChoice(settingsResult.value.model ?? (statusResult.status === "fulfilled" ? statusResult.value.model ?? "" : ""));
      }
      if (statusResult.status === "rejected" && settingsResult.status === "rejected") {
        setError("Could not load AI settings.");
      }
    });
    return () => { cancelled = true; };
  }, []);

  async function update(patch: Partial<NonNullable<typeof settings>>) {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      setMessage("");
      setError("");
      setSettings(await api.saveAISettings(next));
      setMessage("Saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save AI settings.");
    }
  }

  async function clearHistory() {
    setClearing(true);
    try {
      await api.clearAIHistory();
      setMessage("AI conversation history cleared.");
      setError("");
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : "Could not clear AI history.");
    } finally {
      setClearing(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setError("");
    setMessage("");
    try {
      const result = await api.testAIProvider();
      setMessage(result.message);
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "The AI provider connection failed.");
    } finally {
      setTesting(false);
    }
  }

  async function saveProviderSelection() {
    if (!settings) return;
    setSavingProvider(true);
    setError("");
    setMessage("");
    try {
      const saved = await api.saveAISettings({
        ...settings,
        provider: providerChoice,
        model: modelChoice.trim() || null,
      });
      setSettings(saved);
      setProviderChoice(saved.provider);
      setModelChoice(saved.model ?? "");
      try { setStatus(await api.getAIStatus()); } catch { /* Keep the selected values and report that saving succeeded. */ }
      setMessage("Provider and model saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the AI provider and model.");
    } finally {
      setSavingProvider(false);
    }
  }

  return (
    <SectionCard title="AI" description="Provider, privacy, memory, and history controls for the assistant." Icon={Sparkles}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/[0.06] bg-slate-950/30 p-3">
          <p className="text-xs font-medium text-slate-400">Provider</p>
          <p className="mt-1 text-sm text-white">{status?.provider ?? "Loading…"}</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-slate-950/30 p-3">
          <p className="text-xs font-medium text-slate-400">Model</p>
          <p className="mt-1 text-sm text-white">{status?.model ?? "Not selected"}</p>
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-white/[0.07] bg-slate-950/25 p-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Choose provider and model</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">Choose which AI service and model your assistant uses. The service connection must also be available on the app server.</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label>
            <span className="mb-1.5 block text-xs font-medium text-slate-400">Provider</span>
            <select value={providerChoice} onChange={(event) => setProviderChoice(event.target.value as typeof providerChoice)} className="h-11 w-full rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 text-sm text-slate-200 outline-none focus:border-violet-300/40">
              <option value="server-default">Use server default</option>
              <option value="ollama">Ollama · self-hosted</option>
              <option value="openai">OpenAI</option>
              <option value="openai-compatible">OpenAI-compatible service</option>
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-slate-400">Model name</span>
            <input value={modelChoice} onChange={(event) => setModelChoice(event.target.value)} maxLength={120} placeholder={providerChoice === "ollama" ? "e.g. qwen2.5:7b" : providerChoice === "openai" ? "Model ID enabled on your server" : "Model ID from the configured service"} className="h-11 w-full rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-violet-300/40" />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-[11px] leading-relaxed text-slate-500">OpenAI keys and provider endpoints stay in the server configuration. This screen never asks for or stores an API key.</p>
          <button type="button" onClick={() => void saveProviderSelection()} disabled={savingProvider || !settings} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-violet-200 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-violet-100 disabled:opacity-50">
            {savingProvider ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />}
            {savingProvider ? "Saving…" : "Save provider"}
          </button>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        {status?.configured
          ? status.local
            ? "Self-hosted processing: relevant summaries are sent only to your configured Ollama server, not to a public AI provider."
            : "External provider: relevant summaries of your data are sent to the configured AI provider. Your API key is stored on the server, never in the browser."
          : "No provider is configured. Use OpenAI with AI_PROVIDER=openai, AI_MODEL, and AI_API_KEY; or run Ollama and set AI_PROVIDER=ollama, OLLAMA_BASE_URL, and OLLAMA_MODEL on the server."}
      </p>
      {status && <p role="status" className="mt-2 text-xs leading-relaxed text-slate-400">{status.message}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void testConnection()} disabled={testing || !status?.configured} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-violet-300/20 bg-violet-300/[0.06] px-3 py-2 text-xs font-medium text-violet-100 transition hover:bg-violet-300/[0.1] disabled:opacity-50">
          {testing ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {testing ? "Testing…" : "Test AI connection"}
        </button>
        <p className="text-[11px] text-slate-600">Provider keys belong in the server environment. They are never stored in this app or exposed to your phone.</p>
      </div>
      <div className="mt-4 border-t border-white/[0.06] pt-1">
        <ToggleRow
          title="Conversation memory"
          description="Let the assistant use your earlier messages in the same conversation as context."
          checked={settings?.memory_enabled ?? true}
          onChange={(memory_enabled) => void update({ memory_enabled })}
        />
        <ToggleRow
          title="Share journal metadata with AI"
          description="Off by default. When enabled, only mood counts and discipline scores are shared — never journal text."
          checked={settings?.journal_sharing_enabled ?? false}
          onChange={(journal_sharing_enabled) => void update({ journal_sharing_enabled })}
        />
      </div>
      <div className="mt-4">
        <button
          type="button"
          onClick={() => void clearHistory()}
          disabled={clearing}
          className="inline-flex items-center gap-2 rounded-lg border border-rose-300/20 bg-rose-300/[0.06] px-3 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-300/[0.12] disabled:opacity-50"
        >
          <Trash2 size={14} /> {clearing ? "Clearing…" : "Clear AI history"}
        </button>
      </div>
      {message && <p className="mt-3 text-xs text-emerald-300">{message}</p>}
      {error && <p role="alert" className="mt-3 text-xs text-rose-300">{error}</p>}
    </SectionCard>
  );
}

function Settings() {
  const navigate = useNavigate();
  const { category: rawCategory } = useParams();
  const category = sections.some((section) => section.slug === rawCategory) ? rawCategory : undefined;
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);
  const [profile, setProfile] = useState<Pick<AuthUser, "full_name" | "email">>({ full_name: "", email: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [initialSettings, setInitialSettings] = useState<AppSettings>(defaultAppSettings);
  const [initialProfile, setInitialProfile] = useState<Pick<AuthUser, "full_name" | "email">>({ full_name: "", email: "" });
  const [nativeNotificationBusy, setNativeNotificationBusy] = useState(false);
  const [nativeNotificationMessage, setNativeNotificationMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function loadSettings() {
      try {
        const [savedSettings, user] = await Promise.all([api.getAppSettings(), api.me()]);
        if (!active) return;
        const normalized = mergeAppSettings(savedSettings);
        const nextProfile = { full_name: user.full_name, email: user.email };
        setSettings(normalized);
        setInitialSettings(normalized);
        setProfile(nextProfile);
        setInitialProfile(nextProfile);
        cacheAppSettings(normalized);
        applyAppearance(normalized.appearance.theme, normalized.appearance.accent, normalized.appearance.reduce_animations);
        applyLanguage(normalized.appearance.language);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load settings.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadSettings();
    return () => { active = false; };
  }, []);

  const isDirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(initialSettings) ||
      profile.full_name !== initialProfile.full_name || profile.email !== initialProfile.email,
    [settings, initialSettings, profile, initialProfile],
  );

  function updateSection<K extends keyof AppSettings>(section: K, changes: Partial<AppSettings[K]>) {
    setSettings((current) => ({
      ...current,
      [section]: { ...current[section], ...changes },
    }));
    setSavedMessage("");
  }

  function updateAppearance(changes: Partial<AppSettings["appearance"]>) {
    setSettings((current) => {
      const appearance = { ...current.appearance, ...changes };
      applyAppearance(appearance.theme, appearance.accent, appearance.reduce_animations);
      applyLanguage(appearance.language);
      return { ...current, appearance };
    });
    setSavedMessage("");
  }

  async function handleSaveChanges() {
    try {
      setSaving(true);
      setError("");
      setSavedMessage("");
      const [savedProfile, savedSettings] = await Promise.all([
        api.updateProfile({ full_name: profile.full_name.trim(), email: profile.email.trim() }),
        api.saveAppSettings(settings),
      ]);
      const normalized = mergeAppSettings(savedSettings);
      const nextProfile = { full_name: savedProfile.full_name, email: savedProfile.email };
      setProfile(nextProfile);
      setInitialProfile(nextProfile);
      setSettings(normalized);
      setInitialSettings(normalized);
      cacheAppSettings(normalized);
      applyAppearance(normalized.appearance.theme, normalized.appearance.accent, normalized.appearance.reduce_animations);
      applyLanguage(normalized.appearance.language);
      announceSettingsUpdated(normalized);
      setSavedMessage("Your settings are saved to your account.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save your settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Choose a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size > 1_500_000) {
      setError("Profile pictures must be 1.5 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        updateSection("account", { profile_picture: reader.result });
        setError("");
      }
    };
    reader.onerror = () => setError("Unable to read that image. Please choose another file.");
    reader.readAsDataURL(file);
  }

  async function handlePasswordUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setPasswordBusy(true);
      setError("");
      await api.updatePassword({ current_password: currentPassword, new_password: newPassword });
      setPasswordDialogOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setSavedMessage("Your password has been updated.");
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : "Unable to update your password.");
    } finally {
      setPasswordBusy(false);
    }
  }

  async function enableAndroidNotifications() {
    try {
      setNativeNotificationBusy(true);
      setNativeNotificationMessage("");
      const permission = await requestNativeNotificationPermission();
      setNativeNotificationMessage(permission.notifications
        ? permission.exactAlarms
          ? "Android notifications are enabled, with exact alarm timing, and upcoming reminders have been scheduled."
          : "Android notifications are enabled. Allow Alarms & reminders in Android settings for more accurate reminder times."
        : "Allow notifications in Android settings to receive device reminders.");
    } catch (notificationError) {
      setNativeNotificationMessage(notificationError instanceof Error ? notificationError.message : "Could not enable Android notifications.");
    } finally {
      setNativeNotificationBusy(false);
    }
  }

  async function testNotificationSound() {
    try {
      setNativeNotificationBusy(true);
      setNativeNotificationMessage("");
      await testNativeNotificationSound(settings.notifications.sound);
      setNativeNotificationMessage("A sound-test notification is scheduled to arrive in about two seconds.");
    } catch (soundError) {
      setNativeNotificationMessage(soundError instanceof Error ? soundError.message : "Could not schedule the sound test.");
    } finally {
      setNativeNotificationBusy(false);
    }
  }

  async function handleExport() {
    try {
      setExporting(true);
      setError("");
      const data = await api.exportAccountData();
      const file = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const fileUrl = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = `discipline-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(fileUrl);
      setSavedMessage("Your data export is ready.");
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Unable to export your data.");
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!deletePassword) {
      setDeleteError("Enter your current password to continue.");
      return;
    }
    if (deleteConfirmation !== "DELETE") {
      setDeleteError("Type DELETE exactly, using capital letters, to confirm.");
      return;
    }
    try {
      setDeleteBusy(true);
      setDeleteError("");
      await api.deleteAccount({ current_password: deletePassword, confirmation: "DELETE" });
      api.logout();
      navigate("/login", { replace: true });
    } catch (deleteError) {
      setDeleteError(deleteError instanceof Error ? deleteError.message : "Unable to delete this account.");
      setDeleteBusy(false);
    }
  }

  function signOutThisDevice() {
    api.logout();
    navigate("/login", { replace: true });
  }

  const initials = profile.full_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "SF";

  const moodOptions: Array<{ value: MoodPreference; label: string; emoji: string }> = [
    { value: "happy", label: "Happy", emoji: "😊" },
    { value: "calm", label: "Calm", emoji: "😌" },
    { value: "neutral", label: "Neutral", emoji: "😐" },
    { value: "sad", label: "Low", emoji: "😔" },
    { value: "frustrated", label: "Frustrated", emoji: "😤" },
    { value: "motivated", label: "Motivated", emoji: "🔥" },
  ];
  const themeOptions: Array<{ value: ThemePreference; label: string; Icon: LucideIcon }> = [
    { value: "dark", label: "Dark", Icon: Moon },
    { value: "light", label: "Light", Icon: Sun },
    { value: "system", label: "System", Icon: Laptop },
  ];
  const accentOptions: Array<{ value: AccentPreference; label: string; color: string }> = [
    { value: "indigo", label: "Indigo", color: "#a5b4fc" },
    { value: "violet", label: "Violet", color: "#c4b5fd" },
    { value: "blue", label: "Blue", color: "#93c5fd" },
    { value: "emerald", label: "Emerald", color: "#6ee7b7" },
    { value: "rose", label: "Rose", color: "#fda4af" },
  ];

  return (
    <section className="mx-auto max-w-5xl space-y-6 pb-28">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Preferences</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{category ? ({ account: "Account", notifications: "Notifications", appearance: "Appearance", language: "Language", calendar: "Date & Calendar", security: "Privacy & Security", data: "Data & Backup", preferences: "App Preferences", finance: "Finance", about: "About" } as Record<string, string>)[category] ?? "Settings" : "Settings"}</h1>
          <p className="mt-2 text-sm text-slate-400">Manage your account and Discipline experience.</p>
        </div>
        {isDirty && !loading && <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-amber-300/15 bg-amber-300/[0.07] px-3 py-1.5 text-xs text-amber-100/80 sm:self-auto"><Info size={13} /> Unsaved changes</span>}
      </header>

      {error && <div role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/[0.08] px-4 py-3 text-sm text-rose-100">{error}</div>}
      {savedMessage && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.06] px-4 py-3 text-sm text-emerald-100"><Check size={15} /> {savedMessage}</div>}



      {loading ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-12 text-center text-sm text-slate-500"><LoaderCircle size={18} className="mx-auto mb-3 animate-spin" />Loading your settings…</div>
      ) : (
        <div className="flex flex-col gap-5 lg:flex-row">
          <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto pb-1 lg:w-56 lg:shrink-0 lg:flex-col lg:overflow-visible lg:pb-0">
            {sections.map(({ slug, label, Icon }) => (
              <Link key={slug} to={`/settings/${slug}`} aria-current={category === slug ? "page" : undefined} className={`inline-flex min-h-10 shrink-0 items-center gap-2.5 rounded-xl px-3 text-sm transition lg:px-3.5 ${category === slug ? "bg-white/[0.08] font-medium text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-white"}`}>
                <Icon size={15} />{label}
              </Link>
            ))}
          </nav>
          <div className="min-w-0 flex-1 space-y-5">
          {!category && (
            <div className="grid gap-3 sm:grid-cols-2">
              {sections.map(({ slug, label, description, Icon }) => (
                <Link key={slug} to={`/settings/${slug}`} className="flex min-h-20 items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 transition hover:bg-white/[0.06]">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-slate-950/40 text-slate-300"><Icon size={17} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-white">{label}</span><span className="mt-1 block text-xs text-slate-500">{description}</span></span>
                  <ChevronRight size={16} className="shrink-0 text-slate-500" />
                </Link>
              ))}
            </div>
          )}
          {category && <Link to="/settings" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm text-slate-300 hover:bg-white/[0.05]"><ArrowLeft size={16}/> Back to Settings</Link>}
          <div className={category ? "space-y-5" : "hidden"}>
          {category === "profile" && <SectionCard title="Profile" description="Your profile details and sign-in credentials." Icon={UserRound}>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex shrink-0 items-center gap-4 sm:block">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-indigo-300/10 text-lg font-semibold text-indigo-200">
                  {settings.account.profile_picture ? <img src={settings.account.profile_picture} alt="Your profile" className="h-full w-full object-cover" /> : initials}
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/[0.05] sm:mt-3">
                  <UserRound size={14} /> Change photo
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => void handleAvatarChange(event)} />
                </label>
                {settings.account.profile_picture && <button type="button" onClick={() => updateSection("account", { profile_picture: null })} className="mt-3 block text-xs text-slate-500 hover:text-slate-300 sm:mx-auto">Remove photo</button>}
              </div>
              <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2">
                <InputField label="Name" value={profile.full_name} onChange={(full_name) => setProfile((current) => ({ ...current, full_name }))} autoComplete="name" />
                <InputField label="Email" type="email" value={profile.email} onChange={(email) => setProfile((current) => ({ ...current, email }))} autoComplete="email" />
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
              <div><p className="text-sm font-medium text-slate-200">Password</p><p className="mt-1 text-xs text-slate-500">Update the password used to sign in.</p></div>
              <button type="button" onClick={() => { setError(""); setPasswordDialogOpen(true); }} className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/[0.05] hover:text-white"><KeyRound size={14} /> Change password <ChevronRight size={14} /></button>
            </div>
          </SectionCard>}

          <div className="grid gap-5 lg:grid-cols-2">
            {category === "notifications" && <SectionCard title="Notifications" description="Choose which reminders are saved for your account and shown throughout the app." Icon={Bell}>
              <div className="divide-y divide-white/[0.06]">
                <ToggleRow title="Task alerts" description="Upcoming, due, and overdue task reminders." checked={settings.notifications.late_tasks} onChange={(late_tasks) => updateSection("notifications", { late_tasks })} />
                <ToggleRow title="Habit alerts" description="Scheduled reminders, missed periods, and active streak reminders." checked={settings.notifications.missed_habits} onChange={(missed_habits) => updateSection("notifications", { missed_habits })} />
                <ToggleRow title="Goal alerts" description="Upcoming, due, overdue, and completed goal reminders." checked={settings.notifications.goal_deadlines} onChange={(goal_deadlines) => updateSection("notifications", { goal_deadlines })} />
                <ToggleRow title="Daily discipline reminder" description="Check your target at the reminder time below." checked={settings.notifications.daily_discipline} onChange={(daily_discipline) => updateSection("notifications", { daily_discipline })} />
                <ToggleRow title="Evening journal reminder" description="Remind you when today’s private entry is still empty." checked={settings.notifications.journal_reminder} onChange={(journal_reminder) => updateSection("notifications", { journal_reminder })} />
              </div>
              <div className="mt-4 flex flex-col gap-3 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium text-slate-200"><Volume2 size={15} /> Notification sound</p>
                  <p className="mt-1 text-xs text-slate-500">Choose the sound played by scheduled phone reminders.</p>
                </div>
                <select value={settings.notifications.sound} onChange={(event) => updateSection("notifications", { sound: event.target.value as AppSettings["notifications"]["sound"] })} className="min-h-10 rounded-lg border border-white/[0.09] bg-slate-950 px-3 text-xs text-slate-200 outline-none focus:border-indigo-300/40">
                  <option value="alarm">Discipline alarm chime</option>
                  <option value="system">Phone system sound</option>
                </select>
              </div>
              {isNativeNotificationsAvailable() ? (
                <div className="mt-4 border-t border-white/[0.06] pt-4">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void enableAndroidNotifications()} disabled={nativeNotificationBusy} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-indigo-300/20 bg-indigo-300/[0.06] px-3 py-2 text-xs font-medium text-indigo-100 transition hover:bg-indigo-300/[0.1] disabled:opacity-50">
                      {nativeNotificationBusy ? <LoaderCircle size={14} className="animate-spin" /> : <Bell size={14} />}
                      {nativeNotificationBusy ? "Enabling…" : "Enable Android notifications"}
                    </button>
                    <button type="button" onClick={() => void testNotificationSound()} disabled={nativeNotificationBusy} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/[0.09] px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/[0.05] disabled:opacity-50">
                      {nativeNotificationBusy ? <LoaderCircle size={14} className="animate-spin" /> : <Play size={14} />}
                      Test sound
                    </button>
                  </div>
                  {nativeNotificationMessage && <p role="status" className="mt-2 text-xs leading-relaxed text-slate-400">{nativeNotificationMessage}</p>}
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-600">Android’s notification-channel and Do Not Disturb settings can override the selected sound or volume.</p>
                </div>
              ) : (
                <p className="mt-4 text-[11px] leading-relaxed text-slate-600">The server checks deadlines once a minute. Install the Android app and allow notification and Alarms & reminders access to receive audible scheduled alerts on your phone.</p>
              )}
            </SectionCard>}

            {category === "dashboard" && <SectionCard title="Daily discipline" description="Set the daily target and when your check-in reminders appear." Icon={Flame}>
              <div className="grid gap-4 sm:grid-cols-2">
                <InputField label="Daily reminder time" type="time" value={settings.discipline.reminder_time} onChange={(reminder_time) => updateSection("discipline", { reminder_time })} />
                <InputField label="Daily discipline goal" type="number" min={0} max={100} step={1} value={settings.discipline.daily_goal} onChange={(value) => updateSection("discipline", { daily_goal: Math.min(100, Math.max(0, Number(value) || 0)) })} />
              </div>
              <p className="mt-2 text-xs text-slate-600">Your target is a score from 0 to 100 percent.</p>
              <div className="mt-4 border-t border-white/[0.06] pt-1">
                <ToggleRow title="Streak reminders" description="Show a reminder if no daily habit is complete by your reminder time." checked={settings.discipline.streak_reminders} onChange={(streak_reminders) => updateSection("discipline", { streak_reminders })} />
              </div>
            </SectionCard>}

            {category === "appearance" && <SectionCard title="Appearance" description="Tune the look and navigation density of your workspace." Icon={Palette}>
              <div>
                <p className="mb-2 text-xs font-medium text-slate-400">Theme</p>
                <div className="grid grid-cols-3 gap-2">
                  {themeOptions.map(({ value, label, Icon }) => (
                    <button key={value} type="button" aria-pressed={settings.appearance.theme === value} onClick={() => updateAppearance({ theme: value })} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-medium transition ${settings.appearance.theme === value ? "border-indigo-300/30 bg-indigo-300/[0.1] text-white" : "border-white/[0.07] text-slate-400 hover:bg-white/[0.04] hover:text-white"}`}><Icon size={14} /> {label}</button>
                  ))}
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between gap-4">
                <div><p className="text-sm font-medium text-slate-200">Accent color</p><p className="mt-1 text-xs text-slate-500">Used for highlights and primary actions.</p></div>
                <div className="flex items-center gap-2">
                  {accentOptions.map((accent) => (
                    <button key={accent.value} type="button" aria-label={`${accent.label} accent`} aria-pressed={settings.appearance.accent === accent.value} onClick={() => updateAppearance({ accent: accent.value })} className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition ${settings.appearance.accent === accent.value ? "border-white/80" : "border-transparent hover:border-white/30"}`}><span className="h-5 w-5 rounded-full" style={{ backgroundColor: accent.color }} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4 border-t border-white/[0.06] pt-1">
                <ToggleRow title="Compact sidebar" description="Use an icon-only sidebar to leave more room for your pages." checked={settings.appearance.compact_sidebar} onChange={(compact_sidebar) => updateAppearance({ compact_sidebar })} />
                <ToggleRow title="Reduce animations" description="Minimize interface motion and transitions." checked={settings.appearance.reduce_animations} onChange={(reduce_animations) => updateAppearance({ reduce_animations })} />
              </div>
            </SectionCard>}

            {category === "region" && <SectionCard title="Language" description="Choose a language supported throughout the app." Icon={Languages}>
              <label className="block max-w-sm"><span className="mb-2 block text-xs font-medium text-slate-400">Application language</span><select value={settings.appearance.language} onChange={(event) => updateAppearance({ language: event.target.value as AppSettings["appearance"]["language"] })} className="h-11 w-full rounded-xl border border-white/[0.08] bg-slate-950/50 px-3.5 text-sm text-slate-200"><option value="en">English</option><option value="fa">فارسی</option></select><span className="mt-1.5 block text-[11px] text-slate-600">The app currently supports English and Persian (فارسی).</span></label>
            </SectionCard>}

            {category === "region" && <SectionCard title="Date & Calendar" description="Change how dates are displayed. Stored dates remain standard database dates." Icon={CalendarDays}>
              <label className="block max-w-sm"><span className="mb-2 block text-xs font-medium text-slate-400">Calendar</span><select value={settings.date_calendar.calendar} onChange={(event) => { setSettings((current) => ({ ...current, date_calendar: { ...current.date_calendar, calendar: event.target.value as "solar" | "gregorian" } })); setSavedMessage(""); }} className="h-11 w-full rounded-xl border border-white/[0.08] bg-slate-950/50 px-3.5 text-sm text-slate-200"><option value="solar">Solar Hijri · Afghan month names</option><option value="gregorian">Gregorian</option></select><span className="mt-1.5 block text-[11px] text-slate-600">Monthly reports continue to use Solar Hijri for grouping.</span></label>
              <label className="mt-4 block max-w-sm"><span className="mb-2 block text-xs font-medium text-slate-400">Week starts on</span><select value={settings.date_calendar.week_start} onChange={(event) => { setSettings((current) => ({ ...current, date_calendar: { ...current.date_calendar, week_start: event.target.value as "monday" | "sunday" } })); setSavedMessage(""); }} className="h-11 w-full rounded-xl border border-white/[0.08] bg-slate-950/50 px-3.5 text-sm text-slate-200"><option value="monday">Monday</option><option value="sunday">Sunday</option></select><span className="mt-1.5 block text-[11px] text-slate-600">Affects habit weekly tracking.</span></label>
            </SectionCard>}

            {category === "dashboard" && <SectionCard title="Journal" description="Set a starting mood and keep your reflections private." Icon={BookOpen}>
              <label className="block">
                <span className="mb-2 block text-xs font-medium text-slate-400">Default mood</span>
                <select value={settings.journal.default_mood ?? ""} onChange={(event) => updateSection("journal", { default_mood: (event.target.value || null) as MoodPreference | null })} className="h-11 w-full rounded-xl border border-white/[0.08] bg-slate-950/50 px-3.5 text-sm text-slate-200 outline-none focus:border-indigo-300/40">
                  <option value="">No default</option>
                  {moodOptions.map((mood) => <option key={mood.value} value={mood.value}>{mood.emoji} {mood.label}</option>)}
                </select>
              </label>
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-300/10 bg-emerald-300/[0.035] p-3.5">
                <LockKeyhole size={16} className="mt-0.5 shrink-0 text-emerald-200/80" />
                <div><p className="text-xs font-semibold text-slate-200">Private by default</p><p className="mt-1 text-xs leading-relaxed text-slate-500">Journal entries are visible only to your account. Sharing is not enabled.</p></div>
              </div>
            </SectionCard>}

            {category === "finance" && <SectionCard title="Finance" description="Choose the currency and spending alerts." Icon={CircleDollarSign}>
              <label className="block">
                <span className="mb-2 block text-xs font-medium text-slate-400">Currency</span>
                <select value={settings.finance.currency} disabled className="h-11 w-full rounded-xl border border-white/[0.08] bg-slate-950/50 px-3.5 text-sm text-slate-300 outline-none disabled:cursor-not-allowed disabled:opacity-80"><option value="AFN">AFN · Afghan Afghani</option></select>
                <span className="mt-1.5 block text-[11px] text-slate-600">AFN is the currency currently supported by finance entries.</span>
              </label>
              <div className="mt-4 border-t border-white/[0.06] pt-1">
                <ToggleRow title="Monthly spending alerts" description="Show an alert when expenses reach your limit." checked={settings.finance.monthly_spending_alert} onChange={(monthly_spending_alert) => updateSection("finance", { monthly_spending_alert })} />
              </div>
              <div className="mt-3 max-w-xs">
                <InputField label="Monthly spending limit (AFN)" type="number" min={0} step={100} value={settings.finance.monthly_spending_limit} onChange={(value) => updateSection("finance", { monthly_spending_limit: Math.max(0, Number(value) || 0) })} />
              </div>
            </SectionCard>}

            {category === "ai" && <AISettingsCard />}

            {category === "security" && <SectionCard title="Privacy & security" description="Review supported account access and privacy controls." Icon={ShieldCheck}>
              <div className="divide-y divide-white/[0.06]">
                <div className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div><p className="text-sm font-medium text-slate-200">Active session</p><p className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-500"><Laptop size={13} /> This browser</p></div>
                  <button type="button" onClick={signOutThisDevice} className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/[0.05] hover:text-white"><LogOut size={14} /> Sign out</button>
                </div>
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-white/[0.06] bg-slate-950/30 p-3 text-[11px] leading-relaxed text-slate-500"><Info size={14} className="mt-0.5 shrink-0" /> You can end this browser session here. Signing out other devices is not available.</div>
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-white/[0.06] bg-slate-950/30 p-3"><LockKeyhole size={15} className="mt-0.5 text-emerald-200"/><p className="text-xs leading-relaxed text-slate-400">Journal records are scoped to your signed-in account and are not shared with other users.</p></div>
            </SectionCard>}

            {category === "data" && <SectionCard title="Data & Backup" description="Download an export of the data stored in your account." Icon={HardDrive}>
              <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-medium text-slate-200">Export my data</p><p className="mt-1 text-xs text-slate-500">Includes account records, settings, and saved progress history.</p></div><button type="button" onClick={() => void handleExport()} disabled={exporting} className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/[0.05] disabled:opacity-50">{exporting ? <LoaderCircle size={14} className="animate-spin" /> : <Download size={14} />} {exporting ? "Preparing…" : "Export data"}</button></div>
              <p className="mt-4 text-xs text-slate-600">Data import, restore, and server backup controls are not part of the current account API.</p>
            </SectionCard>}

            {category === "backup" && <SectionCard title="Backup & Recovery" description="Keep a copy of your data outside the app." Icon={Download}>
              <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-medium text-slate-200">Download a backup</p><p className="mt-1 text-xs text-slate-500">A JSON copy of your account records, settings, and progress history.</p></div><button type="button" onClick={() => void handleExport()} disabled={exporting} className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/[0.05] disabled:opacity-50">{exporting ? <LoaderCircle size={14} className="animate-spin" /> : <Download size={14} />} {exporting ? "Preparing…" : "Download backup (JSON)"}</button></div>
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300/10 bg-amber-300/[0.035] p-3 text-[11px] leading-relaxed text-amber-100/70"><Info size={14} className="mt-0.5 shrink-0" /> Automatic or cloud backups and one-click restore are not available in this build. Importing a backup is not currently supported.</div>
            </SectionCard>}

            {category === "about" && <SectionCard title="About Discipline" description="A personal operating system for steady progress." Icon={Info}>
              <div className="flex items-center justify-between gap-4 py-1">
                <div><p className="text-sm font-medium text-slate-200">Discipline</p><p className="mt-1 text-xs text-slate-500">Created by Salahuddin Forotan</p></div>
                <span className="rounded-full border border-white/[0.07] px-2.5 py-1 text-[10px] text-slate-500">Version 1.0</span>
              </div>
            </SectionCard>}
          </div>

          {category === "security" && <section className="rounded-2xl border border-rose-300/20 bg-rose-300/[0.035] p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-300/15 bg-rose-300/[0.07] text-rose-200"><Trash2 size={17} /></span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-rose-100">Danger zone</h2>
                <p className="mt-1 text-xs leading-relaxed text-rose-100/60">Delete your account and permanently remove its tasks, goals, habits, finance records, learning plans, and journal entries.</p>
                <button type="button" onClick={() => { setDeletePassword(""); setDeleteConfirmation(""); setDeleteError(""); setError(""); setDeleteDialogOpen(true); }} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-rose-300/25 px-3.5 py-2.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-300/[0.1]"><Trash2 size={14} /> Delete account</button>
              </div>
            </div>
          </section>}
          </div>
          </div>
        </div>
      )}

      {!loading && <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.1] bg-slate-900/95 p-3 shadow-xl shadow-black/20 backdrop-blur">
        <p className="px-2 text-xs text-slate-500">{isDirty ? "You have changes to save." : savedMessage || "Your preferences are up to date."}</p>
        <button type="button" onClick={() => void handleSaveChanges()} disabled={!isDirty || saving} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-indigo-300 px-4 py-2.5 text-xs font-semibold text-slate-950 transition hover:bg-indigo-200 disabled:cursor-not-allowed disabled:opacity-45">{saving ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />} {saving ? "Saving…" : "Save changes"}</button>
      </div>}

      {passwordDialogOpen && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/75 px-4 py-8 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setPasswordDialogOpen(false); }}>
        <form role="dialog" aria-modal="true" aria-labelledby="change-password-title" onSubmit={(event) => void handlePasswordUpdate(event)} className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl shadow-black/50 sm:p-6">
          <div className="flex items-start justify-between gap-4"><div><h2 id="change-password-title" className="text-base font-semibold text-white">Change password</h2><p className="mt-1 text-xs text-slate-500">Verify your current password to continue.</p></div><button type="button" onClick={() => setPasswordDialogOpen(false)} aria-label="Close password dialog" className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.05] hover:text-white"><X size={16} /></button></div>
          <div className="mt-5 space-y-4"><InputField label="Current password" type="password" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" /><InputField label="New password" type="password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" placeholder="At least 8 characters" /></div>
          <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setPasswordDialogOpen(false)} className="rounded-lg px-3 py-2 text-xs text-slate-400 hover:text-white">Cancel</button><button type="submit" disabled={passwordBusy || !currentPassword || newPassword.length < 8} className="inline-flex items-center gap-2 rounded-lg bg-indigo-300 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50">{passwordBusy && <LoaderCircle size={14} className="animate-spin" />} Update password</button></div>
        </form>
      </div>}

      {deleteDialogOpen && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/80 px-4 py-8 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleteBusy) setDeleteDialogOpen(false); }}>
        <form role="dialog" aria-modal="true" aria-labelledby="delete-account-title" onSubmit={(event) => void handleDeleteAccount(event)} className="w-full max-w-md rounded-2xl border border-rose-300/20 bg-slate-900 p-5 shadow-2xl shadow-black/60 sm:p-6">
          <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-300/[0.1] text-rose-200"><Trash2 size={17} /></span><div className="flex-1"><div className="flex items-start justify-between gap-4"><h2 id="delete-account-title" className="text-base font-semibold text-white">Permanently delete account?</h2><button type="button" onClick={() => setDeleteDialogOpen(false)} aria-label="Close delete account dialog" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.05] hover:text-white"><X size={16} /></button></div><p className="mt-2 text-xs leading-relaxed text-slate-400">This cannot be undone. All of your Discipline data will be deleted. Enter your password and type <strong className="text-rose-100">DELETE</strong> to confirm.</p></div></div>
          {deleteError && <p role="alert" className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.08] px-3.5 py-3 text-xs leading-relaxed text-rose-100">{deleteError}</p>}
          <div className="mt-5 space-y-4"><InputField label="Current password" type="password" value={deletePassword} onChange={(value) => { setDeletePassword(value); setDeleteError(""); }} autoComplete="current-password" /><InputField label="Type DELETE to confirm" value={deleteConfirmation} onChange={(value) => { setDeleteConfirmation(value); setDeleteError(""); }} autoComplete="off" /><p className="-mt-2 text-[11px] text-slate-500">Type DELETE in capital letters. Use your current sign-in password above.</p></div>
          <div className="mt-6 flex justify-end gap-2"><button type="button" disabled={deleteBusy} onClick={() => { setDeleteDialogOpen(false); setDeleteError(""); }} className="rounded-lg px-3 py-2 text-xs text-slate-400 hover:text-white">Cancel</button><button type="submit" disabled={deleteBusy || !deletePassword || deleteConfirmation !== "DELETE"} className="inline-flex items-center gap-2 rounded-lg border border-rose-300/25 bg-rose-300/[0.1] px-4 py-2 text-xs font-semibold text-rose-100 disabled:cursor-not-allowed disabled:opacity-40">{deleteBusy && <LoaderCircle size={14} className="animate-spin" />} {deleteBusy ? "Deleting account…" : "Delete all my data"}</button></div>
        </form>
      </div>}
    </section>
  );
}

export default Settings;
