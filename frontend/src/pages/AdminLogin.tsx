import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { colors } from '../brand';
import { Eye, EyeOff, Shield, AlertCircle } from 'lucide-react';

const AdminLogin: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // Get admin credentials from environment variables
    const ADMIN_USERNAME = import.meta.env.VITE_ADMIN_USERNAME;
    const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_KEY;

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 1000));

            if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
                // Store authentication in localStorage
                localStorage.setItem('adminAuthenticated', 'true');
                localStorage.setItem('adminUsername', username);

                // Navigate to admin dashboard
                navigate('/admin');
            } else {
                setError('Invalid username or password');
            }
        } catch (error) {
            setError(`${error},Login failed. Please try again.`);
        } finally {
            setLoading(false);
        }
    };

    // Check if already authenticated
    useEffect(() => {
        const isAuthenticated = localStorage.getItem('adminAuthenticated');
        if (isAuthenticated === 'true') {
            navigate('/admin');
        }
    }, [navigate]);

    return (
        <div className="w-full min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.darkerNavy }}>
            {/* Grid Pattern Background */}
            <div
                className="fixed inset-0 z-0"
                style={{
                    backgroundImage: `
            linear-gradient(to right, ${colors.primary}20 1px, transparent 1px),
            linear-gradient(to bottom, ${colors.primary}20 1px, transparent 1px)
          `,
                    backgroundSize: "20px 30px",
                    WebkitMaskImage:
                        "radial-gradient(ellipse 70% 60% at 50% 0%, #000 60%, transparent 100%)",
                    maskImage:
                        "radial-gradient(ellipse 70% 60% at 50% 0%, #000 60%, transparent 100%)",
                }}
            />

            {/* Login Form */}
            <div className="relative z-10 w-full max-w-md mx-auto px-6">
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="bg-white/10 backdrop-blur-sm rounded-3xl border p-8"
                    style={{ borderColor: `${colors.primary}30` }}
                >
                    {/* Header */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="text-center mb-8"
                    >
                        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${colors.primary}20` }}>
                            <Shield className="w-8 h-8" style={{ color: colors.primary }} />
                        </div>
                        <h1 className="text-2xl font-bold mb-2" style={{ color: colors.white }}>Admin Login</h1>
                        <p className="text-sm" style={{ color: colors.lightBlue }}>Access government document decryption portal</p>
                    </motion.div>

                    {/* Login Form */}
                    <form onSubmit={handleLogin} className="space-y-6">
                        {/* Username Field */}
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6, delay: 0.4 }}
                        >
                            <label htmlFor="username" className="block text-sm font-medium mb-2" style={{ color: colors.lightBlue }}>
                                Username
                            </label>
                            <input
                                type="text"
                                id="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter username"
                                className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-opacity-50 transition-all"
                                style={{
                                    backgroundColor: `${colors.primary}10`,
                                    border: `1px solid ${colors.primary}40`
                                }}
                                required
                            />
                        </motion.div>

                        {/* Password Field */}
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6, delay: 0.5 }}
                        >
                            <label htmlFor="password" className="block text-sm font-medium mb-2" style={{ color: colors.lightBlue }}>
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter password"
                                    className="w-full px-4 py-3 pr-12 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-opacity-50 transition-all"
                                    style={{
                                        backgroundColor: `${colors.primary}10`,
                                        border: `1px solid ${colors.primary}40`
                                    }}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </motion.div>

                        {/* Error Display */}
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-3 p-3 rounded-xl"
                                style={{ backgroundColor: `${colors.primary}10`, border: `1px solid #ef4444` }}
                            >
                                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                                <p className="text-sm text-red-200">{error}</p>
                            </motion.div>
                        )}

                        {/* Login Button */}
                        <motion.button
                            type="submit"
                            disabled={loading || !username || !password}
                            className={`w-full py-3 px-6 rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2 ${loading || !username || !password
                                    ? 'text-gray-200 cursor-not-allowed'
                                    : 'text-white'
                                }`}
                            style={{
                                background: loading || !username || !password
                                    ? '#9ca3af'
                                    : colors.gradients.primary
                            }}
                            whileHover={!loading && username && password ? { scale: 1.02 } : {}}
                            whileTap={!loading && username && password ? { scale: 0.98 } : {}}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.6 }}
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Authenticating...
                                </>
                            ) : (
                                <>
                                    <Shield className="w-5 h-5" />
                                    Login to Admin Portal
                                </>
                            )}
                        </motion.button>
                    </form>

                    {/* Footer */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.8, delay: 0.8 }}
                        className="mt-6 text-center"
                    >
                        <p className="text-xs" style={{ color: colors.lightBlue }}>
                            Authorized government personnel only
                        </p>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
};

export default AdminLogin;
