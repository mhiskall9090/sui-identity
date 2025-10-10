import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { motion } from 'framer-motion';
// import DashboardLayout from '../components/DashboardLayout';
// import LightRays from '../components/ui/lightRays';
import { credentialService, type CredentialData, type CredentialStats } from '../services/credentialService';
import { Shield, FileText, CheckCircle, Clock, AlertCircle, Calendar, Users } from 'lucide-react';
import { colors } from '../brand';
import DashboardHeader from '../components/ui/DashboardHeader';

const User: React.FC = () => {
    const navigate = useNavigate();
    const currentAccount = useCurrentAccount();
    // const [activeFilter, setActiveFilter] = useState('Active');
    const [activeNav, setActiveNav] = useState('verifications');
    const [searchQuery, setSearchQuery] = useState('');

    // Backend data state
    const [credentials, setCredentials] = useState<CredentialData[]>([]);
    const [stats, setStats] = useState<CredentialStats>({ total: 0, verified: 0, pending: 0 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Verification options that redirect to KYC
    const verificationOptions = [
        {
            id: 1,
            title: 'Verify Above 18',
            description: 'Verify your age using your Ghana Card or Ghana Passport. Required for DeFi protocols and Gaming protocols on SUI ecosystem.',
            icon: Calendar,
            status: 'not_verified',
            delay: 0.1
        },
        {
            id: 2,
            title: 'Citizenship Verification',
            description: 'Verify your citizenship status. Required for DeFi protocols and Gaming protocols on SUI ecosystem.',
            icon: Users,
            status: 'not_verified',
            delay: 0.2
        },
    ];

    const handleVerificationClick = (verificationType: string, verificationDescription: string) => {
        // Redirect to KYC page for verification with type and description
        navigate('/kyc', {
            state: {
                verificationType,
                verificationDescription
            }
        });
    };

    // Fetch credentials from backend
    useEffect(() => {
        const fetchCredentials = async () => {
            if (!currentAccount?.address) return;

            setLoading(true);
            setError(null);

            try {
                const { credentials: fetchedCredentials, stats: fetchedStats } = await credentialService.getUserCredentials(currentAccount.address);
                setCredentials(fetchedCredentials);
                setStats(fetchedStats);
            } catch (error) {
                console.error('Failed to fetch credentials:', error);
                setError('Failed to load credentials');
            } finally {
                setLoading(false);
            }
        };

        fetchCredentials();
    }, [currentAccount?.address]);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'verified':
                return <CheckCircle className="w-5 h-5" style={{ color: colors.primary }} />;
            case 'pending':
                return <Clock className="w-5 h-5" style={{ color: colors.lightBlue }} />;
            case 'expired':
                return <AlertCircle className="w-5 h-5 text-red-500" />;
            default:
                return <Clock className="w-5 h-5 text-gray-500" />;
        }
    };

    return (
        <div className="w-full" style={{ backgroundColor: colors.darkerNavy, position: 'relative', minHeight: '100vh' }}>
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

            {/* Hero Section */}
            <div className="relative h-screen flex flex-col pt-[10rem]">
                <div className="absolute top-4 w-full z-50">
                    <DashboardHeader />
                </div>

                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center max-w-4xl mx-auto px-6">
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8 }}
                        >
                            <motion.h1
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.8, delay: 0.2 }}
                                className="text-4xl md:text-6xl font-bold mb-4"
                            >
                                <motion.span style={{ color: colors.primary }}>Identity</motion.span>
                                <motion.span style={{ color: colors.white }}> Dashboard</motion.span>
                            </motion.h1>

                            <motion.p
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.8, delay: 0.4 }}
                                className="text-xl"
                                style={{ color: colors.lightBlue }}
                            >
                                View and manage identities stored in your wallet
                            </motion.p>
                        </motion.div>
                    </div>
                </div>
                {/* Main Content Section */}
                <div className="relative z-10" style={{ backgroundColor: colors.darkerNavy, minHeight: '100vh' }}>
                    <div className="max-w-5xl mx-auto px-6 pb-20">
                        {/* Stats Cards */}
                        <motion.div
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.6 }}
                            className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-12 pt-4"
                        >
                            <motion.div
                                whileHover={{ y: -5, scale: 1.02 }}
                                className="relative p-6 rounded-3xl transition-all duration-300 overflow-hidden"
                                style={{ backgroundColor: colors.darkNavy }}
                            >
                                <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(circle at center, ${colors.primary} 0%, transparent 70%)` }}></div>
                                <div className="relative z-10 flex items-center">
                                    <div className="p-3 rounded-2xl" style={{ backgroundColor: `${colors.primary}20` }}>
                                        <CheckCircle className="w-6 h-6" style={{ color: colors.primary }} />
                                    </div>
                                    <div className="ml-4">
                                        <p className="text-sm font-medium" style={{ color: colors.lightBlue }}>Total Credentials</p>
                                        <p className="text-2xl font-bold" style={{ color: colors.white }}>{loading ? '...' : stats.total}</p>
                                    </div>
                                </div>
                            </motion.div>

                            <motion.div
                                whileHover={{ y: -5, scale: 1.02 }}
                                className="relative p-6 rounded-3xl transition-all duration-300 overflow-hidden"
                                style={{ backgroundColor: colors.darkNavy }}
                            >
                                <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(circle at center, ${colors.primary} 0%, transparent 70%)` }}></div>
                                <div className="relative z-10 flex items-center">
                                    <div className="p-3 rounded-2xl" style={{ backgroundColor: `${colors.primary}20` }}>
                                        <Shield className="w-6 h-6" style={{ color: colors.primary }} />
                                    </div>
                                    <div className="ml-4">
                                        <p className="text-sm font-medium" style={{ color: colors.lightBlue }}>Verified Credentials</p>
                                        <p className="text-2xl font-bold" style={{ color: colors.white }}>{loading ? '...' : stats.verified}</p>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>

                        {/* Navigation Tabs */}
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                            className="bg-white/10 backdrop-blur-sm rounded-2xl p-2 mb-8 border"
                            style={{ borderColor: `${colors.primary}30` }}
                        >
                            <nav className="flex space-x-2">
                                {['verifications', 'credentials'].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveNav(tab)}
                                        className={`flex-1 py-3 px-6 rounded-xl font-medium text-sm capitalize transition-all duration-300 ${activeNav === tab
                                            ? 'text-white shadow-lg'
                                            : 'text-gray-400 hover:text-white'
                                            }`}
                                        style={{
                                            backgroundColor: activeNav === tab ? colors.primary : 'transparent'
                                        }}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </nav>
                        </motion.div>

                        {/* Verifications Section */}
                        {activeNav === 'verifications' && (
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6 }}
                            >
                                <div className="mb-8">
                                    <h2 className="text-2xl font-bold mb-2" style={{ color: colors.white }}>Identity Verifications</h2>
                                    <p className="text-sm" style={{ color: colors.lightBlue }}>Complete these verifications to unlock full platform access</p>
                                </div>

                                {/* Verification Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {verificationOptions.map((verification) => {
                                        const IconComponent = verification.icon;
                                        return (
                                            <motion.div
                                                key={verification.id}
                                                initial={{ opacity: 0, y: 50, rotateX: -15 }}
                                                whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                                                transition={{ duration: 0.8, delay: verification.delay, type: "spring", stiffness: 100 }}
                                                whileHover={{
                                                    y: -12,
                                                    rotateX: 5,
                                                    transition: { duration: 0.3 }
                                                }}
                                                onClick={() => handleVerificationClick(verification.title, verification.description)}
                                                className="group relative overflow-hidden rounded-3xl p-8 transition-all duration-500 transform-gpu cursor-pointer"
                                                style={{
                                                    background: `linear-gradient(135deg, ${colors.darkNavy} 0%, ${colors.darkerNavy} 100%)`,
                                                    border: `1px solid ${colors.primary}40`
                                                }}
                                            >
                                                {/* Animated Background Gradient */}
                                                <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500"
                                                    style={{
                                                        background: `radial-gradient(circle at 50% 50%, ${colors.primary}60 0%, transparent 70%)`
                                                    }}></div>

                                                {/* Floating Particles Effect */}
                                                <div className="absolute inset-0 overflow-hidden">
                                                    {[...Array(4)].map((_, i) => (
                                                        <motion.div
                                                            key={i}
                                                            className="absolute w-1 h-1 rounded-full opacity-30"
                                                            style={{
                                                                backgroundColor: colors.primary, left: `${20 + i * 20}%`,
                                                                top: `${30 + i * 10}%`
                                                            }}
                                                            animate={{
                                                                x: [0, 100, 0],
                                                                y: [0, -50, 0],
                                                                opacity: [0.3, 0.8, 0.3],
                                                                scale: [0.5, 1.2, 0.5]
                                                            }}
                                                            transition={{
                                                                duration: 4 + i * 0.5,
                                                                repeat: Infinity,
                                                                delay: i * 0.3,
                                                                ease: "easeInOut"
                                                            }}
                                                        />
                                                    ))}
                                                </div>

                                                <div className="relative z-10">
                                                    {/* Icon with Glow Effect */}
                                                    <motion.div
                                                        initial={{ scale: 0, rotate: -180 }}
                                                        whileInView={{ scale: 1, rotate: 0 }}
                                                        transition={{ duration: 0.8, delay: verification.delay + 0.2, type: "spring", stiffness: 150 }}
                                                        className="relative mb-6"
                                                    >
                                                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto relative overflow-hidden"
                                                            style={{
                                                                background: `linear-gradient(135deg, ${colors.primary}20, ${colors.primary}40)`,
                                                                boxShadow: `0 0 30px ${colors.primary}40`
                                                            }}>
                                                            <motion.div
                                                                className="absolute inset-0 rounded-2xl"
                                                                style={{ background: `linear-gradient(135deg, ${colors.primary}60, transparent)` }}
                                                                animate={{
                                                                    opacity: [0.3, 0.8, 0.3],
                                                                    scale: [1, 1.1, 1]
                                                                }}
                                                                transition={{
                                                                    duration: 2,
                                                                    repeat: Infinity,
                                                                    ease: "easeInOut"
                                                                }}
                                                            />
                                                            <div className="relative z-10" style={{ color: colors.primary }}>
                                                                <IconComponent className="w-8 h-8" />
                                                            </div>
                                                        </div>
                                                    </motion.div>

                                                    {/* Content */}
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 20 }}
                                                        whileInView={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: verification.delay + 0.4, duration: 0.6 }}
                                                    >
                                                        <h3 className="text-xl font-bold mb-3 text-center bg-gradient-to-r bg-clip-text text-transparent"
                                                            style={{
                                                                backgroundImage: `linear-gradient(135deg, ${colors.white}, ${colors.lightBlue})`
                                                            }}>
                                                            {verification.title}
                                                        </h3>
                                                        <p className="text-sm leading-relaxed text-center opacity-80 mb-4" style={{ color: colors.lightBlue }}>
                                                            {verification.description}
                                                        </p>

                                                        <motion.button
                                                            whileHover={{ scale: 1.05 }}
                                                            whileTap={{ scale: 0.95 }}
                                                            className="w-full py-3 px-6 rounded-xl font-medium transition-all duration-300"
                                                            style={{
                                                                background: colors.gradients.primary,
                                                                color: colors.white
                                                            }}
                                                        >
                                                            Start Verification
                                                        </motion.button>
                                                        <p className="text-xs text-center mt-3" style={{ color: colors.lightBlue, fontWeight: '500' }}>
                                                            Accepted by <span style={{ color: colors.primary }}>Alphafi</span> and <span style={{ color: colors.primary }}>Suilend</span>
                                                        </p>
                                                    </motion.div>
                                                </div>

                                                <div className="absolute top-4 left-4 w-8 h-8 opacity-20 group-hover:opacity-40 transition-opacity duration-300">
                                                    <div className="w-full h-full border-2 border-r-0 border-b-0 rounded-tl-lg" style={{ borderColor: colors.primary }}></div>
                                                </div>
                                                <div className="absolute top-4 right-4 w-8 h-8 opacity-20 group-hover:opacity-40 transition-opacity duration-300">
                                                    <div className="w-full h-full border-2 border-l-0 border-b-0 rounded-tr-lg" style={{ borderColor: colors.primary }}></div>
                                                </div>
                                                <div className="absolute bottom-4 left-4 w-8 h-8 opacity-20 group-hover:opacity-40 transition-opacity duration-300">
                                                    <div className="w-full h-full border-2 border-r-0 border-t-0 rounded-bl-lg" style={{ borderColor: colors.primary }}></div>
                                                </div>
                                                <div className="absolute bottom-4 right-4 w-8 h-8 opacity-20 group-hover:opacity-40 transition-opacity duration-300">
                                                    <div className="w-full h-full border-2 border-l-0 border-t-0 rounded-br-lg" style={{ borderColor: colors.primary }}></div>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}

                        {/* Credentials Section */}
                        {activeNav === 'credentials' && (
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6 }}
                            >
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <h2 className="text-2xl font-bold mb-2" style={{ color: colors.white }}>Credentials</h2>
                                        <p className="text-sm" style={{ color: colors.lightBlue }}>View and manage credentials stored in your identity wallet</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="text"
                                            placeholder="Search credentials..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="px-4 py-2 bg-white/10 border rounded-lg focus:ring-2 focus:ring-opacity-50 text-white placeholder-gray-400 text-sm backdrop-blur-sm"
                                            style={{
                                                borderColor: `${colors.primary}40`
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Error Display */}
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6 backdrop-blur-sm"
                                    >
                                        <div className="flex items-center gap-3">
                                            <AlertCircle className="w-5 h-5 text-red-400" />
                                            <p className="text-red-200 font-medium">{error}</p>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Loading State */}
                                {loading && (
                                    <div className="text-center py-12">
                                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: colors.primary }}></div>
                                        <p style={{ color: colors.lightBlue }}>Loading credentials...</p>
                                    </div>
                                )}

                                {/* Empty State */}
                                {!loading && !error && credentials.length === 0 && (
                                    <div className="text-center py-12">
                                        <FileText className="w-16 h-16 mx-auto mb-4" style={{ color: colors.lightBlue }} />
                                        <p className="text-lg mb-2" style={{ color: colors.white }}>No credentials found</p>
                                        <p className="text-sm" style={{ color: colors.lightBlue }}>Complete identity verifications to see your credentials here</p>
                                    </div>
                                )}

                                {/* Credentials Grid */}
                                {!loading && !error && credentials.length > 0 && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {credentials.map((credential, index) => (
                                            <motion.div
                                                key={credential.id}
                                                initial={{ opacity: 0, y: 30 }}
                                                whileInView={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.6, delay: index * 0.1 }}
                                                whileHover={{ y: -8, scale: 1.02 }}
                                                className="group relative overflow-hidden rounded-3xl p-6 transition-all duration-300"
                                                style={{
                                                    backgroundColor: colors.darkNavy,
                                                    border: `1px solid ${colors.primary}30`
                                                }}
                                            >
                                                {/* Subtle Background Pattern */}
                                                <div className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity duration-300"
                                                    style={{ background: `radial-gradient(circle at center, ${colors.primary} 0%, transparent 70%)` }}></div>

                                                <div className="relative z-10">
                                                    <div className="flex items-start justify-between mb-4">
                                                        <div>
                                                            <h3 className="font-bold text-lg mb-1" style={{ color: colors.white }}>{credential.title}</h3>
                                                            <p className="text-sm" style={{ color: colors.lightBlue }}>{credential.description}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {getStatusIcon(credential.status)}
                                                        </div>
                                                    </div>

                                                    <div className="mb-4">
                                                        <p className="text-xs" style={{ color: colors.lightBlue }}>Exp: {credential.expiryDate}</p>
                                                    </div>

                                                    <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: `${colors.primary}20` }}>
                                                        <div className="flex items-center gap-4">
                                                            <div className="text-center">
                                                                <div className="text-2xl font-bold" style={{ color: colors.primary }}>{index + 1}</div>
                                                            </div>
                                                            <div className="text-xs" style={{ color: colors.lightBlue }}>
                                                                Issued on: {credential.issuedDate}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {credential.type === 'nft' && (
                                                                <span className="px-2 py-1 text-xs font-medium rounded"
                                                                    style={{ backgroundColor: `${colors.primary}20`, color: colors.primary }}>NFT</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>


        </div>
    );
};

export default User;
