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

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="text-7xl mb-6">🗺️</div>
      <h1
        style={{
          fontFamily: "'Baloo 2', cursive",
          fontWeight: 800,
          color: "#1A1A2E",
          fontSize: "2rem",
          marginBottom: 8,
        }}
      >
        404 – Không tìm thấy trang
      </h1>
      <p style={{ color: "#4A4A6A", marginBottom: 24 }}>
        Trang bạn tìm kiếm không tồn tại hoặc đã bị di chuyển
      </p>
      <a
        href="/"
        style={{
          background: "linear-gradient(135deg, #5B4FCF 0%, #7C6BE8 100%)",
          color: "#fff",
          padding: "12px 28px",
          borderRadius: 16,
          fontWeight: 700,
          textDecoration: "none",
          boxShadow: "3px 3px 0px rgba(91,79,207,0.3)",
        }}
      >
        Về trang chủ
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
      { path: "*", Component: NotFound },
    ],
  },
]);
