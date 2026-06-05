import { useAuth } from '../context/AuthContext';

export default function TopBar() {
  const { logout } = useAuth();

  return (
    <header className="flex items-center justify-between p-4 shadow-sm bg-white border-b" role="banner">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-yellow-400 flex items-center justify-center font-bold">G</div>
          <h1 className="text-lg font-medium">Keep Clone</h1>
        </div>

        <div className="ml-4 hidden sm:block">
          <input
            placeholder="Search"
            className="px-3 py-2 rounded border bg-gray-50 border-keep-border focus:outline-none"
          />
        </div>
      </div>

      <div>
        <button
          onClick={logout}
          className="text-sm px-3 py-1 rounded hover:bg-gray-100"
        >
          Logout
        </button>
      </div>
    </header>
  );
}