import { useEffect, useRef, useState } from "react";
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

function FriendRow({
  friend,
  flash,
  onView,
  onRemove,
}: {
  friend: FriendRecord;
  /** Bring the row into view and wash it in accent: it was just added or picked. */
  flash: boolean;
  onView: () => void;
  onRemove: () => void;
}) {
  const remove = useConfirmTap(onRemove);
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (!flash) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ block: "nearest", behavior: calm ? "auto" : "smooth" });
  }, [flash]);
  return (
    <li
      ref={ref}
      className={`flex items-stretch ${flash ? "motion-safe:animate-row-added" : ""}`}
      data-testid="friend-row"
      data-flash={flash || undefined}
    >
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
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The row to point at. `n` changes on every pick, so picking the same friend
  // again replays the highlight.
  const [flash, setFlash] = useState<{ id: string; n: number } | null>(null);
  const pointAt = (id: string) => setFlash((prev) => ({ id, n: (prev?.n ?? 0) + 1 }));

  const handleAdd = async (user: MpUser) => {
    setError(null);
    if (friends.some((f) => f.id === user.id)) {
      pointAt(user.id);
      return;
    }
    setAddingId(user.id);
    try {
      const friend = await addFriend(user);
      setFriends((list) => [...list.filter((f) => f.id !== friend.id), friend]);
      pointAt(friend.id);
    } catch (err) {
      setError(`Couldn't add ${user.name}. ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setAddingId(null);
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
            Keep a friend&rsquo;s Mountain Project ticks here, and tap a friend to see their
            pyramid. Their climbs stay separate from yours, and only public ticks can be loaded.
          </p>
          {!loading && friends.length > 0 && (
            <ul
              className="rounded-2xl bg-gray-800/60 divide-y divide-gray-700/60 overflow-hidden"
              data-testid="friends-list"
            >
              {friends.map((f) => (
                <FriendRow
                  key={flash?.id === f.id ? `${f.id}-${flash.n}` : f.id}
                  friend={f}
                  flash={flash?.id === f.id}
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
            disabled={addingId !== null}
            busyId={addingId}
            busyLabel="Loading their ticks…"
            placeholder="Their name on Mountain Project"
          />
          {error && (
            <p className="text-red-400 text-sm" data-testid="friends-error">{error}</p>
          )}
        </section>
      </main>
    </div>
  );
}
