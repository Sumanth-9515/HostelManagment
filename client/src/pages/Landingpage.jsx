import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API } from "../api.js";

export default function LandingPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      if (saved) return saved === "dark";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });
  const navigate = useNavigate();

  // Refs for animation
  const sectionsRef = useRef([]);
  const observerRef = useRef(null);

  // EXACT SAME API CALL LOGIC - NOT CHANGED
  useEffect(() => {
    fetch(`${API}/plans`)
      .then(r => r.json())
      .then(data => setPlans(Array.isArray(data) ? data : []))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  // Dark mode effect with proper class toggling
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  // Intersection Observer for scroll animations
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-fade-up", "opacity-100");
            entry.target.classList.remove("opacity-0", "translate-y-8");
            observerRef.current.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -100px 0px" }
    );

    sectionsRef.current.forEach((section) => {
      if (section) observerRef.current.observe(section);
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  // EXACT SAME handleChoosePlan LOGIC - NOT CHANGED
  const handleChoosePlan = (plan) => {
    navigate("/register", { state: { plan } });
  };

  const toggleDarkMode = () => setDarkMode(!darkMode);
  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);

  // Scroll to pricing section
  const scrollToPricing = () => {
    const pricingSection = document.getElementById("plans");
    if (pricingSection) {
      pricingSection.scrollIntoView({ behavior: "smooth" });
    }
    setMobileMenuOpen(false);
  };

  const addToRefs = (el, index) => {
    if (el && !sectionsRef.current.includes(el)) {
      sectionsRef.current[index] = el;
    }
  };

  const features = [
    { icon: "📊", title: "Dashboard", desc: "Real-time insights into occupancy, revenue, and tenant activities", color: "from-blue-500 to-cyan-500" },
    { icon: "💰", title: "Rent Management", desc: "Track payments, send reminders, and generate receipts automatically", color: "from-green-500 to-emerald-500" },
    { icon: "👥", title: "Add Candidate", desc: "Quick tenant onboarding with digital KYC and agreement management", color: "from-purple-500 to-pink-500" },
    { icon: "📈", title: "Total Candidates", desc: "View all tenants and applicants in one organized list", color: "from-orange-500 to-red-500" },
    { icon: "🏢", title: "Property Management", desc: "Manage multiple properties, rooms, and bed allocations", color: "from-indigo-500 to-blue-500" },
    { icon: "👁️", title: "Overview", desc: "Get a bird's-eye view of your entire hostel operations", color: "from-teal-500 to-green-500" },
    { icon: "🚀", title: "Onboarding Manager", desc: "Streamlined process for new tenant registration", color: "from-rose-500 to-pink-500" },
    { icon: "🔔", title: "Notifications", desc: "Automated alerts for rent due, move-ins, and important updates", color: "from-amber-500 to-yellow-500" },
  ];

  const steps = [
    { num: "01", title: "Add Tenant", desc: "Register tenant details and upload documents", icon: "👤" },
    { num: "02", title: "Assign Room", desc: "Allocate room and bed based on availability", icon: "🛏️" },
    { num: "03", title: "Track Rent", desc: "Monitor payments and send automated reminders", icon: "💰" },
    { num: "04", title: "Send Alerts", desc: "Notify tenants about dues and important updates", icon: "🔔" },
    { num: "05", title: "Monitor Dashboard", desc: "View analytics and manage operations from one place", icon: "📊" },
  ];

  const benefits = [
    { icon: "⚡", title: "Saves Time", desc: "Automate daily operations by 80%", stat: "-80% Workload" },
    { icon: "🎯", title: "Easy Management", desc: "Intuitive interface for everyone", stat: "No Training Needed" },
    { icon: "🔒", title: "Secure Data", desc: "Bank-grade encryption", stat: "ISO Certified" },
    { icon: "🔔", title: "Automated Reminders", desc: "Never miss a payment", stat: "98% On-time Payment" },
    { icon: "📡", title: "Real-time Tracking", desc: "Live updates on all activities", stat: "Real-time Sync" },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 transition-colors duration-300 overflow-x-hidden">
      {/* Tailwind CSS CDN */}
      <script src="https://cdn.tailwindcss.com"></script>
      
      {/* Custom Config for Dark Mode */}
      <script>
        {`
          tailwind.config = {
            darkMode: 'class',
            theme: {
              extend: {},
            }
          }
        `}
      </script>

      {/* Global Styles for Animations */}
      <style jsx global>{`
        @keyframes fade-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scale-up {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes slide-in-left {
          from {
            opacity: 0;
            transform: translateX(-40px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes slide-in-right {
          from {
            opacity: 0;
            transform: translateX(40px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .animate-fade-up {
          animation: fade-up 0.6s ease-out forwards;
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out forwards;
        }
        .animate-scale-up {
          animation: scale-up 0.4s ease-out forwards;
        }
        .animate-slide-left {
          animation: slide-in-left 0.5s ease-out forwards;
        }
        .animate-slide-right {
          animation: slide-in-right 0.5s ease-out forwards;
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        .hover-lift {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .hover-lift:hover {
          transform: translateY(-5px);
          box-shadow: 0 20px 25px -12px rgba(0, 0, 0, 0.15);
        }
        .gradient-border {
          background: linear-gradient(135deg, #4f46e5, #6366f1, #8b5cf6);
          background-size: 200% 200%;
          animation: gradient-shift 3s ease infinite;
        }
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        html {
          scroll-behavior: smooth;
        }
        ::-webkit-scrollbar {
          width: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        ::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #4f46e5, #6366f1);
          border-radius: 4px;
        }
        .dark ::-webkit-scrollbar-track {
          background: #1e293b;
        }
        .dark {
          color-scheme: dark;
        }
      `}</style>

{/* Simple Navigation */}
<nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200">
  <div className="max-w-7xl mx-auto px-6">
    <div className="flex justify-between items-center h-16">

      {/* Logo */}
      <div className="flex items-center gap-3 cursor-pointer">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg bg-indigo-600 shadow-lg">
          🏨
        </div>

        <span className="font-bold text-lg text-indigo-600">
          Nilayam
        </span>
      </div>

      {/* Sign In Button */}
      <Link
        to="/login"
        className="px-5 py-2 text-sm font-semibold text-indigo-600 border-2 border-indigo-600 rounded-xl hover:bg-indigo-50 transition-all duration-300"
      >
        Sign In
      </Link>

    </div>
  </div>
</nav>

      {/* Hero Section */}
      <section className="relative pt-20 md:pt-28 pb-12 md:pb-20 overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="absolute top-20 left-10 w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float"></div>
        <div className="absolute bottom-20 right-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" style={{ animationDelay: "2s" }}></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="text-center md:text-left opacity-0 animate-slide-left" style={{ animationDelay: "0.2s", animationFillMode: "forwards" }}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs md:text-sm font-medium mb-4 md:mb-6">
                <span className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse"></span>
                Trusted by 500+ Hostel Owners
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-900 dark:text-white leading-tight mb-4 md:mb-6">
                Smart Hostel Management{" "}
                <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Made Simple
                </span>
              </h1>
              <p className="text-base md:text-lg text-slate-600 dark:text-slate-300 mb-6 md:mb-8 leading-relaxed">
                Streamline your hostel operations, manage tenants, track rent payments, 
                and grow your property business with our all-in-one platform.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center md:justify-start">
                <Link
                      onClick={scrollToPricing}
                  className="px-5 md:px-6 py-2.5 md:py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-indigo-600 transition-all duration-300 shadow-lg hover:shadow-xl text-center text-sm md:text-base"
                >
                  Get Started Free →
                </Link>
              </div>
            </div>

            {/* Hero Section - Right side with image */}
            <div className="relative opacity-0 animate-slide-right" style={{ animationDelay: "0.4s", animationFillMode: "forwards" }}>
              <img 
                src="https://image2url.com/r2/default/images/1775668396334-808b8948-c4f4-4300-855f-142fcb939999.png" 
                alt="Hostel Management Dashboard"
                className="rounded-2xl shadow-2xl w-full h-auto object-cover"
                onError={(e) => {
                  e.target.src = "https://placehold.co/600x400/4f46e5/white?text=Hostel+Dashboard+Preview";
                  e.target.onerror = null;
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <div className="py-8 md:py-12 bg-white dark:bg-slate-900 border-y border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {[
              { num: "500+", label: "Properties Managed" },
              { num: "10K+", label: "Happy Tenants" },
              { num: "99.9%", label: "Uptime" },
              { num: "24/7", label: "Support" },
            ].map((stat, idx) => (
              <div key={stat.label} className="text-center opacity-0 animate-fade-up" style={{ animationDelay: `${idx * 0.1}s`, animationFillMode: "forwards" }}>
                <div className="text-2xl md:text-4xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  {stat.num}
                </div>
                <div className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <section className="py-16 md:py-28 bg-slate-50 dark:bg-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div ref={(el) => addToRefs(el, 0)} className="text-center mb-12 md:mb-16 opacity-0 transition-all duration-700">
            <h2 className="text-2xl md:text-4xl font-extrabold text-slate-900 dark:text-white mb-3 md:mb-4">
              Everything You Need to Run Your Hostel
            </h2>
            <p className="text-base md:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Powerful features designed specifically for hostel and PG management
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
            {features.map((feature, idx) => (
              <div
                key={feature.title}
                ref={(el) => addToRefs(el, idx + 1)}
                className="bg-white dark:bg-slate-800 rounded-2xl p-5 md:p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover-lift opacity-0 transition-all duration-700"
                style={{ transitionDelay: `${idx * 50}ms` }}
              >
                <div className={`w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center text-xl md:text-2xl mb-3 md:mb-4 shadow-md`}>
                  {feature.icon}
                </div>
                <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white mb-1 md:mb-2">{feature.title}</h3>
                <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 md:py-28 bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div ref={(el) => addToRefs(el, 9)} className="text-center mb-12 md:mb-16 opacity-0 transition-all duration-700">
            <h2 className="text-2xl md:text-4xl font-extrabold mb-3 md:mb-4">How It Works</h2>
            <p className="text-base md:text-lg text-indigo-200 max-w-2xl mx-auto">
              Get your hostel up and running in 5 simple steps
            </p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5 md:gap-6">
            {steps.map((step, idx) => (
              <div
                key={step.num}
                ref={(el) => addToRefs(el, idx + 10)}
                className="text-center opacity-0 transition-all duration-700"
                style={{ transitionDelay: `${idx * 100}ms` }}
              >
                <div className="w-14 h-14 md:w-16 md:h-16 mx-auto bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center text-xl md:text-2xl mb-3 md:mb-4 border border-white/20">
                  {step.icon}
                </div>
                <div className="text-2xl md:text-3xl font-bold text-indigo-300 mb-1 md:mb-2">{step.num}</div>
                <h3 className="font-bold text-base md:text-lg mb-1 md:mb-2">{step.title}</h3>
                <p className="text-xs md:text-sm text-indigo-200">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* Benefits Section */}
      <section className="py-16 md:py-28 bg-slate-50 dark:bg-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div ref={(el) => addToRefs(el, 17)} className="text-center mb-12 md:mb-16 opacity-0 transition-all duration-700">
            <h2 className="text-2xl md:text-4xl font-extrabold text-slate-900 dark:text-white mb-3 md:mb-4">
              Why Choose Nilayam?
            </h2>
            <p className="text-base md:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Benefits that make hostel management effortless
            </p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5 md:gap-6">
            {benefits.map((benefit, idx) => (
              <div
                key={benefit.title}
                ref={(el) => addToRefs(el, idx + 18)}
                className="bg-white dark:bg-slate-800 rounded-2xl p-5 md:p-6 text-center shadow-lg hover:shadow-xl transition-all duration-300 hover-lift opacity-0 transition-all duration-700"
                style={{ transitionDelay: `${idx * 100}ms` }}
              >
                <div className="text-4xl md:text-5xl mb-3 md:mb-4">{benefit.icon}</div>
                <h3 className="font-bold text-base md:text-lg text-slate-900 dark:text-white mb-1 md:mb-2">{benefit.title}</h3>
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mb-2">{benefit.desc}</p>
                <span className="inline-block text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-1 rounded-full">
                  {benefit.stat}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANS SECTION - EXACT SAME LOGIC */}
      <section className="py-16 md:py-28 bg-white dark:bg-slate-900" id="plans">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-2xl md:text-4xl font-extrabold text-slate-900 dark:text-white mb-3 md:mb-4">
              Start Managing Your Hostel Smarter Today
            </h2>
            <p className="text-base md:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Choose the perfect plan for your property
            </p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block w-10 h-10 md:w-12 md:h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-slate-600 dark:text-slate-400">Loading plans...</p>
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-600 dark:text-slate-400">No plans available right now. Please check back later.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {plans.map((plan, idx) => (
                <div
                  key={plan._id}
                  className={`relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden transition-all duration-300 hover-lift ${
                    !plan.isFree && idx === 1 ? "ring-2 ring-indigo-500 shadow-2xl" : ""
                  }`}
                >
                  {!plan.isFree && idx === 1 && (
                    <div className="absolute top-0 right-0">
                      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">
                        Most Popular
                      </div>
                    </div>
                  )}
                  <div className="p-6 md:p-8">
                    <h3 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white mb-2">{plan.name}</h3>
                    {plan.isFree ? (
                      <div className="text-3xl md:text-4xl font-extrabold text-emerald-600 dark:text-emerald-400 mb-4">Free</div>
                    ) : (
                      <div className="mb-4">
                        <span className="text-3xl md:text-4xl font-extrabold text-indigo-600 dark:text-indigo-400">
                          ₹{plan.price.toLocaleString("en-IN")}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 text-sm md:text-base"> / {plan.days} days</span>
                      </div>
                    )}
                    <hr className="my-4 border-slate-200 dark:border-slate-700" />
                    <div className="space-y-3 mb-6 md:mb-8">
                      <div className="flex items-center gap-3 text-sm md:text-base text-slate-600 dark:text-slate-400">
                        <span className="text-base md:text-lg">🛏️</span>
                        <span>Up to {plan.beds} beds</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm md:text-base text-slate-600 dark:text-slate-400">
                        <span className="text-base md:text-lg">📅</span>
                        <span>{plan.days} day{plan.days !== 1 ? "s" : ""} access</span>
                      </div>
                      {plan.isFree ? (
                        <div className="flex items-center gap-3 text-sm md:text-base text-emerald-600 dark:text-emerald-400">
                          <span className="text-base md:text-lg">✅</span>
                          <span>Instant access</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 text-sm md:text-base text-slate-600 dark:text-slate-400">
                          <span className="text-base md:text-lg">⏳</span>
                          <span>Activated after approval</span>
                        </div>
                      )}
                    </div>
                    <hr className="my-4 border-slate-200 dark:border-slate-700" />
                    <button
                      onClick={() => handleChoosePlan(plan)}
                      className={`w-full py-2.5 md:py-3 rounded-xl font-semibold text-sm md:text-base transition-all duration-300 ${
                        plan.isFree
                          ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-2 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900"
                          : "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white hover:from-indigo-700 hover:to-indigo-600 shadow-md hover:shadow-xl"
                      }`}
                    >
                      {plan.isFree ? "Get Started Free →" : `Choose ${plan.name} →`}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-28 bg-gradient-to-r from-indigo-600 to-purple-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-4xl font-extrabold text-white mb-3 md:mb-4">
            Ready to Transform Your Hostel Management?
          </h2>
          <p className="text-base md:text-lg text-indigo-100 mb-6 md:mb-8 max-w-2xl mx-auto">
            Join hundreds of hostel owners who trust Nilayam to run their properties efficiently
          </p>
          <Link
            to="/register"
            className="inline-block px-6 md:px-8 py-3 md:py-4 bg-white text-indigo-600 font-bold rounded-xl hover:bg-slate-50 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 text-sm md:text-base"
          >
            Get Started Today →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 dark:bg-slate-950 text-slate-400 py-8 md:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mb-6 md:mb-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3 md:mb-4">
                <div className="w-7 h-7 md:w-8 md:h-8 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center text-white text-xs md:text-sm">🏨</div>
                <span className="font-bold text-white text-sm md:text-base">Nilayam</span>
              </div>
              <p className="text-xs md:text-sm">Smart Hostel Management Platform</p>
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm md:text-base mb-3 md:mb-4">Product</h4>
              <ul className="space-y-1.5 md:space-y-2 text-xs md:text-sm">
                <li><a href="#features" className="hover:text-indigo-400 transition">Features</a></li>
                <li><a href="#plans" className="hover:text-indigo-400 transition">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm md:text-base mb-3 md:mb-4">Company</h4>
              <ul className="space-y-1.5 md:space-y-2 text-xs md:text-sm">
                <li><a href="#" className="hover:text-indigo-400 transition">About Us</a></li>
                <li><a href="#" className="hover:text-indigo-400 transition">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm md:text-base mb-3 md:mb-4">Support</h4>
              <ul className="space-y-1.5 md:space-y-2 text-xs md:text-sm">
                <li><a href="#" className="hover:text-indigo-400 transition">Help Center</a></li>
                <li><a href="#" className="hover:text-indigo-400 transition">Privacy Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-6 md:pt-8 text-center text-xs md:text-sm">
            © {new Date().getFullYear()} Nilayam Hostel Management. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}