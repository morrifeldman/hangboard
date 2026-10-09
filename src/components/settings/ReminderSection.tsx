import { useState } from "react";
import {
  getPrefs,
  periodicReminderStatus,
  permissionStatus,
  registerPeriodicReminder,
  requestPermission,
  sendTestNotification,
  setPrefs,
  unregisterPeriodicReminder,
} from "../../lib/notifications";
import type { NotificationPrefs, PeriodicReminderSupport } from "../../lib/notifications";
import { useLoad } from "../../hooks/useLoad";

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export function ReminderSection() {
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(() => getPrefs());
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(
    () => permissionStatus(),
  );
  const { data: loadedBgStatus } = useLoad<PeriodicReminderSupport>(
    () => periodicReminderStatus().catch((): PeriodicReminderSupport => "unsupported"),
    "unsupported",
  );
  const [bgOverride, setBgOverride] = useState<PeriodicReminderSupport | null>(null);
  const bgStatus = bgOverride ?? loadedBgStatus;
  const [notifTest, setNotifTest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleToggleNotif = async () => {
    setError(null);
    try {
      if (notifPrefs.enabled) {
        setNotifPrefs(setPrefs({ enabled: false }));
        await unregisterPeriodicReminder();
        return;
      }
      if (notifPermission !== "granted") {
        const result = await requestPermission();
        setNotifPermission(result);
        if (result !== "granted") return;
      }
      setNotifPrefs(setPrefs({ enabled: true }));
      await registerPeriodicReminder();
      setBgOverride(await periodicReminderStatus());
    } catch (err) {
      setError(`Couldn't update the reminder: ${message(err)}`);
    }
  };

  const handleTimeChange = (time: string) => {
    setNotifPrefs(setPrefs({ time }));
  };

  const handleTestNotif = async () => {
    setError(null);
    try {
      if (notifPermission !== "granted") {
        const result = await requestPermission();
        setNotifPermission(result);
        if (result !== "granted") return;
      }
      const ok = await sendTestNotification();
      setNotifTest(ok ? "Sent — check your notifications." : "Couldn't send a test notification.");
    } catch (err) {
      setError(`Couldn't send a test notification: ${message(err)}`);
    }
  };

  return (
    <section className="py-6 flex flex-col gap-3" data-testid="settings-notifications">
      <h2 className="text-white font-semibold text-base">Daily reminder</h2>
      <p className="text-gray-400 text-sm leading-relaxed">
        Get one notification on days with a planned workout, at or after
        the time you choose.
      </p>
      <label className="flex min-h-10 items-center justify-between gap-3">
        <span className="text-white text-sm">Enable</span>
        <input
          type="checkbox"
          role="switch"
          checked={notifPrefs.enabled}
          onChange={handleToggleNotif}
          disabled={notifPermission === "unsupported"}
          className="relative h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-gray-600 transition-colors checked:bg-accent-500 disabled:cursor-default disabled:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 before:absolute before:left-0.5 before:top-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:transition-transform before:content-[''] checked:before:translate-x-5 disabled:before:bg-gray-500 motion-reduce:before:transition-none"
          data-testid="settings-notif-toggle"
        />
      </label>
      <label className="flex min-h-10 items-center justify-between gap-3">
        <span className="text-white text-sm">Time</span>
        <input
          type="time"
          value={notifPrefs.time}
          onChange={(e) => handleTimeChange(e.target.value)}
          className="h-10 px-3 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm [color-scheme:dark] focus:outline-none focus:border-accent-500/60"
          data-testid="settings-notif-time"
        />
      </label>
      <button
        onClick={handleTestNotif}
        disabled={notifPermission === "unsupported"}
        className="self-start px-4 py-2.5 rounded-lg bg-gray-800 active:bg-gray-700 border border-gray-700 disabled:text-gray-600 disabled:border-gray-800 text-gray-200 font-semibold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
        data-testid="settings-notif-test"
      >
        Send test notification
      </button>
      {notifTest && (
        <p className="text-gray-400 text-xs" data-testid="settings-notif-test-status">
          {notifTest}
        </p>
      )}
      {error && (
        <p className="text-red-400 text-sm" data-testid="settings-notif-error">{error}</p>
      )}
      {notifPermission === "denied" && (
        <p className="text-amber-400 text-xs">
          Notifications are blocked. Allow them in your browser or phone
          settings to get reminders.
        </p>
      )}
      {notifPermission === "unsupported" && (
        <p className="text-amber-400 text-xs">
          This browser doesn&apos;t support notifications.
        </p>
      )}
      {notifPrefs.enabled && bgStatus === "granted" && (
        <p className="text-gray-500 text-xs leading-relaxed">
          Reminders also arrive when the app is closed. Android decides
          when to wake it, so one may come a while after your set time.
        </p>
      )}
      {notifPrefs.enabled && bgStatus !== "granted" && (
        <p className="text-gray-500 text-xs leading-relaxed">
          Background delivery isn&apos;t available here, so reminders fire
          on the next app open. Install Cairn to your Android home screen
          and use it a few times to enable closed-app reminders.
        </p>
      )}
    </section>
  );
}
