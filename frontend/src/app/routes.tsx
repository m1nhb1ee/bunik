import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import HomePage from "./pages/HomePage";
import TruongPage from "./pages/TruongPage";
import TruongDetailPage from "./pages/TruongDetailPage";
import NganhPage from "./pages/NganhPage";
import NganhDetailPage from "./pages/NganhDetailPage";
import XepHangPage from "./pages/XepHangPage";
import SoSanhPage from "./pages/SoSanhPage";
import HoSoPage from "./pages/HoSoPage";
import BXHPage from "./pages/BXHPage";
import TimNganhPage from "./pages/TimNganhPage";
import AuthPage from "./pages/AuthPage";

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="text-7xl mb-6">404</div>
      <h1
        style={{
          fontFamily: "'Baloo 2', cursive",
          fontWeight: 800,
          color: "#1A1A2E",
          fontSize: "2rem",
          marginBottom: 8,
        }}
      >
        404 - Khong tim thay trang
      </h1>
      <p style={{ color: "#4A4A6A", marginBottom: 24 }}>
        Trang ban tim kiem khong ton tai hoac da bi di chuyen
      </p>
      <a
        href="/"
        style={{
          background: "#ff947a",
          color: "#fff",
          padding: "12px 28px",
          borderRadius: 16,
          fontWeight: 700,
          textDecoration: "none",
          boxShadow: "3px 3px 0px rgba(255,148,122,0.32)",
        }}
      >
        Ve trang chu
      </a>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: HomePage },
      { path: "truong", Component: TruongPage },
      { path: "truong/:id", Component: TruongDetailPage },
      { path: "nganh", Component: NganhPage },
      { path: "nganh/:id", Component: NganhDetailPage },
      { path: "xep-hang", Component: XepHangPage },
      { path: "so-sanh", Component: SoSanhPage },
      { path: "ho-so", Component: HoSoPage },
      { path: "bxh", Component: BXHPage },
      { path: "tim-nganh", Component: TimNganhPage },
      { path: "dang-nhap", Component: AuthPage },
      { path: "dang-ky", Component: AuthPage },
      { path: "*", Component: NotFound },
    ],
  },
]);
