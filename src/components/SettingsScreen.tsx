import { useRef, useState } from "react";
import { ScreenHeader } from "./ScreenHeader";
import { BackupSection } from "./settings/BackupSection";
import { MountainProjectSection } from "./settings/MountainProjectSection";
import { ReminderSection } from "./settings/ReminderSection";

type Props = {
  onBack: () => void;
};

export function SettingsScreen({ onBack }: Props) {
  // An import in one section changes the counts another one shows.
  const [climbsVersion, setClimbsVersion] = useState(0);
  // A restore reloads the page; the Mountain Project leave guard must not ask first.
  const allowLeaveRef = useRef<() => void>(() => {});

  return (
    <div className="h-full bg-gray-900 flex flex-col">
      <ScreenHeader title="Settings" onBack={onBack} />
      <main className="flex-1 overflow-y-auto px-4 pb-8 flex flex-col divide-y divide-gray-800">
        <BackupSection
          refreshKey={climbsVersion}
          onBeforeReload={() => allowLeaveRef.current()}
        />
        <MountainProjectSection
          allowLeaveRef={allowLeaveRef}
          onClimbsChanged={() => setClimbsVersion((v) => v + 1)}
        />
        <ReminderSection />
      </main>
    </div>
  );
}
