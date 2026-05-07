import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Save, ToggleLeft, ToggleRight, X } from "lucide-react";
import { Link } from "react-router";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { getTierColor, getTierThreshold } from "../data/mockData";
import {
  addMyAchievement,
  deleteMyAchievement,
  getAwardsCatalog,
  getMyAchievements,
  getMyCertificates,
  getMyProfile,
  updateMyProfile,
  type ProfileUpdatePayload,
} from "../services/api";
import type { ApiAchievement, ApiAward } from "../types/api";

type SubjectKey = "toan" | "van" | "anh" | "ly" | "hoa" | "sinh" | "su" | "dia";
type SpecialSubject = "toan" | "ly" | "hoa" | "sinh" | "tin" | "ngoai_ngu" | "van" | "su" | "dia";
type SubjectScores = Record<SubjectKey, number>;
type PrizeType = "Khuyen Khich" | "Ba" | "Nhi" | "Nhat";
type SelectedAchievement = {
  clientId: string;
  award_id: number;
  prize: PrizeType;
};

const dotBg = {
  backgroundImage: "radial-gradient(circle, #d0cef0 1px, transparent 1px)",
  backgroundSize: "24px 24px",
  backgroundColor: "#FAFAF8",
};

const handCard = {
  background: "#fff",
  borderRadius: 20,
  border: "2px solid rgba(91,79,207,0.12)",
  boxShadow: "4px 4px 0px rgba(91,79,207,0.09)",
};

const SUBJECTS: Array<{ key: SubjectKey; label: string; icon: string }> = [
  { key: "toan", label: "Toan", icon: "📐" },
  { key: "van", label: "Van", icon: "📖" },
  { key: "anh", label: "Anh", icon: "🌍" },
  { key: "ly", label: "Ly", icon: "⚡" },
  { key: "hoa", label: "Hoa", icon: "🧪" },
  { key: "sinh", label: "Sinh", icon: "🌱" },
  { key: "su", label: "Su", icon: "📜" },
  { key: "dia", label: "Dia", icon: "🗺️" },
];

const SPECIAL_SUBJECTS: Array<{ key: SpecialSubject; label: string }> = [
  { key: "toan", label: "Toan" },
  { key: "ly", label: "Ly" },
  { key: "hoa", label: "Hoa" },
  { key: "sinh", label: "Sinh" },
  { key: "tin", label: "Tin" },
  { key: "ngoai_ngu", label: "Ngoai Ngu" },
  { key: "van", label: "Van" },
  { key: "su", label: "Su" },
  { key: "dia", label: "Dia" },
];

const PRIZE_OPTIONS: Array<{ value: PrizeType; label: string }> = [
  { value: "Khuyen Khich", label: "Khuyen khich" },
  { value: "Ba", label: "Giai Ba" },
  { value: "Nhi", label: "Giai Nhi" },
  { value: "Nhat", label: "Giai Nhat" },
];

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function normalizePrize(prize?: string | null): PrizeType {
  const value = normalizeText(prize || "");
  if (value === "nhat") return "Nhat";
  if (value === "nhi") return "Nhi";
  if (value === "ba") return "Ba";
  return "Khuyen Khich";
}

function getAwardBonus(level?: string | null, prize?: PrizeType): number {
  const normalizedLevel = normalizeText(level || "");
  if (normalizedLevel.includes("quoc te")) {
    if (prize === "Nhat") return 100;
    if (prize === "Nhi") return 80;
    if (prize === "Ba") return 70;
    return 60;
  }
  if (normalizedLevel.includes("quoc gia")) {
    if (prize === "Nhat") return 50;
    if (prize === "Nhi") return 40;
    if (prize === "Ba") return 35;
    return 30;
  }
  if (normalizedLevel.includes("tinh")) {
    if (prize === "Nhat") return 20;
    if (prize === "Nhi") return 15;
    if (prize === "Ba") return 12;
    return 10;
  }
  return 0;
}

function formatSpecialLabel(subject: SpecialSubject): string {
  const item = SPECIAL_SUBJECTS.find((value) => value.key === subject);
  return item ? `Chuyen ${item.label}` : "Mon chuyen";
}

