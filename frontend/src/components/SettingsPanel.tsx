import { useState, useEffect } from "react";
import { themes } from "../themes";
import { getToken } from "../api";

interface Props {
  currentThemeId: string;
  onChangeTheme: (themeId: string) => void;
  onClose: () => void;
}

export default function SettingsPanel({ currentThemeId, onChangeTheme, onClose }: Props) {
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleChangePassword() {
    if (!oldPw || !newPw) return;
    setPwMsg("");
    setPwLoading(true);
    try {
      const res = await fetch("/api/password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ old_password: oldPw, new_password: newPw }),
      });
      if (res.ok) {
        setPwMsg("Password changed");
        setOldPw("");
        setNewPw("");
      } else {
        const data = await res.json().catch(() => ({}));
        setPwMsg(data.detail || "Failed");
      }
    } catch {
      setPwMsg("Failed");
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Settings</span>
          <button className="modal-close" onClick={onClose}>{"\u00D7"}</button>
        </div>
        <div className="modal-body">
          <div className="settings-row">
            <span className="settings-label">Theme</span>
            <select
              className="settings-select"
              value={currentThemeId}
              onChange={(e) => onChangeTheme(e.target.value)}
            >
              {themes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="settings-divider" />

          <div className="settings-section">
            <span className="settings-label">Change Password</span>
            <input
              className="settings-input"
              type="password"
              placeholder="Current password"
              value={oldPw}
              onChange={(e) => setOldPw(e.target.value)}
              autoComplete="current-password"
            />
            <input
              className="settings-input"
              type="password"
              placeholder="New password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleChangePassword()}
              autoComplete="new-password"
            />
            <button
              className="sidebar-button settings-pw-btn"
              onClick={handleChangePassword}
              disabled={!oldPw || !newPw || pwLoading}
            >
              {pwLoading ? "Changing..." : "Change"}
            </button>
            {pwMsg && (
              <span className={`settings-pw-msg ${pwMsg === "Password changed" ? "success" : ""}`}>
                {pwMsg}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
