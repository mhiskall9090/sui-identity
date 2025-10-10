import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import LightRays from '../components/ui/lightRays';
import LandingHeader from '../components/ui/landingHeader';
import { colors } from '../../src/brand';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const handleLaunchApp = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.darkerNavy }}>

      {/* Hero Section with Light Rays */}
      <div className="w-full h-screen relative" style={{ background: colors.gradients.hero }}>
        <div className=" absolute top-5 w-full z-20">
          <LandingHeader />
        </div>

        <LightRays
          raysOrigin="top-center"
          raysColor={colors.primary}
          raysSpeed={1.2}
          lightSpread={1.0}
          rayLength={1.4}
          followMouse={true}
          mouseInfluence={0.12}
          noiseAmount={0.08}
          distortion={0.03}
          className="custom-rays"
        />

        {/* Hero Content Overlay */}
        <div className="absolute inset-0 flex flex-col justify-center items-center px-6">
          <div className="text-center text-white z-10 max-w-6xl mx-auto">
            {/* Main Title */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mb-2"
            >
              <motion.h1
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="text-3xl md:text-5xl lg:text-6xl font-bold leading-tight"
              >
                <motion.span
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                  className="drop-shadow-2xl"
                  style={{ color: colors.primary }}
                >
                  Sui
                </motion.span>
                <motion.span
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.8 }}
                  className="drop-shadow-2xl"
                  style={{ color: colors.white }}
                >
                  Verify
                </motion.span>
              </motion.h1>
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, delay: 1.0 }}
                className="w-32 h-1 mx-auto rounded-full origin-center"
                style={{ background: colors.gradients.primary }}
              />
            </motion.div>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.2 }}
              className="text-2xl md:text-3xl lg:text-4xl font-semibold mb-2 drop-shadow-lg"
              style={{ color: colors.lightBlue }}
            >
              Digital Identity Infrastructure
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.4 }}
              className="text-lg md:text-xl lg:text-2xl mb-3 max-w-4xl mx-auto leading-relaxed"
              style={{ color: colors.lightBlue }}
            >
              Secure, Private, and Verifiable Identity Infrastructure on Sui Ecosystem
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.6 }}
              className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16"
            >
              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleLaunchApp}
                className="font-bold px-12 py-3 cursor-pointer rounded-xl transition-all duration-300"
                style={{
                  background: colors.primary,
                  color: colors.white,
                  border: `2px solid ${colors.primary}`
                }}
              >
                Get Started
              </motion.button>
              <motion.a
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                href="https://suiverify.gitbook.io/suiverify/" target="_blank" rel="noopener noreferrer"
                className="font-bold px-12 py-3 cursor-pointer rounded-xl transition-all duration-300"
                style={{
                  border: `2px solid ${colors.lightBlue}`,
                  color: colors.lightBlue,
                  backgroundColor: 'transparent'
                }}
              >
                Learn More
              </motion.a>
            </motion.div>

            {/* Feature Highlights */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.8 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto"
            >
              {[
                {
                  title: "Verifiable computation",
                  description: "Identity verification using Nautilus",
                  icon: (
                    <svg className="w-8 h-8" style={{ color: colors.primary }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ),
                  delay: 0.1
                },
                {
                  title: "Soulbound NFT",
                  description: "Receive your verified identity as a DID NFT",
                  icon: (
                    <svg className="w-8 h-8" style={{ color: colors.primary }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                  ),
                  delay: 0.2
                },
                {
                  title: "Privacy First",
                  description: "Your data is encrypted using Seal and stored securely in Walrus",
                  icon: (
                    <svg className="w-8 h-8" style={{ color: colors.primary }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ),
                  delay: 0.3
                }
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 50, rotateX: -15 }}
                  animate={{ opacity: 1, y: 0, rotateX: 0 }}
                  transition={{ duration: 0.8, delay: 1.8 + feature.delay, type: "spring", stiffness: 100 }}
                  whileHover={{
                    y: -12,
                    rotateX: 5,
                    transition: { duration: 0.3 }
                  }}
                  className="group perspective-1000"
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  <div className="relative overflow-hidden rounded-3xl p-8 transition-all duration-500 transform-gpu"
                    style={{
                      background: `linear-gradient(135deg, ${colors.darkNavy} 0%, ${colors.darkerNavy} 100%)`,
                      border: `1px solid ${colors.primary}40`
                    }}>

                    {/* Animated Background Gradient */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500"
                      style={{
                        background: `radial-gradient(circle at 50% 50%, ${colors.primary}60 0%, transparent 70%)`
                      }}></div>

                    {/* Floating Particles Effect */}
                    <div className="absolute inset-0 overflow-hidden">
                      {[...Array(6)].map((_, i) => (
                        <motion.div
                          key={i}
                          className="absolute w-1 h-1 rounded-full opacity-30"
                          style={{
                            backgroundColor: colors.primary, left: `${20 + i * 15}%`,
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
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ duration: 0.8, delay: 2.0 + feature.delay, type: "spring", stiffness: 150 }}
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
                            {feature.icon}
                          </div>
                        </div>
                      </motion.div>

                      {/* Content */}
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 2.2 + feature.delay, duration: 0.6 }}
                      >
                        <h3 className="text-xl font-bold mb-3 text-center bg-gradient-to-r bg-clip-text text-transparent"
                          style={{
                            backgroundImage: `linear-gradient(135deg, ${colors.white}, ${colors.lightBlue})`
                          }}>
                          {feature.title}
                        </h3>
                        <p className="text-sm leading-relaxed text-center opacity-80" style={{ color: colors.lightBlue }}>
                          {feature.description}
                        </p>
                      </motion.div>
                    </div>

                    {/* Corner Accent */}
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
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Scroll Indicator */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 2.5 }}
              className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
            >
              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="w-6 h-10 border-2 rounded-full flex justify-center"
                style={{ borderColor: colors.lightBlue }}
              >
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  className="w-1 h-3 rounded-full mt-2"
                  style={{ backgroundColor: colors.lightBlue }}
                />
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Enhanced Interactive Cards Hero Section */}
      <section id='howitworks' className="py-20 px-6" style={{ backgroundColor: colors.darkNavy }}>
        <div className="max-w-6xl mx-auto text-center">
          <div className="mb-16">
            <h2 className="text-4xl font-bold mb-4">
              <span style={{ color: colors.primary }}>How It Works</span>
            </h2>
            <p className="text-xl" style={{ color: colors.lightBlue }}>Simple steps to get your verified digital identity</p>
          </div>

          {/* Modern Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto px-4 mb-12">
            {[
              {
                title: "Upload Document",
                description: "Upload your Ghana Card or Ghana Passport for secure verification",
                icon: (
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ),
                delay: 0.1
              },
              {
                title: "Identity Verification",
                description: "Complete identity recognition to match your identity with the document",
                icon: (
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
                  </svg>
                ),
                delay: 0.2
              },
              // {
              //   title: "OTP Verification",
              //   description: "Verify your mobile number with OTP for secure access",
              //   icon: (
              //     <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
              //       <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              //     </svg>
              //   ),
              //   delay: 0.3
              // },
              {
                title: "Receive DID NFT",
                description: "Get your verified digital identity as a DID NFT on SUI blockchain",
                icon: (
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                ),
                delay: 0.4
              }
            ].map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.6,
                  delay: step.delay,
                  type: "spring",
                  stiffness: 100
                }}
                whileHover={{
                  y: -8,
                  transition: { duration: 0.2 }
                }}
                viewport={{ once: true, margin: "-100px" }}
                className="group"
              >
                <div className="relative p-8 rounded-3xl transition-all duration-300 overflow-hidden" style={{ backgroundColor: colors.darkNavy }}>
                  {/* Subtle Background Pattern */}
                  <div className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity duration-300" style={{ background: `radial-gradient(circle at center, ${colors.primary} 0%, transparent 70%)` }}></div>

                  {/* Icon */}
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    whileInView={{ scale: 1, rotate: 0 }}
                    transition={{ delay: step.delay + 0.2, type: "spring", stiffness: 150 }}
                    className="w-16 h-16 rounded-2xl flex items-center mx-auto justify-center mb-6 shadow-lg group-hover:shadow-xl transition-all duration-300"
                    style={{ background: colors.gradients.primary }}
                  >
                    <div className="text-white">
                      {step.icon}
                    </div>
                  </motion.div>

                  {/* Content */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ delay: step.delay + 0.4 }}
                  >
                    <h3 className="text-xl font-bold mb-4" style={{ color: colors.white }}>
                      {step.title}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: colors.lightBlue }}>
                      {step.description}
                    </p>
                  </motion.div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id='features' className="py-20 px-6" style={{ backgroundColor: colors.darkerNavy }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4" style={{ color: colors.white }}>SuiVerify Makes Identity Verification Seamless</h2>
            <p className="text-xl" style={{ color: colors.lightBlue }}>Secure, Private, and Blockchain-Powered</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 justify-center items-center">
            {/* Left Content */}
            <div className="space-y-6">
              {/* Feature 1 */}
              <div className="group relative backdrop-blur-sm rounded-3xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-300 overflow-hidden" style={{ backgroundColor: `${colors.darkNavy}E6` }}>
                <div className="absolute inset-0 rounded-3xl opacity-10 group-hover:opacity-20 transition-opacity duration-300" style={{ background: colors.gradients.primary }}></div>
                <div className="relative z-10">
                  <div className="flex items-center space-x-4 mb-6">
                    <div className="w-16 h-16 rounded-3xl flex items-center justify-center shadow-xl" style={{ background: colors.gradients.primary }}>
                      <img src="/nautilus.png" alt="Nautilus" className="w-12 h-8 object-contain" />
                    </div>
                    <h3 className="text-2xl font-bold" style={{ color: colors.white }}>Nautilus</h3>
                  </div>
                  <p className="text-lg leading-relaxed" style={{ color: colors.lightBlue }}>
                    Nautilus for offchain computation and verifiability onchain - enabling secure identity verification processing
                  </p>
                </div>
                <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-30 transition-opacity duration-300 pointer-events-none" style={{ background: `radial-gradient(circle at center, ${colors.primary}20 0%, transparent 70%)` }}></div>
              </div>

              {/* Feature 2 */}
              <div className="group relative backdrop-blur-sm rounded-3xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-300 overflow-hidden" style={{ backgroundColor: `${colors.darkNavy}E6` }}>
                <div className="absolute inset-0 rounded-3xl opacity-10 group-hover:opacity-20 transition-opacity duration-300" style={{ background: colors.gradients.primary }}></div>
                <div className="relative z-10">
                  <div className="flex items-center space-x-4 mb-6">
                    <div className="w-16 h-16 rounded-3xl flex items-center justify-center shadow-xl" style={{ backgroundColor: colors.lightBlue }}>
                      <img src="/Seal_logo.png" alt="Nautilus" className="w-12 rounded-full h-8 object-contain" />

                    </div>
                    <h3 className="text-2xl font-bold" style={{ color: colors.white }}>Seal</h3>
                  </div>
                  <p className="text-lg leading-relaxed" style={{ color: colors.lightBlue }}>
                    Seal for encrypting user KYC documents and can be then decrypted only by Government addresses using SEAL protocol
                  </p>
                </div>
                <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-30 transition-opacity duration-300 pointer-events-none" style={{ background: `radial-gradient(circle at center, ${colors.primary}20 0%, transparent 70%)` }}></div>
              </div>

              {/* Feature 3 */}
              <div className="group relative backdrop-blur-sm rounded-3xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-300 overflow-hidden" style={{ backgroundColor: `${colors.darkNavy}E6` }}>
                <div className="absolute inset-0 rounded-3xl opacity-10 group-hover:opacity-20 transition-opacity duration-300" style={{ background: colors.gradients.primary }}></div>
                <div className="relative z-10">
                  <div className="flex items-center space-x-4 mb-6">
                    <div className="w-16 h-16 rounded-3xl flex items-center justify-center shadow-xl" style={{ background: colors.gradients.primary }}>
                      <img src="/walrus.svg" alt="Nautilus" className="w-12 h-8 object-contain" />
                    </div>
                    <h3 className="text-2xl font-bold" style={{ color: colors.white }}>Walrus</h3>
                  </div>
                  <p className="text-lg leading-relaxed" style={{ color: colors.lightBlue }}>
                    Walrus for storage of the documents to have our programmability of the data intact with decentralized storage
                  </p>
                </div>
                <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-30 transition-opacity duration-300 pointer-events-none" style={{ background: `radial-gradient(circle at center, ${colors.primary}20 0%, transparent 70%)` }}></div>
              </div>
            </div>

            {/* Right Content - SuiVerify Ecosystem Architecture */}
            <div className="flex justify-center relative">
              <div className="w-[500px] h-[500px] relative">
                {/* SUI Logo in Center */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center z-10">
                  <motion.div
                    className="w-24 h-24 rounded-full flex items-center justify-center shadow-xl border-2 cursor-pointer"
                    style={{ background: colors.gradients.primary, borderColor: colors.white }}
                    whileHover={{
                      scale: 1.2,
                      rotate: 360,
                      boxShadow: `0 0 50px ${colors.primary}80`
                    }}
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                    <motion.img
                      src="/suilogo.svg"
                      alt="SUI"
                      className="w-12 h-12 filter brightness-0 invert"
                      whileHover={{
                        scale: 1.1,
                        rotate: -360
                      }}
                      transition={{ duration: 0.8 }}
                    />
                  </motion.div>
                  <motion.p
                    className="text-sm font-semibold mt-2"
                    style={{ color: colors.white }}
                    whileHover={{ scale: 1.05 }}
                  >
                    SUI Blockchain
                  </motion.p>
                </div>

                {/* Connection Lines */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {/* Line to Walrus */}
                  <motion.line
                    x1="250" y1="250"
                    x2="150" y2="350"
                    stroke={colors.primary}
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    opacity="0.6"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2, delay: 0.5 }}
                  />
                  {/* Line to Seal */}
                  <motion.line
                    x1="250" y1="250"
                    x2="350" y2="350"
                    stroke={colors.primary}
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    opacity="0.6"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2, delay: 0.7 }}
                  />
                  {/* Line to Nautilus */}
                  <motion.line
                    x1="250" y1="250"
                    x2="250" y2="120"
                    stroke={colors.primary}
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    opacity="0.6"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2, delay: 0.9 }}
                  />
                </svg>

                {/* Walrus - Storage Layer */}
                <div className="absolute bottom-8 left-8">
                  <motion.div
                    className="backdrop-blur-sm rounded-2xl p-4 border shadow-lg max-w-[140px] cursor-pointer group"
                    style={{ backgroundColor: colors.darkNavy, borderColor: colors.primary }}
                    whileHover={{
                      scale: 1.1,
                      rotate: 5,
                      boxShadow: `0 20px 40px ${colors.primary}40`
                    }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <div className="flex flex-col items-center text-center">
                      <motion.div
                        className="w-12 h-12 rounded-full flex items-center justify-center mb-2"
                        style={{ backgroundColor: colors.primary }}
                        whileHover={{
                          rotate: 360,
                          scale: 1.2
                        }}
                        transition={{ duration: 0.6 }}
                      >
                        <img src="/walrus.svg" alt="Walrus" className="w-8 h-8" />
                      </motion.div>
                      <h4 className="font-bold text-sm mb-1" style={{ color: colors.white }}>Walrus</h4>
                      <p className="text-xs" style={{ color: colors.lightBlue }}>Decentralized Storage</p>
                    </div>
                  </motion.div>
                </div>

                {/* Seal - Encryption Layer */}
                <div className="absolute bottom-8 right-8">
                  <motion.div
                    className="backdrop-blur-sm rounded-2xl p-4 border shadow-lg max-w-[140px] cursor-pointer group"
                    style={{ backgroundColor: colors.darkNavy, borderColor: colors.primary }}
                    whileHover={{
                      scale: 1.1,
                      rotate: -5,
                      y: -10,
                      boxShadow: `0 20px 40px ${colors.lightBlue}40`
                    }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <div className="flex flex-col items-center text-center">
                      <motion.div
                        className="w-12 h-12 rounded-full flex items-center justify-center mb-2"
                        style={{ backgroundColor: colors.lightBlue }}
                        whileHover={{
                          scale: [1, 1.3, 1],
                          borderRadius: ["50%", "30%", "50%"]
                        }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                      >
                        <img src="/Seal_logo.png" alt="Seal" className="w-8 h-8 object-contain rounded-full" />
                      </motion.div>
                      <h4 className="font-bold text-sm mb-1" style={{ color: colors.white }}>Seal</h4>
                      <p className="text-xs" style={{ color: colors.lightBlue }}>Document Encryption</p>
                    </div>
                  </motion.div>
                </div>

                {/* Nautilus - Computation Layer */}
                <div className="absolute top-8 left-1/2 transform -translate-x-1/2">
                  <motion.div
                    className="backdrop-blur-sm rounded-2xl p-4 border shadow-lg max-w-[140px] cursor-pointer group"
                    style={{ backgroundColor: colors.darkNavy, borderColor: colors.primary }}
                    whileHover={{
                      scale: 1.1,
                      rotateX: 15,
                      rotateY: 15,
                      boxShadow: `0 20px 40px ${colors.primary}40`
                    }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <div className="flex flex-col items-center text-center">
                      <motion.div
                        className="w-12 h-12 rounded-full flex items-center justify-center mb-2"
                        style={{ backgroundColor: colors.primary }}
                        whileHover={{
                          rotate: [0, 180, 360],
                          scale: [1, 1.1, 1]
                        }}
                        transition={{ duration: 1.2, ease: "easeInOut" }}
                      >
                        <img src="/nautilus.png" alt="Nautilus" className="w-8 h-8 object-contain" />
                      </motion.div>
                      <h4 className="font-bold text-sm mb-1" style={{ color: colors.white }}>Nautilus</h4>
                      <p className="text-xs" style={{ color: colors.lightBlue }}>Off-chain Compute</p>
                    </div>
                  </motion.div>
                </div>

                {/* Data Flow Indicators */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: colors.primary }}></div>
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: colors.lightBlue, animationDelay: '0.5s' }}></div>
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: colors.primary, animationDelay: '1s' }}></div>
                  </div>
                </div>

                {/* Ecosystem Label */}
                <div className="absolute top-0 left-0 right-0 text-center">
                  <motion.div
                    className="inline-block backdrop-blur-sm rounded-full px-4 py-2 border cursor-pointer"
                    style={{ backgroundColor: colors.darkNavy, borderColor: colors.primary }}
                    whileHover={{
                      scale: 1.05,
                      boxShadow: `0 10px 30px ${colors.primary}30`
                    }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                    <motion.p
                      className="text-sm font-semibold"
                      style={{ color: colors.lightBlue }}
                      whileHover={{ color: colors.primary }}
                      transition={{ duration: 0.3 }}
                    >
                      SuiVerify Ecosystem
                    </motion.p>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="p-2 px-6 border-t" style={{ backgroundColor: colors.darkerNavy, borderColor: colors.lightBlue }}>
        <div className="text-center">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">
              <span style={{ color: colors.primary }}>Sui</span><span style={{ color: colors.white }}>Verify</span>
            </h3>
            <p className="text-center flex-1 text-gray-500">All rights reserved</p>
            <a href="https://suiverify.gitbook.io/suiverify/" target="_blank" rel="noopener noreferrer" className="transition-colors hover:opacity-80" style={{ color: colors.lightBlue }}>Docs</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
