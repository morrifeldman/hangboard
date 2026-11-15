import { UserPlus } from "lucide-react";
import { Pill, PillRow } from "../ui";
import type { FriendRecord } from "../../lib/friends";

type Props = {
  friends: FriendRecord[];
  /** The friend being viewed, or undefined for your own climbs. */
  who: string | undefined;
  onWho: (id: string | undefined) => void;
  onManageFriends: () => void;
};

/** Whose climbs a pyramid screen shows: yours, or a friend's. */
export function ClimberSwitcher({ friends, who, onWho, onManageFriends }: Props) {
  return (
    <PillRow className="px-4 pt-3">
      <Pill selected={who === undefined} onClick={() => onWho(undefined)} size="sm">
        Me
      </Pill>
      {friends.map((f) => (
        <Pill key={f.id} selected={who === f.id} onClick={() => onWho(f.id)} size="sm">
          {f.name}
        </Pill>
      ))}
      <button
        type="button"
        onClick={onManageFriends}
        className="shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap text-gray-300 ring-1 ring-inset ring-gray-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
        data-testid="pyramid-friends"
      >
        <UserPlus size={14} aria-hidden="true" />
        Friends
      </button>
    </PillRow>
  );
}
