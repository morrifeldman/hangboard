type Props = { showSendsOnly: boolean };

export function Legend({ showSendsOnly }: Props) {
  return (
    <div className="flex justify-center space-x-6 p-4 text-sm border-t border-gray-700 text-gray-400">
      <div className="flex items-center space-x-2">
        <div className="w-4 h-4 bg-green-500 rounded" />
        <span>Onsight</span>
      </div>
      <div className="flex items-center space-x-2">
        <div className="w-4 h-4 bg-yellow-500 rounded" />
        <span>Flash</span>
      </div>
      <div className="flex items-center space-x-2">
        <div className="w-4 h-4 bg-red-500 rounded" />
        <span>Redpoint</span>
      </div>
      {!showSendsOnly && (
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-gray-400 rounded" />
          <span>Attempt</span>
        </div>
      )}
    </div>
  );
}
