import { Link, createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { B, CenterNote, SketchHeading, cardStyle } from "./components/bunik";

function RouteFallback() {
  return <CenterNote title="Đang mở trang…" />;
}

function NotFound() {
  return (
    <div className="bunik-page bunik-container" style={{ minHeight: "65vh", display: "grid", placeItems: "center", paddingBlock: 42 }}>
      <section style={{ ...cardStyle({ shadow: `7px 7px 0 ${B.terracotta}` }), width: "min(100%,540px)", boxSizing: "border-box", padding: "clamp(28px,6vw,48px)", textAlign: "center" }}>
        <p className="bunik-note-text" style={{ fontSize: 24, margin: "0 0 4px" }}>trang giấy này đang trống —</p>
        <SketchHeading color={B.honey} width="90%" size="clamp(2.2rem,8vw,4.5rem)">404</SketchHeading>
        <p style={{ color: B.body, lineHeight: 1.7, margin: "24px 0" }}>Trang bạn tìm kiếm không tồn tại hoặc đã được chuyển sang một địa chỉ khác.</p>
        <Link to="/" className="bunik-button">Về trang chủ</Link>
      </section>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    HydrateFallback: RouteFallback,
    children: [
      { index: true, lazy: () => import("./pages/HomePage").then((module) => ({ Component: module.default })) },
      { path: "truong", lazy: () => import("./pages/TruongPage").then((module) => ({ Component: module.default })) },
      { path: "truong/:id", lazy: () => import("./pages/TruongDetailPage").then((module) => ({ Component: module.default })) },
      { path: "nganh", lazy: () => import("./pages/NganhPage").then((module) => ({ Component: module.default })) },
      { path: "nganh/:id", lazy: () => import("./pages/NganhDetailPage").then((module) => ({ Component: module.default })) },
      { path: "xep-hang", lazy: () => import("./pages/XepHangPage").then((module) => ({ Component: module.default })) },
      { path: "so-sanh", lazy: () => import("./pages/SoSanhPage").then((module) => ({ Component: module.default })) },
      { path: "ho-so", lazy: () => import("./pages/HoSoPage").then((module) => ({ Component: module.default })) },
      { path: "bxh", lazy: () => import("./pages/BXHPage").then((module) => ({ Component: module.default })) },
      { path: "tim-nganh", lazy: () => import("./pages/TimNganhPage").then((module) => ({ Component: module.default })) },
      { path: "dang-nhap", lazy: () => import("./pages/AuthPage").then((module) => ({ Component: module.default })) },
      { path: "dang-ky", lazy: () => import("./pages/AuthPage").then((module) => ({ Component: module.default })) },
      { path: "*", Component: NotFound },
    ],
  },
]);
