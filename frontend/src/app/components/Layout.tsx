import { useEffect, useState } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router";
import { Menu, X } from "lucide-react";
import { PlayfulCursorField } from "./PlayfulCursorField";

const navLinks = [
  { href: "/", label: "Trang chủ" },
  { href: "/truong", label: "Trường ĐH" },
  { href: "/nganh", label: "Ngành học" },
  { href: "/xep-hang", label: "Xếp hạng" },
  { href: "/so-sanh", label: "So sánh" },
  { href: "/tim-nganh", label: "Tìm ngành" },
  { href: "/ho-so", label: "Hồ sơ" },
  { href: "/bxh", label: "BXH" },
];

const ink = "#2B2722";
const paper = "#F4EEE1";
const paperLight = "#FBF7EE";
const terracotta = "#C2603F";

/** Bird mark inside a wobbly terracotta circle. */
function BunikMark({ size = 42 }: { size?: number }) {
  return (
    <svg viewBox="0 0 44 44" width={size} height={size} style={{ overflow: "visible" }}>
      <path
        d="M6 23 C5 12, 14 6, 22 7 C31 6, 39 12, 38 22 C39 33, 30 39, 22 38 C13 39, 5 33, 6 23 Z"
        fill={terracotta}
        stroke={ink}
        strokeWidth="2"
        filter="url(#inkrough)"
      />
      <path
        d="M16 27 C16 18, 18 14, 22 14 C26 14, 28 18, 28 27"
        fill="none"
        stroke={paperLight}
        strokeWidth="2.4"
        strokeLinecap="round"
        filter="url(#inkrough2)"
      />
      <circle cx="29.5" cy="15.5" r="2.4" fill={paperLight} />
    </svg>
  );
}

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

  const isActive = (href: string) =>
    href === "/" ? location.pathname === "/" : location.pathname.startsWith(href);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: paper,
        color: ink,
        fontFamily: "'Be Vietnam Pro', system-ui, sans-serif",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      <PlayfulCursorField />
      <div className="bunik-grain" />

      {/* Shared hand-drawn ink filters (referenced as url(#inkrough) across pages) */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <filter id="inkrough">
            <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="7" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="2.1" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="inkrough2">
            <feTurbulence type="fractalNoise" baseFrequency="0.026" numOctaves="2" seed="19" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      <div style={{ position: "relative", zIndex: 3 }}>
        {/* ===== NAV ===== */}
        <nav
          id="top"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            background: "rgba(244,238,225,0.86)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            style={{
              maxWidth: 1200,
              margin: "0 auto",
              padding: "0 24px",
              height: 66,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 18,
            }}
          >
            <Link to="/" style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none" }}>
              <span style={{ position: "relative", width: 42, height: 42, flex: "none" }}>
                <BunikMark />
              </span>
              <span
                style={{
                  fontFamily: "'Shantell Sans', cursive",
                  fontWeight: 700,
                  fontSize: 27,
                  color: ink,
                  letterSpacing: "0.2px",
                  lineHeight: 1,
                }}
              >
                bunik
              </span>
            </Link>

            {/* Desktop nav */}
            <div
              className="hidden lg:flex"
              style={{ alignItems: "center", gap: 2, flexWrap: "wrap", justifyContent: "center" }}
            >
              {navLinks.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    to={link.href}
                    className="bunik-navlink"
                    style={{
                      position: "relative",
                      padding: "8px 11px",
                      fontFamily: "'Be Vietnam Pro', sans-serif",
                      fontWeight: 600,
                      fontSize: 14.5,
                      color: active ? terracotta : "#4A4239",
                      textDecoration: "none",
                    }}
                  >
                    {link.label}
                    {active && (
                      <svg
                        viewBox="0 0 60 11"
                        style={{ position: "absolute", left: 8, bottom: -1, width: "calc(100% - 16px)", height: 9, overflow: "visible" }}
                      >
                        <path
                          d="M2 6 C 17 1, 43 10, 58 4"
                          stroke={terracotta}
                          strokeWidth="2.6"
                          fill="none"
                          strokeLinecap="round"
                          filter="url(#inkrough)"
                        />
                      </svg>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Account + mobile toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {username ? (
                <div className="relative hidden sm:block">
                  <button
                    onClick={() => setAccountMenuOpen((value) => !value)}
                    aria-expanded={accountMenuOpen}
                    aria-haspopup="menu"
                    className="bunik-press"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      background: paperLight,
                      border: `2px solid ${ink}`,
                      borderRadius: "13px 17px 12px 16px/16px 12px 17px 13px",
                      padding: "9px 17px",
                      fontFamily: "'Be Vietnam Pro', sans-serif",
                      fontWeight: 700,
                      fontSize: 14,
                      color: ink,
                      ["--sh" as string]: terracotta,
                    }}
                  >
                    <StarIcon />
                    {username}
                  </button>
                  {accountMenuOpen && (
                    <div
                      className="absolute right-0 mt-2"
                      style={{
                        minWidth: 150,
                        borderRadius: 14,
                        border: `2px solid ${ink}`,
                        background: paperLight,
                        padding: 8,
                        boxShadow: "4px 4px 0 rgba(43,39,34,0.16)",
                      }}
                    >
                      <button
                        onClick={logout}
                        style={{
                          width: "100%",
                          borderRadius: 10,
                          padding: "8px 12px",
                          textAlign: "left",
                          fontSize: 14,
                          fontWeight: 600,
                          color: "#4A4239",
                          background: "none",
                          border: "none",
                        }}
                      >
                        Đăng xuất
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  to="/dang-nhap"
                  className="bunik-press hidden sm:inline-flex"
                  style={{
                    alignItems: "center",
                    gap: 7,
                    background: paperLight,
                    border: `2px solid ${ink}`,
                    borderRadius: "13px 17px 12px 16px/16px 12px 17px 13px",
                    padding: "9px 17px",
                    fontFamily: "'Be Vietnam Pro', sans-serif",
                    fontWeight: 700,
                    fontSize: 14,
                    color: ink,
                    textDecoration: "none",
                    ["--sh" as string]: terracotta,
                  }}
                >
                  <StarIcon />
                  Tài khoản
                </Link>
              )}
              <button
                className="lg:hidden"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label={mobileOpen ? "Đóng menu" : "Mở menu"}
                aria-expanded={mobileOpen}
                aria-controls="mobile-navigation"
                style={{ padding: 8, borderRadius: 10, color: terracotta, background: "none", border: "none" }}
              >
                {mobileOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>

          {/* Ink baseline */}
          <svg viewBox="0 0 1200 8" preserveAspectRatio="none" style={{ display: "block", width: "100%", height: 7 }}>
            <path
              d="M0 4 C 180 1, 360 7, 560 3 C 760 0, 940 7, 1200 3"
              stroke={ink}
              strokeWidth="2"
              fill="none"
              filter="url(#inkrough)"
            />
          </svg>

          {/* Mobile menu */}
          {mobileOpen && (
            <div
              id="mobile-navigation"
              className="lg:hidden"
              style={{ borderTop: `1px dashed ${ink}33`, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 4, background: paper }}
            >
              {navLinks.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    to={link.href}
                    onClick={() => setMobileOpen(false)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      fontSize: 14.5,
                      fontWeight: active ? 700 : 600,
                      color: active ? terracotta : "#4A4239",
                      textDecoration: "none",
                    }}
                  >
                    {link.label}
                  </Link>
                );
              })}
              {username ? (
                <button
                  type="button"
                  onClick={logout}
                  style={{ marginTop: 6, padding: "10px 12px", border: `2px solid ${ink}`, borderRadius: 10, background: paperLight, color: terracotta, textAlign: "left", fontSize: 14.5, fontWeight: 700 }}
                >
                  Đăng xuất · {username}
                </button>
              ) : (
                <Link
                  to="/dang-nhap"
                  onClick={() => setMobileOpen(false)}
                  style={{ marginTop: 6, padding: "10px 12px", border: `2px solid ${ink}`, borderRadius: 10, background: paperLight, color: terracotta, textDecoration: "none", fontSize: 14.5, fontWeight: 700 }}
                >
                  Tài khoản
                </Link>
              )}
            </div>
          )}
        </nav>

        {/* ===== PAGE ===== */}
        <main>
          <Outlet />
        </main>

        {/* ===== FOOTER ===== */}
        <footer style={{ marginTop: 70, position: "relative" }}>
          <svg viewBox="0 0 1200 26" preserveAspectRatio="none" style={{ display: "block", width: "100%", height: 24 }}>
            <path
              d="M0 16 C 150 4, 320 22, 520 12 C 720 2, 900 22, 1090 12 C 1140 9, 1170 13, 1200 11 L1200 26 L0 26 Z"
              fill={ink}
              filter="url(#inkrough)"
            />
          </svg>
          <div style={{ background: ink, color: paper }}>
            <div
              style={{
                maxWidth: 1200,
                margin: "0 auto",
                padding: "46px 24px 30px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
                gap: 32,
              }}
            >
              <div style={{ gridColumn: "1/-1", maxWidth: 320 }}>
                <span style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: 28, color: paper }}>
                  bunik
                </span>
                <p style={{ color: "#C9BFAD", fontSize: 14, lineHeight: 1.7, margin: "12px 0 0" }}>
                  Cuốn sổ tay hướng nghiệp & tuyển sinh đại học cho học sinh THPT Việt Nam. Vẽ nên con đường của riêng mình.
                </p>
                <svg viewBox="0 0 150 12" style={{ width: 150, height: 12, marginTop: 12, overflow: "visible" }}>
                  <path d="M2 7 C 40 2, 90 11, 148 4" stroke={terracotta} strokeWidth="3" fill="none" strokeLinecap="round" filter="url(#inkrough)" />
                </svg>
              </div>
              {[
                { title: "Tra cứu", links: [["Danh sách trường", "/truong"], ["Danh sách ngành", "/nganh"], ["Bảng xếp hạng", "/xep-hang"], ["So sánh ngành", "/so-sanh"]] },
                { title: "Công cụ", links: [["Tìm ngành phù hợp", "/tim-nganh"], ["Tính điểm học lực", "/ho-so"], ["BXH người dùng", "/bxh"], ["Hồ sơ cá nhân", "/ho-so"]] },
                { title: "Thông tin", links: [["Về chúng tôi", "/"], ["Cách xếp hạng", "/xep-hang"], ["Điều khoản", "/"], ["Liên hệ", "/"]] },
              ].map((col) => (
                <div key={col.title}>
                  <p style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 600, fontSize: 17, color: paper, margin: "0 0 12px" }}>
                    {col.title}
                  </p>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 9 }}>
                    {col.links.map(([label, href], i) => (
                      <li key={`${col.title}-${i}`}>
                        <Link to={href} style={{ color: "#C9BFAD", fontSize: 14, textDecoration: "none" }}>
                          {label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div
              style={{
                maxWidth: 1200,
                margin: "0 auto",
                padding: "18px 24px 30px",
                borderTop: "1px dashed rgba(201,191,173,0.3)",
                display: "flex",
                flexWrap: "wrap",
                gap: 14,
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <p style={{ color: "#9C9384", fontSize: 13, margin: 0 }}>© 2026 bunik · vẽ tay với nhiều yêu thương</p>
              <span style={{ fontFamily: "'Patrick Hand', cursive", fontSize: 20, color: terracotta }}>
                Đi đâu rồi cũng tới…
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function StarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 18 18" style={{ overflow: "visible" }}>
      <path
        d="M9 2 L11 7 L16 8 L11 9.5 L9 15 L7 9.5 L2 8 L7 7 Z"
        fill="#C2603F"
        stroke="#2B2722"
        strokeWidth="1.2"
        strokeLinejoin="round"
        filter="url(#inkrough2)"
      />
    </svg>
  );
}
