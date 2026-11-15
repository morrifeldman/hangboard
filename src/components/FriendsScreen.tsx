import { useState } from "react";
import { ScreenHeader } from "./ScreenHeader";
import { MpUserSearch } from "./MpUserSearch";
import { useLoad } from "../hooks/useLoad";
import { useConfirmTap } from "../hooks/useEditor";
import { addFriend, fetchedAgo, getFriends, removeFriend } from "../lib/friends";
import type { FriendRecord } from "../lib/friends";
import type { MpUser } from "../lib/mpAccount";

type Props = {
  onBack: () => void;
  /** Open a friend's pyramid. */
  onView: (id: string) => void;
};

function FriendRow({ friend, onView, onRemove }: { friend: FriendRecord; onView: () => void; onRemove: () => void }) {
  const remove = useConfirmTap(onRemove);
  return (
    <li className="flex items-stretch" data-testid="friend-row">
      <button
        type="button"
        onClick={onView}
        className="flex-1 min-w-0 px-4 py-3 text-left active:bg-gray-700/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-400"
      >
        <span className="block truncate text-sm font-semibold text-white">{friend.name}</span>
        <span className="block truncate text-xs text-gray-500">
          {friend.fetchedAt === null
            ? "Ticks load when you open them"
            : `${friend.climbs.length} tick${friend.climbs.length === 1 ? "" : "s"} · ${fetchedAgo(friend.fetchedAt)}`}
        </span>
      </button>
      <button
        type="button"
        onClick={remove.tap}
        className={`px-4 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-400 ${
          remove.armed ? "text-red-400" : "text-gray-300 active:text-white"
        }`}
        aria-label={remove.armed ? `Confirm removing ${friend.name}` : `Remove ${friend.name}`}
      >
        {remove.armed ? "Tap to confirm" : "Remove"}
      </button>
    </li>
  );
}

export function FriendsScreen({ onBack, onView }: Props) {
  const { data: friends, setData: setFriends, loading } = useLoad(getFriends, [] as FriendRecord[]);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async (user: MpUser) => {
    if (friends.some((f) => f.id === user.id)) {
      onView(user.id);
      return;
    }
    setError(null);
    setAdding(user.name);
    try {
      const friend = await addFriend(user);
      onView(friend.id);
    } catch (err) {
      setError(`Couldn't add ${user.name}. ${err instanceof Error ? err.message : String(err)}`);
      setAdding(null);
    }
  };

  const handleRemove = async (id: string) => {
    setError(null);
    try {
      await removeFriend(id);
      setFriends((list) => list.filter((f) => f.id !== id));
    } catch {
      setError("Couldn't remove them. Try again.");
    }
  };

  return (
    <div className="h-full bg-gray-900 flex flex-col">
      <ScreenHeader title="Friends" onBack={onBack} />
      <main className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <p className="text-gray-400 text-sm leading-relaxed">
            Keep a friend&rsquo;s Mountain Project ticks here to look at their pyramid. Their climbs
            stay separate from yours, and only public ticks can be loaded.
          </p>
          {!loading && friends.length > 0 && (
            <ul
              className="rounded-2xl bg-gray-800/60 divide-y divide-gray-700/60 overflow-hidden"
              data-testid="friends-list"
            >
              {friends.map((f) => (
                <FriendRow
                  key={f.id}
                  friend={f}
                  onView={() => onView(f.id)}
                  onRemove={() => void handleRemove(f.id)}
                />
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-white font-semibold text-base">Add a friend</h2>
          <MpUserSearch
            onPick={(user) => void handleAdd(user)}
            isPicked={(user) => friends.some((f) => f.id === user.id)}
            pickedLabel="Added"
            disabled={adding !== null}
            placeholder="Their name on Mountain Project"
          />
          {adding && (
            <p className="text-gray-400 text-sm" data-testid="friends-adding">
              Loading {adding}&rsquo;s ticks…
            </p>
          )}
          {error && (
            <p className="text-red-400 text-sm" data-testid="friends-error">{error}</p>
          )}
        </section>
      </main>
    </div>
  );
}
