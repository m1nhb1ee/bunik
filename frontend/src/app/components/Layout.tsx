import { useEffect, useState } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router";
import { Menu, X, Search, BookOpen, Award, BarChart3, Users, User, Star, Compass } from "lucide-react";
import logo from "../../assets/logo.svg";
import { PlayfulCursorField } from "./PlayfulCursorField";

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
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [username, setUsername] = useState("");
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  useEffect(() => {
    const rawUser = localStorage.getItem("gr1_user");
    if (!rawUser) {
      setUsername("");
      return;
    }

    try {
      const parsed = JSON.parse(rawUser);
      setUsername(parsed?.user_name ?? "");
    } catch {
      setUsername("");
    }
  }, [location.pathname]);

  const logout = () => {
    localStorage.removeItem("gr1_access_token");
    localStorage.removeItem("gr1_refresh_token");
    localStorage.removeItem("gr1_user");
    setUsername("");
    setAccountMenuOpen(false);
    navigate("/dang-nhap");
  };

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: "#FAFAF8",
        fontFamily: "'Nunito', sans-serif",
        position: "relative",
      }}
    >
      <PlayfulCursorField />
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
          borderBottom: "2px solid rgba(2,82,89,0.12)",
          boxShadow: "0 2px 12px rgba(2,82,89,0.08)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <img src={logo} alt="GR1 logo" className="h-10 w-10 rounded-2xl border bg-white object-cover" style={{ borderColor: "rgba(2,82,89,0.2)" }} />
              <span
                className="text-xl hidden sm:block"
                style={{
                  fontFamily: "'Baloo 2', cursive",
                  fontWeight: 800,
                  color: "#ffffff",
                }}
              >
                <span style={{ color: "#f57573" }}>b</span>
                <span style={{ color: "#BFDBFE" }}>uni</span>
                <span style={{ color: "#f57573" }}>k</span>
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
                      color: active ? "#ff947a" : "#4A4A6A",
                      background: active ? "rgba(255,148,122,0.16)" : "transparent",
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
              {username ? (
                <div className="relative hidden sm:block">
                  <button
                    onClick={() => setAccountMenuOpen((value) => !value)}
                    className="flex items-center gap-2 px-4 py-2 rounded-2xl text-white text-sm"
                    style={{
                      background: "#ff947a",
                      boxShadow: "3px 3px 0px rgba(255,148,122,0.28)",
                      fontWeight: 700,
                    }}
                  >
                    <Star size={14} />
                    {username}
                  </button>
                  {accountMenuOpen && (
                    <div
                      className="absolute right-0 mt-2 min-w-[150px] rounded-2xl border bg-white p-2"
                      style={{
                        borderColor: "rgba(2,82,89,0.12)",
                        boxShadow: "0 8px 22px rgba(2,82,89,0.12)",
                      }}
                    >
                      <button
                        onClick={logout}
                        className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold"
                        style={{ color: "#4A4A6A" }}
                      >
                        Đăng xuất
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  to="/dang-nhap"
                  className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-2xl text-white text-sm"
                  style={{
                    background: "#ff947a",
                    boxShadow: "3px 3px 0px rgba(255,148,122,0.28)",
                    fontWeight: 700,
                  }}
                >
                  <Star size={14} />
                  Tài khoản
                </Link>
              )}
              <button
                className="lg:hidden p-2 rounded-xl"
                onClick={() => setMobileOpen(!mobileOpen)}
                style={{ color: "#ff947a" }}
              >
                {mobileOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="lg:hidden border-t px-4 py-3 flex flex-col gap-1" style={{ borderColor: "rgba(2,82,89,0.1)" }}>
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
                    color: active ? "#ffffff" : "#4A4A6A",
                    background: active ? "rgba(255,148,122,0.16)" : "transparent",
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
      <footer style={{ background: "#272727", marginTop: "80px" }}>
        {/* Wavy top border */}
        <svg viewBox="0 0 1440 60" xmlns="http://www.w3.org/2000/svg" style={{ display: "block", marginTop: -2 }}>
          <path
            d="M0,30 C180,60 360,5 540,30 C720,55 900,10 1080,30 C1260,50 1380,15 1440,25 L1440,60 L0,60 Z"
            fill="rgb(71, 71, 71)"
          />
        </svg>
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src={logo} alt="GR1 logo" className="h-9 w-9 rounded-xl border border-white/35 bg-white object-cover" />
                <span style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, color: "#ffffff", fontSize: 18 }}>
                  bunik
                </span>
              </div>
              <p style={{ color: "#ffffff", fontSize: 14, lineHeight: 1.7, opacity: 0.92 }}>
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
                <h4 style={{ color: "#ffffff", fontWeight: 700, marginBottom: 14, fontSize: 15 }}>{col.title}</h4>
                <ul style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {col.links.map((l) => (
                    <li key={l}>
                      <a href="#" style={{ color: "#ffffff", opacity: 0.88, fontSize: 14, textDecoration: "none" }}>
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
            style={{ borderTop: "1px solid rgba(211,197,246,0.25)" }}
          >
            <p style={{ color: "#ffffff", opacity: 0.85, fontSize: 13 }}>© 2026 bunik Platform. All rights reserved.</p>
            <div className="flex gap-4">
              {["#ffffff", "#bfdbfe", "#93c5fd"].map((color, i) => (
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
