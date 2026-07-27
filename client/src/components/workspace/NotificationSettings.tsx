import { useState, useEffect } from "react";
import {
  CHANNELS,
  EVENT_TYPES,
  fetchNotificationConfigs,
  saveNotificationConfig,
  testNotification,
  fetchNotificationHistory,
  clearNotificationHistory,
  type NotificationChannel,
  type NotificationEventType,
  type NotificationConfig,
  type NotificationHistoryEntry,
} from "../../lib/notifications.js";

interface Props {
  onClose: () => void;
}

export default function NotificationSettings({ onClose }: Props) {
  const [configs, setConfigs] = useState<NotificationConfig[]>([]);
  const [history, setHistory] = useState<NotificationHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"channels" | "history">("channels");
  const [testing, setTesting] = useState<string | null>(null);
  const [expandedChannel, setExpandedChannel] = useState<NotificationChannel | null>(null);

  // Temp edit state per channel
  const [editEnabled, setEditEnabled] = useState<Record<string, boolean>>({});
  const [editEvents, setEditEvents] = useState<Record<string, Set<NotificationEventType>>>({});
  const [editConfig, setEditConfig] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [cfgs, hist] = await Promise.all([
        fetchNotificationConfigs(),
        fetchNotificationHistory(30),
      ]);
      setConfigs(cfgs);
      setHistory(hist);

      // Init edit state from configs
      const enabled: Record<string, boolean> = {};
      const events: Record<string, Set<NotificationEventType>> = {};
      const configMap: Record<string, Record<string, string>> = {};
      for (const c of cfgs) {
        enabled[c.channel] = c.enabled;
        events[c.channel] = new Set(c.events);
        configMap[c.channel] = c.config;
      }
      setEditEnabled(enabled);
      setEditEvents(events);
      setEditConfig(configMap);
    } finally {
      setLoading(false);
    }
  }

  function toggleChannelEnabled(channel: NotificationChannel) {
    setEditEnabled((prev) => ({ ...prev, [channel]: !prev[channel] }));
  }

  function toggleEvent(channel: NotificationChannel, event: NotificationEventType) {
    setEditEvents((prev) => {
      const current = new Set(prev[channel] || []);
      if (current.has(event)) {
        current.delete(event);
      } else {
        current.add(event);
      }
      return { ...prev, [channel]: current };
    });
  }

  function setConfigField(channel: NotificationChannel, key: string, value: string) {
    setEditConfig((prev) => ({
      ...prev,
      [channel]: { ...(prev[channel] || {}), [key]: value },
    }));
  }

  async function handleSave(channel: NotificationChannel) {
    setSaving(channel);
    try {
      const enabled = editEnabled[channel] || false;
      const events = Array.from(editEvents[channel] || []);
      const config = editConfig[channel] || {};

      await saveNotificationConfig(channel, enabled, events, config);
      await load();
    } finally {
      setSaving(null);
    }
  }

  async function handleTest(channel: NotificationChannel) {
    setTesting(channel);
    try {
      const config = editConfig[channel] || {};
      await testNotification(channel, config);
    } catch {
      // Test failed silently
    } finally {
      setTesting(null);
    }
  }

  async function handleClearHistory() {
    await clearNotificationHistory();
    setHistory([]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-[600px] mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <span className="text-[13px] font-semibold text-text">🔔 Notifikacije</span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0">
          <button
            onClick={() => setActiveTab("channels")}
            className={`flex-1 py-2 text-[11px] font-medium transition-colors ${
              activeTab === "channels"
                ? "text-accent border-b-2 border-accent"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            Kanali
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 py-2 text-[11px] font-medium transition-colors ${
              activeTab === "history"
                ? "text-accent border-b-2 border-accent"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            Povijest ({history.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="text-center py-8 text-text-muted text-[11px]">
              Učitavam...
            </div>
          )}

          {!loading && activeTab === "channels" && (
            <div className="p-3 space-y-2">
              {CHANNELS.map((channel) => {
                const enabled = editEnabled[channel.id] || false;
                const events = editEvents[channel.id] || new Set();
                const config = editConfig[channel.id] || {};
                const expanded = expandedChannel === channel.id;

                return (
                  <div
                    key={channel.id}
                    className="rounded-xl border border-border bg-surface overflow-hidden"
                  >
                    {/* Channel row */}
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <button
                        onClick={() => toggleChannelEnabled(channel.id)}
                        className={`w-8 h-[18px] rounded-full transition-colors shrink-0 ${
                          enabled ? "bg-accent" : "bg-surface-2 border border-border"
                        } relative`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-full absolute top-[2px] transition-transform ${
                            enabled
                              ? "left-[16px] bg-white"
                              : "left-[2px] bg-text-muted"
                          }`}
                        />
                      </button>
                      <span className="text-sm">{channel.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-medium text-text">
                          {channel.label}
                        </div>
                        <div className="text-[9px] text-text-muted">
                          {channel.description}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {channel.configFields.length > 0 && (
                          <button
                            onClick={() =>
                              setExpandedChannel(expanded ? null : channel.id)
                            }
                            className="text-[9px] text-text-muted hover:text-text px-1.5 py-0.5 rounded hover:bg-surface-2"
                          >
                            {expanded ? "▾" : "▸"} Config
                          </button>
                        )}
                        <button
                          onClick={() => handleTest(channel.id)}
                          disabled={testing === channel.id}
                          className="text-[9px] text-accent hover:text-accent-light px-1.5 py-0.5 rounded hover:bg-surface-2 disabled:opacity-40"
                        >
                          {testing === channel.id ? "⟳" : "Test"}
                        </button>
                      </div>
                    </div>

                    {/* Config fields (expandable) */}
                    {expanded && channel.configFields.length > 0 && (
                      <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
                        {channel.configFields.map((field) => (
                          <div key={field.key}>
                            <label className="text-[9px] text-text-muted uppercase tracking-wider font-medium mb-0.5 block">
                              {field.label}
                            </label>
                            <input
                              type={field.type || "text"}
                              value={config[field.key] || ""}
                              onChange={(e) =>
                                setConfigField(channel.id, field.key, e.target.value)
                              }
                              placeholder={field.placeholder}
                              className="w-full bg-surface-2 border border-border rounded-lg px-2.5 py-1.5 text-[11px] text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Event type toggles */}
                    {enabled && (
                      <div className="px-3 pb-2.5">
                        <div className="text-[9px] text-text-muted uppercase tracking-wider font-medium mb-1.5">
                          Događaji
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {EVENT_TYPES.map((evt) => {
                            const active = events.has(evt.id);
                            return (
                              <button
                                key={evt.id}
                                onClick={() => toggleEvent(channel.id, evt.id)}
                                className={`text-[9px] px-1.5 py-0.5 rounded-md transition-colors ${
                                  active
                                    ? "bg-accent-dim text-accent"
                                    : "bg-surface-2 text-text-muted hover:text-text-secondary"
                                }`}
                                title={evt.label}
                              >
                                {evt.icon} {evt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Save button */}
                    {enabled && (
                      <div className="px-3 pb-2.5">
                        <button
                          onClick={() => handleSave(channel.id)}
                          disabled={saving === channel.id}
                          className="text-[10px] text-white bg-accent hover:bg-accent-light px-3 py-1 rounded-lg transition-colors disabled:opacity-40"
                        >
                          {saving === channel.id ? "Spremam..." : "Spremi"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!loading && activeTab === "history" && (
            <div className="p-3">
              {history.length === 0 ? (
                <div className="text-center py-8 text-text-muted text-[11px]">
                  Nema povijesti notifikacija
                </div>
              ) : (
                <div className="space-y-1">
                  {history.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-start gap-2 px-2.5 py-2 rounded-lg hover:bg-surface-2/30 transition-colors"
                    >
                      <span
                        className={`text-[10px] mt-0.5 ${
                          h.success ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {h.success ? "✓" : "✕"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-medium text-text">
                            {h.title}
                          </span>
                          <span className="text-[8px] text-text-muted bg-surface-2 px-1 py-0.5 rounded">
                            {h.channel}
                          </span>
                        </div>
                        <div className="text-[9px] text-text-muted mt-0.5 truncate">
                          {h.body}
                        </div>
                        {h.error && (
                          <div className="text-[9px] text-red-400 mt-0.5">
                            {h.error}
                          </div>
                        )}
                      </div>
                      <span className="text-[8px] text-text-muted shrink-0">
                        {new Date(h.createdAt).toLocaleTimeString("hr-HR")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border shrink-0">
          <span className="text-[9px] text-text-muted">
            {configs.filter((c) => c.enabled).length} kanala aktivno
          </span>
          <div className="flex items-center gap-2">
            {activeTab === "history" && history.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="text-[10px] text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
              >
                Obriši povijest
              </button>
            )}
            <button
              onClick={onClose}
              className="text-[11px] text-text-muted hover:text-text px-3 py-1 rounded-lg hover:bg-surface-2 transition-colors"
            >
              Zatvori
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
