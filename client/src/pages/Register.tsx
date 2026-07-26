import { useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth.js";
import { Link } from "react-router-dom";

export default function Register() {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Greška");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-8">Straxor</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-gray-900 border border-gray-800 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            required
          />
          <input
            type="password"
            placeholder="Lozinka (min. 6 karaktera)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            className="w-full px-4 py-3 rounded-lg bg-gray-900 border border-gray-800 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            required
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
          >
            {loading ? "Registracija..." : "Registruj se"}
          </button>
        </form>
        <p className="text-center text-gray-500 text-sm mt-6">
          Već imaš nalog?{" "}
          <Link to="/login" className="text-blue-500 hover:underline">
            Prijavi se
          </Link>
        </p>
      </div>
    </div>
  );
}
