import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (isRegistering) {
        // Hit the POST /auth/register endpoint
        await api.post('/auth/register', { 
          user_mail: email, 
          password: password 
        });
        // Switch to login view after successful registration
        setIsRegistering(false);
        setError('Registration successful! Please log in.');
      } else {
        // Hit the POST /auth/login endpoint
        await login(email, password);
        navigate('/'); // Redirect to dashboard
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'An error occurred');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-keep-bg">
      <div className="bg-[#2d2e30] p-8 rounded-lg shadow-md w-full max-w-md border border-keep-border">
        <h2 className="text-2xl font-bold mb-6 text-center text-white">
          {isRegistering ? 'Create an Account' : 'Sign in to Keep'}
        </h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-500 text-red-200 rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="email"
              placeholder="Email"
              className="w-full p-3 bg-transparent border border-keep-border rounded focus:outline-none focus:border-blue-400 text-white"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Password"
              className="w-full p-3 bg-transparent border border-keep-border rounded focus:outline-none focus:border-blue-400 text-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded transition-colors"
          >
            {isRegistering ? 'Register' : 'Login'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-sm text-blue-400 hover:underline"
          >
            {isRegistering 
              ? 'Already have an account? Sign in' 
              : "Don't have an account? Register"}
          </button>
        </div>
      </div>
    </div>
  );
}