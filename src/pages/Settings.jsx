import { useEffect, useState } from "react";
import { Settings as SettingsIcon, User, KeyRound, MonitorSmartphone, ImageIcon } from "lucide-react";
import { TEXT_SIZES, getTextSize, setTextSize } from "../utils/displayPrefs.js";
import { api, ApiError } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import Tooltip from "../components/ui/Tooltip.jsx";
import PhotoUploadCircle from "../components/ui/PhotoUploadCircle.jsx";
import { inputClass, labelClass, primaryButtonClass } from "../components/ui/formStyles.js";

function SettingsCard({ icon: Icon, title, description, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="mb-1 flex items-center gap-2">
        <Icon size={18} className="text-status-indigo" />
        <h2 className="font-heading text-base font-semibold text-slate-800">{title}</h2>
      </div>
      {description && <p className="mb-4 text-xs text-slate-500">{description}</p>}
      {children}
    </div>
  );
}

function ProfileSection() {
  const { admin, updateAdmin } = useAuth();
  const { notify } = useToast();
  const [displayName, setDisplayName] = useState(admin?.displayName || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const data = await api.put("/api/staff/settings/profile", { displayName });
      updateAdmin({ displayName: data.admin.displayName });
      notify("Profile updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsCard icon={User} title="Personal Profile" description="Your name as shown in the header and on reports you generate. Your login email is issued by the SAA Administrator.">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Display name</label>
            <input className={`${inputClass} mt-1`} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Login email</label>
            <input className={`${inputClass} mt-1 cursor-not-allowed bg-slate-50 text-slate-500`} value={admin?.username || ""} readOnly />
          </div>
        </div>
        {admin?.department && (
          <p className="text-xs text-slate-500">
            Department: <span className="font-medium text-slate-700">{admin.department}</span>
          </p>
        )}
        {error && <p className="text-xs font-medium text-status-danger">{error}</p>}
        <div className="flex justify-end">
          <Tooltip text="Saves your display name.">
            <button type="submit" disabled={saving} className={primaryButtonClass}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </Tooltip>
        </div>
      </form>
    </SettingsCard>
  );
}

// Profile photo. Saved the moment an image is picked (or removed).
function PhotoSection() {
  const { admin, updateAdmin } = useAuth();
  const { notify } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function save(file) {
    setError(null);
    setSaving(true);
    try {
      const data = await api.put("/api/staff/settings/photo", { fileId: file ? file.id : null });
      updateAdmin({ avatarFileId: data.admin.avatarFileId });
      notify(file ? "Profile photo updated." : "Profile photo removed.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the photo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsCard
      icon={ImageIcon}
      title="Profile Photo"
      description="Your picture, shown on your account in this portal."
    >
      <div className="flex flex-wrap items-center gap-5">
        <PhotoUploadCircle
          value={admin?.avatarFileId ? { id: admin.avatarFileId } : null}
          onChange={save}
          disabled={saving}
          caption="Profile photo"
          alt="Profile photo"
        />
        <p className="max-w-sm text-xs text-slate-500">
          Click the circle to choose an image (JPG, PNG, WEBP or GIF).
        </p>
      </div>
      {error && <p className="mt-3 text-xs font-medium text-status-danger">{error}</p>}
    </SettingsCard>
  );
}

function PasswordSection() {
  const { notify } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }
    setSaving(true);
    try {
      await api.put("/api/staff/settings/password", { currentPassword, newPassword });
      notify("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsCard icon={KeyRound} title="Change Password" description="You'll stay signed in on this device after changing it.">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className={labelClass}>Current password</label>
          <input type="password" className={`${inputClass} mt-1`} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>New password</label>
            <input type="password" className={`${inputClass} mt-1`} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Confirm new password</label>
            <input type="password" className={`${inputClass} mt-1`} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
        </div>
        {error && <p className="text-xs font-medium text-status-danger">{error}</p>}
        <div className="flex justify-end">
          <Tooltip text="Updates your login password — at least 8 characters.">
            <button type="submit" disabled={saving} className={primaryButtonClass}>
              {saving ? "Updating..." : "Update password"}
            </button>
          </Tooltip>
        </div>
      </form>
    </SettingsCard>
  );
}

function DisplaySection() {
  const { notify } = useToast();
  const [size, setSize] = useState(getTextSize);

  function choose(value) {
    setSize(value);
    setTextSize(value);
    notify("Display preference saved on this device.");
  }

  return (
    <SettingsCard icon={MonitorSmartphone} title="Interface Display" description="Text size for the whole portal. This is remembered on this device.">
      <div className="flex flex-wrap gap-2">
        {TEXT_SIZES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => choose(t.value)}
            aria-pressed={size === t.value}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
              size === t.value ? "border-status-indigo bg-status-indigo/10 text-status-indigo" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </SettingsCard>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl2 bg-status-indigo/10 text-status-indigo">
          <SettingsIcon size={22} />
        </div>
        <div>
          <h1 className="font-heading text-xl font-bold text-slate-800 sm:text-2xl">Settings</h1>
          <p className="text-sm text-slate-500">Your account, security and display preferences.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ProfileSection />
        <PhotoSection />
        <PasswordSection />
        <DisplaySection />
      </div>
    </div>
  );
}