function createClientId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function HoSoPage() {
  const [scores, setScores] = useState<SubjectScores>({
    toan: 0, van: 0, anh: 0, ly: 0, hoa: 0, sinh: 0, su: 0, dia: 0,
  });
  const [isChuyenClass, setIsChuyenClass] = useState(false);
  const [specialSubject, setSpecialSubject] = useState<SpecialSubject>("toan");
  const [specialScore, setSpecialScore] = useState(0);
  const [ieltScore, setIeltScore] = useState(0);
  const [satScore, setSatScore] = useState(0);
  const [awardsCatalog, setAwardsCatalog] = useState<ApiAward[]>([]);
  const [savedAchievements, setSavedAchievements] = useState<ApiAchievement[]>([]);
  const [selectedAchievements, setSelectedAchievements] = useState<SelectedAchievement[]>([]);
  const [showSpecialDropdown, setShowSpecialDropdown] = useState(false);
  const [showAwardsDropdown, setShowAwardsDropdown] = useState(false);
  const [activePrizeDropdownId, setActivePrizeDropdownId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState("Hoc sinh cua toi");

  useEffect(() => {
    const fetchUserProfile = async () => {
      const token = localStorage.getItem("gr1_access_token");
      if (!token) {
        setError("Vui long dang nhap de xem ho so cua ban");
        setLoading(false);
        return;
      }
      try {
        const [profileResponse, awardResponse, achievementResponse, certificateResponse] = await Promise.all([
          getMyProfile(token),
          getAwardsCatalog(token),
          getMyAchievements(token),
          getMyCertificates(token),
        ]);
        const user = profileResponse.user;
        setScores({
          toan: user.math || 0,
          van: user.literature || 0,
          anh: user.english || 0,
          ly: user.physics || 0,
          hoa: user.chemistry || 0,
          sinh: user.biology || 0,
          su: user.history || 0,
          dia: user.geography || 0,
        });
        setIsChuyenClass(Boolean(user.is_special));
        setSpecialSubject((user.special_subject as SpecialSubject) || "toan");
        setSpecialScore(user.special_score || 0);
        setUserName(user.full_name || "Hoc sinh cua toi");
        setAwardsCatalog(awardResponse.results || []);
        setSavedAchievements(achievementResponse.results || []);
        setSelectedAchievements(
          (achievementResponse.results || []).map((item, index) => ({
            clientId: `saved-${item.id}-${index}`,
            award_id: item.award_id,
            prize: normalizePrize(item.prize),
          })),
        );
        const certs = certificateResponse.results || [];
        const ielts = certs.find((item) => item.name.toLowerCase().includes("ielts"))?.score || 0;
        const sat = certs.find((item) => item.name.toLowerCase().includes("sat"))?.score || 0;
        setIeltScore(ielts);
        setSatScore(sat);
        setError(null);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Khong the tai du lieu ho so";
        if (errorMsg.includes("401")) {
          localStorage.removeItem("gr1_access_token");
          localStorage.removeItem("gr1_refresh_token");
          localStorage.removeItem("gr1_user");
          setError("Phien dang nhap da het han. Vui long dang nhap lai");
        } else {
          setError(errorMsg);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, []);

  const selectedAwards = useMemo(() => (
    selectedAchievements
      .map((achievement) => {
        const award = awardsCatalog.find((item) => item.id === achievement.award_id);
        return award ? { clientId: achievement.clientId, prize: achievement.prize, award } : null;
      })
      .filter((item): item is { clientId: string; prize: PrizeType; award: ApiAward } => Boolean(item))
  ), [selectedAchievements, awardsCatalog]);

  const awardBonus = useMemo(
    () => selectedAwards.reduce((sum, item) => sum + getAwardBonus(item.award.level, item.prize), 0),
    [selectedAwards],
  );

  const certBonus = ieltScore * 2 + satScore / 100;
  const baseScore = useMemo(() => Object.values(scores).reduce((a, b) => a + b, 0), [scores]);

  const totalScore = useMemo(() => {
    const specialPart = isChuyenClass ? specialScore : 0;
    return Math.round((baseScore + specialPart + awardBonus + certBonus) * 10) / 10;
  }, [awardBonus, baseScore, certBonus, isChuyenClass, specialScore]);

  const tier = getTierThreshold(totalScore);
  const tierColor = getTierColor(tier);

  const radarData = SUBJECTS.map((subject) => ({
    subject: subject.label,
    score: scores[subject.key] || 0,
    fullMark: 10,
  }));

  const achievementColumns = useMemo(() => {
    const columns: Array<{
      top: { clientId: string; prize: PrizeType; award: ApiAward };
      bottom?: { clientId: string; prize: PrizeType; award: ApiAward };
    }> = [];
    for (let i = 0; i < selectedAwards.length; i += 2) {
      columns.push({ top: selectedAwards[i], bottom: selectedAwards[i + 1] });
    }
    return columns;
  }, [selectedAwards]);

  const blocks = useMemo(() => {
    const sorted = [...SUBJECTS].sort((a, b) => (scores[b.key] || 0) - (scores[a.key] || 0));
    const top3 = sorted.slice(0, 3).map((item) => item.label);
    const recs = [];
    if (top3.includes("Toan") && top3.includes("Ly")) recs.push({ block: "A00", name: "Toan - Ly - Hoa", match: 95 });
    if (top3.includes("Toan") && top3.includes("Anh")) recs.push({ block: "A01", name: "Toan - Ly - Anh", match: 88 });
    if (top3.includes("Van") && top3.includes("Su")) recs.push({ block: "C00", name: "Van - Su - Dia", match: 82 });
    if (top3.includes("Anh")) recs.push({ block: "D01", name: "Toan - Van - Anh", match: 79 });
    if (top3.includes("Sinh") || top3.includes("Hoa")) recs.push({ block: "B00", name: "Toan - Hoa - Sinh", match: 77 });
    return recs.slice(0, 3);
  }, [scores]);

  const addAward = (awardId: number) => {
    setSelectedAchievements((prev) => [
      ...prev,
      { clientId: createClientId(), award_id: awardId, prize: "Khuyen Khich" },
    ]);
  };

  const removeSelectedAward = (clientId: string) => {
    setSelectedAchievements((prev) => prev.filter((item) => item.clientId !== clientId));
  };

  const changeAchievementPrize = (clientId: string, prize: PrizeType) => {
    setSelectedAchievements((prev) => prev.map((item) => (
      item.clientId === clientId ? { ...item, prize } : item
    )));
  };

  const handleSave = async () => {
    const token = localStorage.getItem("gr1_access_token");
    if (!token) {
      setError("Vui long dang nhap de luu ho so");
      return;
    }
    setSaving(true);
    setSaveMessage(null);
    setError(null);
    try {
      const payload: ProfileUpdatePayload = {
        full_name: userName.trim() || "Hoc sinh cua toi",
        math: scores.toan,
        literature: scores.van,
        english: scores.anh,
        physics: scores.ly,
        chemistry: scores.hoa,
        biology: scores.sinh,
        history: scores.su,
        geography: scores.dia,
        is_special: isChuyenClass,
        special_subject: specialSubject,
        special_score: isChuyenClass ? specialScore : 0,
        base_score: baseScore,
      };
      await updateMyProfile(token, payload);

      for (const achievement of savedAchievements) {
        await deleteMyAchievement(token, achievement.id);
      }
      for (const item of selectedAchievements) {
        await addMyAchievement(token, { award_id: item.award_id, prize: item.prize });
      }
      const refreshed = await getMyAchievements(token);
      setSavedAchievements(refreshed.results || []);
      setSelectedAchievements(
        (refreshed.results || []).map((item, index) => ({
          clientId: `saved-${item.id}-${index}`,
          award_id: item.award_id,
          prize: normalizePrize(item.prize),
        })),
      );
      setSaveMessage("Da luu thong tin ho so");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Khong the luu ho so");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={dotBg} className="min-h-screen">
      <div
        className="py-10 px-6 text-center"
        style={{
          background: "linear-gradient(135deg, rgba(91,79,207,0.08) 0%, rgba(255,179,71,0.06) 100%)",
          borderBottom: "2px solid rgba(91,79,207,0.08)",
        }}
      >
        <h1 style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, color: "#1A1A2E", fontSize: "clamp(1.8rem,4vw,2.5rem)" }}>
          Ho So & Tinh Diem Hoc Luc
        </h1>
        <p style={{ color: "#4A4A6A", marginTop: 6 }}>Nhap diem de tinh tong diem hoc luc va xep tier cua ban</p>
      </div>

      {loading && (
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <p style={{ color: "#4A4A6A", fontWeight: 700 }}>Dang tai du lieu ho so...</p>
        </div>
      )}

      {!loading && (
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div style={handCard} className="p-6">
                <div className="flex items-center gap-4 mb-3">
                  <div
                    className="w-16 h-16 rounded-[20px] flex items-center justify-center text-white flex-shrink-0"
                    style={{
                      background: "linear-gradient(135deg, #5B4FCF 0%, #FF6B6B 100%)",
                      boxShadow: "4px 4px 0px rgba(91,79,207,0.2)",
                    }}
                  >
                    HS
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        className="outline-none bg-transparent w-full"
                        style={{ fontWeight: 800, color: "#1A1A2E", fontSize: 18, border: "none", borderBottom: "2px dashed rgba(91,79,207,0.2)" }}
                      />
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: "#5B4FCF", color: "#fff", fontWeight: 700, opacity: saving ? 0.7 : 1 }}
                        title={saving ? "Dang luu" : "Luu thong tin"}
                      >
                        <Save size={14} />
                      </button>
                    </div>
                    <p style={{ color: "#9090AA", fontSize: 13, marginTop: 4 }}>Nhan de doi ten</p>
                  </div>
                </div>
                {saveMessage && <p style={{ color: "#166534", fontSize: 13, fontWeight: 700 }}>{saveMessage}</p>}
                {error && <p style={{ color: "#B91C1C", fontSize: 13, fontWeight: 700 }}>{error}</p>}

                <div
                  className="flex items-center justify-between p-4 rounded-2xl mt-4"
                  style={{ background: "rgba(91,79,207,0.05)", border: "2px dashed rgba(91,79,207,0.15)" }}
                >
                  <div>
                    <p style={{ fontWeight: 700, color: "#1A1A2E", fontSize: 14 }}>Truong chuyen?</p>
                    <p style={{ fontSize: 12, color: "#9090AA" }}>Dung mon chuyen va diem TB mon chuyen rieng</p>
                  </div>
                  <button onClick={() => setIsChuyenClass(!isChuyenClass)}>
                    {isChuyenClass ? <ToggleRight size={36} color="#5B4FCF" /> : <ToggleLeft size={36} color="#9090AA" />}
                  </button>
                </div>

                {isChuyenClass && (
                  <div className="mt-4 space-y-3">
                    <div style={{ position: "relative" }}>
                      <button
                        className="w-full px-3 py-2 rounded-xl flex items-center justify-between"
                        style={{ border: "2px solid rgba(91,79,207,0.2)", color: "#1A1A2E", fontWeight: 700, background: "#fff" }}
                        onClick={() => setShowSpecialDropdown((value) => !value)}
                      >
                        <span>{formatSpecialLabel(specialSubject)}</span>
                        <ChevronDown size={16} />
                      </button>
                      {showSpecialDropdown && (
                        <div
                          className="p-2 rounded-xl"
                          style={{
                            position: "absolute",
                            top: "calc(100% + 8px)",
                            left: 0,
                            right: 0,
                            zIndex: 20,
                            border: "2px solid rgba(91,79,207,0.15)",
                            background: "#fff",
                            boxShadow: "0 12px 30px rgba(26,26,46,0.12)",
                          }}
                        >
                          <div className="grid grid-cols-2 gap-2">
                            {SPECIAL_SUBJECTS.map((item) => (
                              <button
                                key={item.key}
                                className="px-2 py-1.5 rounded-lg text-sm text-left"
                                style={{
                                  background: item.key === specialSubject ? "rgba(91,79,207,0.12)" : "transparent",
                                  color: "#1A1A2E",
                                  fontWeight: item.key === specialSubject ? 800 : 600,
                                }}
                                onClick={() => {
                                  setSpecialSubject(item.key);
                                  setShowSpecialDropdown(false);
                                }}
                              >
                                Chuyen {item.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <label style={{ fontSize: 13, color: "#4A4A6A", fontWeight: 700 }}>Diem TB mon chuyen</label>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        step={0.1}
                        value={specialScore}
                        onChange={(e) => setSpecialScore(Math.min(10, Math.max(0, Number(e.target.value))))}
                        className="mt-1 w-full px-3 py-2 rounded-xl text-sm outline-none"
                        style={{ border: "2px solid rgba(91,79,207,0.2)", color: "#1A1A2E", fontWeight: 700 }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div style={handCard} className="p-6">
                <h3 style={{ fontWeight: 800, color: "#1A1A2E", fontSize: 16, marginBottom: 16 }}>
                  Diem TB 8 mon (0-10)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {SUBJECTS.map((subject) => (
                    <div key={subject.key}>
                      <label className="flex items-center gap-2 mb-1.5" style={{ fontSize: 13, color: "#4A4A6A", fontWeight: 700 }}>
                        {subject.icon} {subject.label}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        step={0.1}
                        value={scores[subject.key]}
                        onChange={(e) => setScores((prev) => ({ ...prev, [subject.key]: Math.min(10, Math.max(0, Number(e.target.value))) }))}
                        className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                        style={{ border: "2px solid rgba(91,79,207,0.2)", color: "#1A1A2E", fontWeight: 700, background: "#fff" }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div style={handCard} className="p-6">
                <h3 style={{ fontWeight: 800, color: "#1A1A2E", fontSize: 16, marginBottom: 12 }}>Thanh tich</h3>
                <div style={{ position: "relative" }}>
                  <button
                    className="w-full px-3 py-2 rounded-xl flex items-center justify-between"
                    style={{ border: "2px solid rgba(91,79,207,0.2)", color: "#1A1A2E", fontWeight: 700, background: "#fff" }}
                    onClick={() => setShowAwardsDropdown((value) => !value)}
                  >
                    <span>Chon thanh tich hop le</span>
                    <ChevronDown size={16} />
                  </button>
                  {showAwardsDropdown && (
                    <div
                      className="p-2 rounded-xl max-h-72 overflow-y-auto hide-scrollbar"
                      style={{
                        position: "absolute",
                        top: "calc(100% + 8px)",
                        left: 0,
                        right: 0,
                        zIndex: 30,
                        border: "2px solid rgba(91,79,207,0.15)",
                        background: "#fff",
                        boxShadow: "0 14px 35px rgba(26,26,46,0.16)",
                      }}
                    >
                      <div className="space-y-1">
                        {awardsCatalog.map((award) => (
                          <button
                            key={award.id}
                            className="w-full px-3 py-2 rounded-lg text-left"
                            style={{ background: "transparent", color: "#1A1A2E", fontWeight: 700 }}
                            onClick={() => addAward(award.id)}
                          >
                            {award.name} ({award.level})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <div className="flex flex-wrap gap-3">
                    {achievementColumns.map((column, index) => (
                      <div key={`${column.top.clientId}-${index}`} className="w-56 space-y-2">
                        {[column.top, column.bottom].filter(Boolean).map((item) => (
                          <div
                            key={item!.clientId}
                            className="px-3 py-2 rounded-xl"
                            style={{ background: "rgba(255,179,71,0.15)", border: "1px solid rgba(255,179,71,0.35)", position: "relative" }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span style={{ color: "#92400E", fontSize: 13, fontWeight: 700 }}>
                                {item!.award.name}
                              </span>
                              <button onClick={() => removeSelectedAward(item!.clientId)} style={{ color: "#92400E" }}>
                                <X size={14} />
                              </button>
                            </div>
                            <p style={{ color: "#B45309", fontSize: 11, marginTop: 4 }}>{item!.award.level}</p>
                            <div className="mt-2" style={{ position: "relative" }}>
                              <button
                                type="button"
                                onClick={() => setActivePrizeDropdownId((prev) => prev === item!.clientId ? null : item!.clientId)}
                                className="w-full px-3 py-2 rounded-lg text-xs flex items-center justify-between"
                                style={{
                                  border: "1px solid rgba(146,64,14,0.25)",
                                  color: "#92400E",
                                  background: "linear-gradient(180deg, #fffaf2 0%, #fff 100%)",
                                  fontWeight: 700,
                                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75)",
                                }}
                              >
                                <span>{PRIZE_OPTIONS.find((option) => option.value === item!.prize)?.label ?? "Chon giai"}</span>
                                <ChevronDown size={14} />
                              </button>
                              {activePrizeDropdownId === item!.clientId && (
                                <div
                                  className="rounded-xl p-1"
                                  style={{
                                    position: "absolute",
                                    top: "calc(100% + 6px)",
                                    left: 0,
                                    right: 0,
                                    zIndex: 40,
                                    background: "#fffdf8",
                                    border: "1px solid rgba(146,64,14,0.2)",
                                    boxShadow: "0 10px 24px rgba(146,64,14,0.14)",
                                  }}
                                >
                                  {PRIZE_OPTIONS.map((option) => (
                                    <button
                                      key={option.value}
                                      type="button"
                                      onClick={() => {
                                        changeAchievementPrize(item!.clientId, option.value);
                                        setActivePrizeDropdownId(null);
                                      }}
                                      className="w-full px-3 py-2 rounded-lg text-left text-xs"
                                      style={{
                                        color: option.value === item!.prize ? "#7C2D12" : "#92400E",
                                        background: option.value === item!.prize ? "rgba(251,191,36,0.18)" : "transparent",
                                        fontWeight: option.value === item!.prize ? 800 : 600,
                                      }}
                                    >
                                      {option.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <p style={{ color: "#92400E", fontSize: 11, fontWeight: 700, marginTop: 6 }}>
                              +{getAwardBonus(item!.award.level, item!.prize)} diem
                            </p>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={handCard} className="p-6">
                <h3 style={{ fontWeight: 800, color: "#1A1A2E", fontSize: 16, marginBottom: 16 }}>
                  Chung chi quoc te
                </h3>
                <div className="space-y-4">
                  <div>
                    <label style={{ fontSize: 13, color: "#4A4A6A", fontWeight: 700 }}>IELTS (x2): +{(ieltScore * 2).toFixed(1)}</label>
                    <input
                      type="number"
                      min={0}
                      max={9}
                      step={0.5}
                      value={ieltScore}
                      onChange={(e) => setIeltScore(Math.min(9, Math.max(0, Number(e.target.value))))}
                      className="mt-2 w-full px-3 py-2 rounded-xl text-sm outline-none"
                      style={{ border: "2px solid rgba(91,79,207,0.2)", color: "#1A1A2E", fontWeight: 700 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, color: "#4A4A6A", fontWeight: 700 }}>SAT (/100): +{(satScore / 100).toFixed(2)}</label>
                    <input
                      type="number"
                      min={0}
                      max={1600}
                      step={10}
                      value={satScore}
                      onChange={(e) => setSatScore(Math.min(1600, Math.max(0, Number(e.target.value))))}
                      className="mt-2 w-full px-3 py-2 rounded-xl text-sm outline-none"
                      style={{ border: "2px solid rgba(91,79,207,0.2)", color: "#1A1A2E", fontWeight: 700 }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div
                className="p-8 text-center"
                style={{ ...handCard, border: `2.5px solid ${tierColor}40`, boxShadow: `6px 6px 0px ${tierColor}25` }}
              >
                <p style={{ color: "#9090AA", fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Tong diem hoc luc</p>
                <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 900, fontSize: 72, color: tierColor, lineHeight: 1 }}>
                  {totalScore}
                </div>
                <div className="flex items-center justify-center mt-4">
                  <span
                    className="px-6 py-2 rounded-2xl text-xl"
                    style={{ fontWeight: 900, fontFamily: "'Baloo 2', cursive", fontSize: 24, background: `${tierColor}20`, color: tierColor }}
                  >
                    Tier {tier}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-3 mt-6">
                  {[
                    { label: "Diem co so", value: baseScore.toFixed(1) },
                    { label: "Mon chuyen", value: `+${(isChuyenClass ? specialScore : 0).toFixed(1)}` },
                    { label: "Thanh tich", value: `+${awardBonus.toFixed(0)}` },
                    { label: "Chung chi", value: `+${certBonus.toFixed(1)}` },
                  ].map((item) => (
                    <div key={item.label} className="p-3 rounded-2xl text-center" style={{ background: "rgba(91,79,207,0.05)" }}>
                      <p style={{ fontSize: 10, color: "#9090AA", fontWeight: 700 }}>{item.label}</p>
                      <p style={{ fontWeight: 900, color: "#5B4FCF", fontSize: 16 }}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div style={handCard} className="p-5">
                <h3 style={{ fontWeight: 800, color: "#1A1A2E", fontSize: 14, marginBottom: 12 }}>Bang Tier</h3>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { tier: "F", label: "< 45", color: "#3F3F46" },
                    { tier: "E", label: ">= 45", color: "#F97316" },
                    { tier: "D", label: ">= 60", color: "#EAB308" },
                    { tier: "C", label: ">= 75", color: "#4CAF50" },
                    { tier: "B", label: ">= 90", color: "#2196F3" },
                    { tier: "A", label: ">= 100", color: "#9C27B0" },
                    { tier: "S", label: ">= 150", color: "#E11D48" },
                  ].map((item) => (
                    <div
                      key={item.tier}
                      className="p-2 rounded-xl text-center"
                      style={{ background: tier === item.tier ? `${item.color}20` : "rgba(91,79,207,0.04)", border: `2px solid ${tier === item.tier ? item.color : "transparent"}` }}
                    >
                      <p style={{ fontWeight: 900, color: item.color, fontSize: 14 }}>{item.tier}</p>
                      <p style={{ fontSize: 10, color: "#9090AA" }}>{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div style={handCard} className="p-6">
                <h3 style={{ fontWeight: 800, color: "#1A1A2E", fontSize: 15, marginBottom: 16 }}>Stats Graph</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(91,79,207,0.12)" strokeDasharray="3 3" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#4A4A6A", fontWeight: 700 }} />
                    <PolarRadiusAxis domain={[5, 10]} tick={{ fontSize: 9 }} />
                    <Radar
                      name="Diem"
                      dataKey="score"
                      stroke="#5B4FCF"
                      fill="#5B4FCF"
                      fillOpacity={0.2}
                      strokeWidth={2.5}
                      dot={{ r: 5, fill: "#5B4FCF", strokeWidth: 0 }}
                    />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "2px solid rgba(91,79,207,0.15)", fontSize: 13 }} formatter={(value: number) => [`${value}/10`, "Diem"]} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {blocks.length > 0 && (
                <div style={handCard} className="p-6">
                  <h3 style={{ fontWeight: 800, color: "#1A1A2E", fontSize: 15, marginBottom: 16 }}>Khoi hoc phu hop</h3>
                  <div className="space-y-3">
                    {blocks.map((block, index) => (
                      <Link
                        key={block.block}
                        to={`/nganh?block=${block.block}`}
                        className="flex items-center justify-between p-4 rounded-2xl"
                        style={{
                          background: index === 0 ? "rgba(91,79,207,0.08)" : "rgba(91,79,207,0.04)",
                          border: `2px solid ${index === 0 ? "rgba(91,79,207,0.2)" : "rgba(91,79,207,0.08)"}`,
                          textDecoration: "none",
                        }}
                      >
                        <div>
                          <span className="px-2.5 py-1 rounded-xl text-sm mr-3" style={{ background: "#5B4FCF", color: "#fff", fontWeight: 800 }}>
                            {block.block}
                          </span>
                          <span style={{ fontWeight: 700, color: "#1A1A2E", fontSize: 14 }}>{block.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="px-2.5 py-1 rounded-xl text-sm" style={{ background: "rgba(67,217,163,0.15)", color: "#16A34A", fontWeight: 800 }}>
                            {block.match}%
                          </div>
                          <ChevronRight size={14} color="#9090AA" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
