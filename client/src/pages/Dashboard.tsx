import { useAuth } from "../lib/auth.js";

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Straxor</h1>
        <p className="text-gray-400 mb-6">
          Prijavljen kao <span className="text-gray-200">{user?.email}</span>
        </p>
        <button
          onClick={logout}
          className="px-6 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
        >
          Odjavi se
        </button>
      </div>
    </div>
  );
}
