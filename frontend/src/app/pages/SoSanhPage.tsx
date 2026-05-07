import { useState, useMemo, useEffect } from "react";
import { useSearchParams, Link } from "react-router";
import { X, Plus, Search, TrendingUp, TrendingDown } from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip
} from "recharts";
import { getAllUniversities, getAllMajors } from "../services/api";
import type { UiUniversity, UiMajor } from "../types/api";

const dotBg = {
  backgroundImage: "radial-gradient(circle, #d0cef0 1px, transparent 1px)",
  backgroundSize: "24px 24px",
  backgroundColor: "#FAFAF8",
  animation: "dotDrift 24s linear infinite",
};

const handCard = {
  background: "#fff",
  borderRadius: 20,
  border: "2px solid rgba(91,79,207,0.12)",
  boxShadow: "4px 4px 0px rgba(91,79,207,0.09)",
};

const COLORS = ["#5B4FCF", "#FF6B6B", "#43D9A3", "#FFB347", "#9C27B0"];

type Item = UiUniversity | UiMajor;

function isUniversity(item: Item): item is UiUniversity {
  return "abbr" in item;
}

export default function SoSanhPage() {
  const [searchParams] = useSearchParams();
  const initialIds = searchParams.get("ids")?.split(",").filter(Boolean) ?? [];
  const type = searchParams.get("type") || "truong";

  const [compareIds, setCompareIds] = useState<string[]>(initialIds.slice(0, 5));
  const [searchQ, setSearchQ] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [dataSource, setDataSource] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const load = type === "nganh" ? getAllMajors() : getAllUniversities();
    load
      .then((data) => setDataSource(data as Item[]))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [type]);

  const items = useMemo(
    () => compareIds.map((id) => dataSource.find((d) => d.id === id)).filter(Boolean) as Item[],
    [compareIds, dataSource]
  );

  const removeItem = (id: string) => setCompareIds((p) => p.filter((x) => x !== id));
  const addItem = (id: string) => {
    if (!compareIds.includes(id) && compareIds.length < 5) {
      setCompareIds((p) => [...p, id]);
      setShowSearch(false);
      setSearchQ("");
    }
  };

  const searchResults = useMemo(() => {
    if (!searchQ) return dataSource.slice(0, 8);
    return dataSource
      .filter((d) => d.name.toLowerCase().includes(searchQ.toLowerCase()))
      .slice(0, 8);
  }, [searchQ, dataSource]);

  const rows = type === "truong"
    ? [
        { label: "Xếp hạng", key: "ranking" },
        { label: "Điểm chuẩn TB", key: "avgAdmScore" },
        { label: "Mạng xã hội", key: "socialScore" },
        { label: "Đánh giá ND", key: "userRating" },
        { label: "Điểm tổng hợp", key: "overallScore" },
        { label: "Thành phố", key: "city" },
      ]
    : [
        { label: "Nhóm ngành", key: "group" },
        { label: "Khối thi", key: "block" },
        { label: "Điểm 2023", key: "score2023" },
        { label: "Điểm 2024", key: "score2024" },
        { label: "Điểm 2025", key: "score2025" },
      ];

  const getValue = (item: Item, key: string) => {
    if (key === "score2023") return (item as UiMajor).scores?.["2023"] || "—";
    if (key === "score2024") return (item as UiMajor).scores?.["2024"] || "—";
    if (key === "score2025") return (item as UiMajor).scores?.["2025"] || "—";
    return (item as any)[key];
  };

  const getNumericValues = (key: string) =>
    items.map((item) => Number(getValue(item, key)));

  const maxIdx = (arr: number[]) => arr.indexOf(Math.max(...arr));
  const minIdx = (arr: number[]) => arr.indexOf(Math.min(...arr));

  const radarData = type === "truong"
    ? ["Cơ sở vật chất", "Nghiên cứu KH", "Chất lượng đào tạo", "Chất lượng SV", "Điểm đầu ra", "Điểm đầu vào"].map(
        (criteria) => {
          const entry: any = { subject: criteria.slice(0, 12) };
          items.forEach((item, i) => {
            if (isUniversity(item)) {
              const radarScore = item.radarScores?.find((r) => r.criteria === criteria);
              entry[item.abbr || `Item${i + 1}`] = radarScore?.score || 75;
            }
          });
          return entry;
        }
      )
    : [];

  return (
    <div style={dotBg} className="min-h-screen">
      {/* Header */}
      <div
        className="py-10 px-6 text-center"
        style={{
          background: "linear-gradient(135deg, rgba(67,217,163,0.08) 0%, rgba(91,79,207,0.06) 100%)",
          borderBottom: "2px solid rgba(91,79,207,0.08)",
        }}
      >
        <h1 style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, color: "#1A1A2E", fontSize: "clamp(1.8rem,4vw,2.5rem)" }}>
          ⚖️ So Sánh {type === "truong" ? "Trường" : "Ngành"}
        </h1>
        <p style={{ color: "#4A4A6A", marginTop: 6, fontSize: 15 }}>
          So sánh tối đa 5 {type === "truong" ? "trường" : "ngành"} cùng lúc
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Breadcrumb + add button */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-2 text-sm" style={{ color: "#9090AA" }}>
            <Link to="/" style={{ color: "#5B4FCF", fontWeight: 600, textDecoration: "none" }}>Trang chủ</Link>
            <span>/</span>
            <span style={{ color: "#4A4A6A" }}>So sánh</span>
          </div>
          {compareIds.length < 5 && (
            <button
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm"
              style={{
                background: "linear-gradient(135deg, #5B4FCF 0%, #7C6BE8 100%)",
                color: "#fff",
                fontWeight: 700,
                boxShadow: "2px 2px 0px rgba(91,79,207,0.25)",
              }}
              onClick={() => setShowSearch(true)}
            >
              <Plus size={16} />
              Thêm {type === "truong" ? "trường" : "ngành"}
            </button>
          )}
        </div>

        {/* Search modal */}
        {showSearch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
            <div style={{ ...handCard, padding: 24, width: "90%", maxWidth: 480 }}>
              <div className="flex items-center justify-between mb-4">
                <h3 style={{ fontWeight: 800, color: "#1A1A2E" }}>Thêm {type === "truong" ? "trường" : "ngành"}</h3>
                <button onClick={() => setShowSearch(false)} style={{ color: "#9090AA" }}>
                  <X size={20} />
                </button>
              </div>
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl mb-4"
                style={{ border: "2px solid rgba(91,79,207,0.15)" }}
              >
                <Search size={16} color="#9090AA" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Tìm kiếm..."
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  className="flex-1 outline-none text-sm bg-transparent"
                  style={{ color: "#1A1A2E" }}
                />
              </div>
              {loading ? (
                <p style={{ color: "#9090AA", textAlign: "center", fontSize: 13 }}>Đang tải...</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {searchResults.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors"
                      style={{
                        background: compareIds.includes(item.id) ? "rgba(67,217,163,0.1)" : "rgba(91,79,207,0.04)",
                        opacity: compareIds.includes(item.id) ? 0.6 : 1,
                      }}
                      onClick={() => !compareIds.includes(item.id) && addItem(item.id)}
                    >
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1A2E" }}>{item.name}</span>
                      {compareIds.includes(item.id) ? (
                        <span style={{ fontSize: 12, color: "#43D9A3", fontWeight: 700 }}>Đã thêm</span>
                      ) : (
                        <Plus size={16} color="#5B4FCF" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="text-center py-20" style={handCard}>
            <div className="text-5xl mb-4">⚖️</div>
            <p style={{ color: "#4A4A6A", fontWeight: 700, fontSize: 18 }}>Chưa có mục nào để so sánh</p>
            <p style={{ color: "#9090AA", marginTop: 8 }}>Nhấn "Thêm trường" để bắt đầu so sánh</p>
            <button
              className="mt-6 px-6 py-3 rounded-2xl text-sm"
              style={{
                background: "linear-gradient(135deg, #5B4FCF 0%, #7C6BE8 100%)",
                color: "#fff",
                fontWeight: 700,
                boxShadow: "2px 2px 0px rgba(91,79,207,0.25)",
              }}
              onClick={() => setShowSearch(true)}
            >
              Thêm {type === "truong" ? "trường" : "ngành"} +
            </button>
          </div>
        ) : (
          <>
            {/* Comparison columns */}
            <div style={{ ...handCard, overflow: "hidden" }}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "2px solid rgba(91,79,207,0.08)" }}>
                      <th
                        className="p-4 text-left text-sm sticky left-0 bg-white z-10"
                        style={{ color: "#9090AA", fontWeight: 700, minWidth: 130 }}
                      >
                        Tiêu chí
                      </th>
                      {items.map((item, i) => (
                        <th key={item.id} className="p-4 text-center" style={{ minWidth: 180 }}>
                          <div className="relative flex flex-col items-center">
                            <button
                              className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
                              style={{ background: "#FF6B6B", color: "#fff" }}
                              onClick={() => removeItem(item.id)}
                            >
                              <X size={12} />
                            </button>
                            <div
                              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-sm mb-2"
                              style={{
                                background: `linear-gradient(135deg, ${COLORS[i]} 0%, ${COLORS[i]}99 100%)`,
                                fontFamily: "'Baloo 2', cursive",
                                fontWeight: 800,
                                boxShadow: `2px 2px 0px ${COLORS[i]}40`,
                              }}
                            >
                              {isUniversity(item)
                                ? (item.abbr || item.name?.slice(0, 3) || "?").slice(0, 3)
                                : item.name?.slice(0, 3) || "?"}
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#1A1A2E", textAlign: "center" }}>
                              {item.name}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const numericValues = getNumericValues(row.key);
                      const isNumeric = numericValues.every((v) => !isNaN(v) && v !== 0);
                      const maxI = isNumeric ? maxIdx(numericValues) : -1;
                      const minI = isNumeric ? minIdx(numericValues) : -1;

                      return (
                        <tr key={row.key} style={{ borderTop: "1px solid rgba(91,79,207,0.06)" }}>
                          <td
                            className="p-4 sticky left-0 bg-white"
                            style={{ fontSize: 13, color: "#4A4A6A", fontWeight: 700 }}
                          >
                            {row.label}
                          </td>
                          {items.map((item, i) => {
                            const val = getValue(item, row.key);
                            const isMax = isNumeric && i === maxI && numericValues.length > 1;
                            const isMin = isNumeric && i === minI && numericValues.length > 1 && maxI !== minI;

                            return (
                              <td
                                key={item.id}
                                className="p-4 text-center"
                                style={{
                                  background: isMax
                                    ? "rgba(67,217,163,0.1)"
                                    : isMin
                                    ? "rgba(255,107,107,0.06)"
                                    : "transparent",
                                }}
                              >
                                <span
                                  style={{
                                    fontWeight: 800,
                                    color: isMax ? "#16A34A" : isMin ? "#DC2626" : "#1A1A2E",
                                    fontSize: 15,
                                  }}
                                >
                                  {val || "—"}
                                  {isMax && items.length > 1 && (
                                    <TrendingUp size={12} className="inline ml-1" color="#16A34A" />
                                  )}
                                  {isMin && items.length > 1 && (
                                    <TrendingDown size={12} className="inline ml-1" color="#DC2626" />
                                  )}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Radar chart overlay */}
            {type === "truong" && radarData.length > 0 && items.length > 1 && (
              <div style={handCard} className="p-6 mt-8">
                <h2 style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, color: "#1A1A2E", fontSize: "1.2rem", marginBottom: 20 }}>
                  📡 Biểu đồ so sánh tổng hợp
                </h2>
                <ResponsiveContainer width="100%" height={350}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(91,79,207,0.12)" strokeDasharray="4 4" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#4A4A6A", fontWeight: 600 }} />
                    <PolarRadiusAxis domain={[60, 100]} tick={{ fontSize: 9 }} />
                    {items.map((item, i) => {
                      const abbr = isUniversity(item) ? item.abbr : item.name?.slice(0, 10);
                      return (
                        <Radar
                          key={item.id}
                          name={abbr || `Item${i + 1}`}
                          dataKey={abbr || `Item${i + 1}`}
                          stroke={COLORS[i]}
                          fill={COLORS[i]}
                          fillOpacity={0.15}
                          strokeWidth={2}
                          dot={{ r: 4, fill: COLORS[i], strokeWidth: 0 }}
                        />
                      );
                    })}
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: "2px solid rgba(91,79,207,0.15)",
                        fontSize: 13,
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
