import { useState } from "react";
import { Link, useLocation, Outlet } from "react-router";
import { Menu, X, Search, BookOpen, Award, BarChart3, Users, User, Star, Compass } from "lucide-react";

const navLinks = [
  { href: "/", label: "Trang chủ", icon: null },
  { href: "/truong", label: "Trường ĐH", icon: BookOpen },
  { href: "/nganh", label: "Ngành học", icon: Compass },
  { href: "/xep-hang", label: "Xếp hạng", icon: Award },
  { href: "/so-sanh", label: "So sánh", icon: BarChart3 },
  { href: "/tim-nganh", label: "Tìm ngành", icon: Search },
  { href: "/ho-so", label: "Hồ sơ", icon: User },
  { href: "/bxh", label: "BXH Users", icon: Users },
];

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: "#FAFAF8",
        fontFamily: "'Nunito', sans-serif",
      }}
    >
      {/* SVG Filters for hand-drawn effect */}
      <svg style={{ position: "absolute", width: 0, height: 0 }}>
        <defs>
          <filter id="sketchy">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      {/* Navbar */}
      <nav
        className="sticky top-0 z-50"
        style={{
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: "2px solid rgba(91,79,207,0.12)",
          boxShadow: "0 2px 12px rgba(91,79,207,0.08)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-lg"
                style={{
                  background: "linear-gradient(135deg, #5B4FCF 0%, #FF6B6B 100%)",
                  boxShadow: "3px 3px 0px rgba(91,79,207,0.3)",
                  fontFamily: "'Baloo 2', cursive",
                  fontWeight: 800,
                }}
              >
                G1
              </div>
              <span
                className="text-xl hidden sm:block"
                style={{
                  fontFamily: "'Baloo 2', cursive",
                  fontWeight: 800,
                  color: "#5B4FCF",
                }}
              >
                GR1
                <span style={{ color: "#FF6B6B" }}> Career</span>
              </span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => {
                const active = location.pathname === link.href || (link.href !== "/" && location.pathname.startsWith(link.href));
                return (
                  <Link
                    key={link.href}
                    to={link.href}
                    className="px-3 py-2 rounded-xl text-sm transition-all"
                    style={{
                      color: active ? "#5B4FCF" : "#4A4A6A",
                      background: active ? "rgba(91,79,207,0.1)" : "transparent",
                      fontWeight: active ? 700 : 600,
                    }}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>

            {/* CTA + Mobile toggle */}
            <div className="flex items-center gap-2">
              <Link
                to="/ho-so"
                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-2xl text-white text-sm"
                style={{
                  background: "linear-gradient(135deg, #5B4FCF 0%, #7C6BE8 100%)",
                  boxShadow: "3px 3px 0px rgba(91,79,207,0.25)",
                  fontWeight: 700,
                }}
              >
                <Star size={14} />
                Tính điểm
              </Link>
              <button
                className="lg:hidden p-2 rounded-xl"
                onClick={() => setMobileOpen(!mobileOpen)}
                style={{ color: "#5B4FCF" }}
              >
                {mobileOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="lg:hidden border-t px-4 py-3 flex flex-col gap-1" style={{ borderColor: "rgba(91,79,207,0.1)" }}>
            {navLinks.map((link) => {
              const active = location.pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm"
                  style={{
                    color: active ? "#5B4FCF" : "#4A4A6A",
                    background: active ? "rgba(91,79,207,0.1)" : "transparent",
                    fontWeight: active ? 700 : 600,
                  }}
                >
                  {Icon && <Icon size={16} />}
                  {link.label}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* Page content */}
      <main>
        <Outlet />
      </main>

      {/* Footer */}
      <footer style={{ background: "#1A1A2E", marginTop: "80px" }}>
        {/* Wavy top border */}
        <svg viewBox="0 0 1440 60" xmlns="http://www.w3.org/2000/svg" style={{ display: "block", marginTop: -2 }}>
          <path
            d="M0,30 C180,60 360,5 540,30 C720,55 900,10 1080,30 C1260,50 1380,15 1440,25 L1440,60 L0,60 Z"
            fill="#1A1A2E"
          />
        </svg>
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm"
                  style={{
                    background: "linear-gradient(135deg, #5B4FCF 0%, #FF6B6B 100%)",
                    fontFamily: "'Baloo 2', cursive",
                    fontWeight: 800,
                  }}
                >
                  G1
                </div>
                <span style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, color: "#fff", fontSize: 18 }}>
                  GR1 Career
                </span>
              </div>
              <p style={{ color: "#9090AA", fontSize: 14, lineHeight: 1.7 }}>
                Hệ thống hướng nghiệp & tuyển sinh đại học thông minh dành cho học sinh THPT Việt Nam.
              </p>
            </div>
            {[
              {
                title: "Tra cứu",
                links: ["Danh sách trường", "Danh sách ngành", "Bảng xếp hạng", "So sánh ngành"],
              },
              {
                title: "Công cụ",
                links: ["Tìm ngành phù hợp", "Tính điểm học lực", "BXH người dùng", "Hồ sơ cá nhân"],
              },
              {
                title: "Thông tin",
                links: ["Về chúng tôi", "Phương pháp xếp hạng", "Điều khoản", "Liên hệ"],
              },
            ].map((col) => (
              <div key={col.title}>
                <h4 style={{ color: "#fff", fontWeight: 700, marginBottom: 14, fontSize: 15 }}>{col.title}</h4>
                <ul style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {col.links.map((l) => (
                    <li key={l}>
                      <a href="#" style={{ color: "#9090AA", fontSize: 14, textDecoration: "none" }}>
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div
            className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8"
            style={{ borderTop: "1px solid rgba(144,144,170,0.2)" }}
          >
            <p style={{ color: "#9090AA", fontSize: 13 }}>© 2025 GR1 Career Platform. All rights reserved.</p>
            <div className="flex gap-4">
              {["#5B4FCF", "#FF6B6B", "#43D9A3"].map((color, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full"
                  style={{ background: color, opacity: 0.7, cursor: "pointer" }}
                />
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
