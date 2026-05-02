import { useEffect, useMemo, useState } from 'react';
import { getBootstrapData, listUniversities } from './api/mockBackend';
import type {
  AdmissionScore,
  Field,
  MajorCatalog,
  Province,
  University,
  UniversityProgram
} from './types';

type TabId = 'home' | 'universities' | 'majors' | 'rankings' | 'compare';

interface BootstrapState {
  provinces: Province[];
  universities: University[];
  fields: Field[];
  majors: MajorCatalog[];
  programs: UniversityProgram[];
  scores: AdmissionScore[];
}

interface RankItem {
  university: University;
  score2025: number;
  trend: number;
  majorCount: number;
}

interface ProgramCard {
  program: UniversityProgram;
  major: MajorCatalog;
  university: University;
  score2023: number | undefined;
  score2024: number | undefined;
  score2025: number | undefined;
}

const tabs: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'home', label: 'Home', icon: '📖' },
  { id: 'universities', label: 'Universities', icon: '🏛️' },
  { id: 'majors', label: 'Majors', icon: '📚' },
  { id: 'rankings', label: 'Rankings', icon: '🏆' },
  { id: 'compare', label: 'Compare', icon: '⚖️' }
];

function getScoreByYear(scores: AdmissionScore[], year: number): number | undefined {
  const list = scores.filter((item) => item.year === year).map((item) => item.score);
  if (list.length === 0) return undefined;
  return list.reduce((sum, value) => sum + value, 0) / list.length;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BootstrapState | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | University['type']>('all');
  const [provinceFilter, setProvinceFilter] = useState<number | 'all'>('all');
  const [fieldFilter, setFieldFilter] = useState<number | 'all'>('all');
  const [compareIds, setCompareIds] = useState<string[]>([]);

  useEffect(() => {
    async function bootstrap() {
      try {
        setLoading(true);
        const payload = await getBootstrapData();
        setData({
          provinces: payload.provinces,
          universities: payload.universities,
          fields: payload.fields,
          majors: payload.majors,
          programs: payload.programs,
          scores: payload.scores
        });
        setError(null);
      } catch (err) {
        setError('Không thể tải mock data.');
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, []);

  const rankTable = useMemo<RankItem[]>(() => {
    if (!data) return [];
    return data.universities
      .filter((u) => u.is_active)
      .map((university) => {
        const uniPrograms = data.programs.filter((p) => p.university === university.id);
        const uniProgramIds = new Set(uniPrograms.map((item) => item.id));
        const uniScores = data.scores.filter((s) => uniProgramIds.has(s.university_program));
        const score2025 = getScoreByYear(uniScores, 2025) ?? 0;
        const score2024 = getScoreByYear(uniScores, 2024) ?? 0;
        const majorCount = new Set(uniPrograms.map((item) => item.major_catalog)).size;
        return {
          university,
          score2025,
          trend: score2025 - score2024,
          majorCount
        };
      })
      .sort((a, b) => b.score2025 - a.score2025);
  }, [data]);

  const programCards = useMemo<ProgramCard[]>(() => {
    if (!data) return [];
    return data.programs
      .map((program) => {
        const major = data.majors.find((item) => item.id === program.major_catalog);
        const university = data.universities.find((item) => item.id === program.university);
        if (!major || !university) return null;
        const related = data.scores.filter((item) => item.university_program === program.id);
        return {
          program,
          major,
          university,
          score2023: getScoreByYear(related, 2023),
          score2024: getScoreByYear(related, 2024),
          score2025: getScoreByYear(related, 2025)
        };
      })
      .filter((item): item is ProgramCard => item !== null);
  }, [data]);

  const filteredPrograms = useMemo(() => {
    return programCards
      .filter((item) => {
        if (fieldFilter !== 'all' && item.major.field !== fieldFilter) return false;
        const query = search.trim().toLowerCase();
        if (!query) return true;
        return (
          item.major.name.toLowerCase().includes(query) ||
          item.major.code.toLowerCase().includes(query) ||
          item.university.name.toLowerCase().includes(query) ||
          (item.program.internal_code ?? '').toLowerCase().includes(query)
        );
      })
      .sort((a, b) => (b.score2025 ?? 0) - (a.score2025 ?? 0));
  }, [programCards, fieldFilter, search]);

  useEffect(() => {
    if (activeTab !== 'compare') return;
    setCompareIds((prev) => prev.filter((id) => programCards.some((item) => item.program.id === id)));
  }, [activeTab, programCards]);

  if (loading) {
    return (
      <div className="initial-load">
        <div className="load-ring" />
        <span>Đang chuẩn bị dữ liệu tuyển sinh...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="initial-load">
        <span>{error ?? 'Không có dữ liệu'}</span>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="journal">
        <header className="hero">
          <div className="hero-title-wrap">
            <h1>BUNIK</h1>
            <p>Cổng thông tin tra cứu tuyển sinh các trường đại học khu vực Hà Nội</p>
          </div>
          <div className="hero-meta">
            <span>{data.universities.length} trường</span>
            <span>{data.majors.length} ngành</span>
            <span>{data.scores.length} bản ghi điểm</span>
          </div>
        </header>

        <nav className="tab-nav" aria-label="Main tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        <main className="content">
          {activeTab === 'home' && (
            <section className="section">
              <h2>Tổng quan hệ thống</h2>
              <div className="stats-grid">
                <article>
                  <strong>{rankTable[0]?.university.short_name ?? '-'}</strong>
                  <span>Top trường theo điểm 2025</span>
                </article>
                <article>
                  <strong>{rankTable[0]?.score2025.toFixed(2) ?? '-'}</strong>
                  <span>Điểm trung bình cao nhất</span>
                </article>
                <article>
                  <strong>{data.provinces.filter((p) => p.region === 'Bắc').length}</strong>
                  <span>Số tỉnh phía Bắc trong mock</span>
                </article>
              </div>
              <div className="panel">
                <h3>Top 5 trường theo điểm 2025</h3>
                <ol className="rank-list">
                  {rankTable.slice(0, 5).map((row) => (
                    <li key={row.university.id}>
                      <span>
                        {row.university.name} ({row.university.short_name})
                      </span>
                      <strong>{row.score2025.toFixed(2)}</strong>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          )}

          {activeTab === 'universities' && (
            <UniversityTab
              provinces={data.provinces}
              search={search}
              setSearch={setSearch}
              typeFilter={typeFilter}
              setTypeFilter={setTypeFilter}
              provinceFilter={provinceFilter}
              setProvinceFilter={setProvinceFilter}
            />
          )}

          {activeTab === 'majors' && (
            <section className="section">
              <h2>Tra cứu ngành / chương trình</h2>
              <div className="filters">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm ngành, mã ngành hoặc trường..."
                />
                <select
                  value={fieldFilter}
                  onChange={(event) =>
                    setFieldFilter(event.target.value === 'all' ? 'all' : Number(event.target.value))
                  }
                >
                  <option value="all">Tất cả lĩnh vực</option>
                  {data.fields.map((field) => (
                    <option key={field.id} value={field.id}>
                      {field.code} - {field.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Ngành</th>
                      <th>Trường</th>
                      <th>2023</th>
                      <th>2024</th>
                      <th>2025</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPrograms.map((item) => (
                      <tr key={item.program.id}>
                        <td>
                          <div className="cell-main">{item.major.name}</div>
                          <div className="cell-sub">{item.major.code}</div>
                        </td>
                        <td>{item.university.short_name}</td>
                        <td>{item.score2023?.toFixed(2) ?? '-'}</td>
                        <td>{item.score2024?.toFixed(2) ?? '-'}</td>
                        <td className="emphasis">{item.score2025?.toFixed(2) ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === 'rankings' && (
            <section className="section">
              <h2>Bảng xếp hạng trường (mock)</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Hạng</th>
                      <th>Trường</th>
                      <th>Điểm TB 2025</th>
                      <th>Xu hướng</th>
                      <th>Số ngành</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankTable.map((row, index) => (
                      <tr key={row.university.id}>
                        <td>{index + 1}</td>
                        <td>
                          <div className="cell-main">{row.university.name}</div>
                          <div className="cell-sub">{row.university.short_name}</div>
                        </td>
                        <td className="emphasis">{row.score2025.toFixed(2)}</td>
                        <td className={row.trend >= 0 ? 'up' : 'down'}>
                          {row.trend >= 0 ? '+' : ''}
                          {row.trend.toFixed(2)}
                        </td>
                        <td>{row.majorCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === 'compare' && (
            <section className="section">
              <h2>So sánh chương trình</h2>
              <p className="hint">Chọn tối đa 4 chương trình để so sánh điểm qua các năm.</p>
              <div className="compare-grid">
                {programCards.map((item) => {
                  const selected = compareIds.includes(item.program.id);
                  const disabled = !selected && compareIds.length >= 4;
                  return (
                    <button
                      key={item.program.id}
                      className={`compare-chip ${selected ? 'selected' : ''}`}
                      disabled={disabled}
                      onClick={() =>
                        setCompareIds((prev) =>
                          selected
                            ? prev.filter((value) => value !== item.program.id)
                            : [...prev, item.program.id]
                        )
                      }
                    >
                      <span>{item.major.name}</span>
                      <small>{item.university.short_name}</small>
                    </button>
                  );
                })}
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Chương trình</th>
                      <th>2023</th>
                      <th>2024</th>
                      <th>2025</th>
                    </tr>
                  </thead>
                  <tbody>
                    {programCards
                      .filter((item) => compareIds.includes(item.program.id))
                      .map((item) => (
                        <tr key={item.program.id}>
                          <td>
                            <div className="cell-main">{item.major.name}</div>
                            <div className="cell-sub">{item.university.short_name}</div>
                          </td>
                          <td>{item.score2023?.toFixed(2) ?? '-'}</td>
                          <td>{item.score2024?.toFixed(2) ?? '-'}</td>
                          <td className="emphasis">{item.score2025?.toFixed(2) ?? '-'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function UniversityTab(props: {
  provinces: Province[];
  search: string;
  setSearch: (value: string) => void;
  typeFilter: 'all' | University['type'];
  setTypeFilter: (value: 'all' | University['type']) => void;
  provinceFilter: number | 'all';
  setProvinceFilter: (value: number | 'all') => void;
}) {
  const { provinces, search, setSearch, typeFilter, setTypeFilter, provinceFilter, setProvinceFilter } = props;
  const [results, setResults] = useState<University[]>([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      const response = await listUniversities({
        search,
        type: typeFilter === 'all' ? undefined : typeFilter,
        province: provinceFilter === 'all' ? undefined : provinceFilter,
        page: 1,
        pageSize: 50
      });
      if (!isMounted) return;
      setResults(response.results);
      setCount(response.count);
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [search, typeFilter, provinceFilter]);

  const provinceMap = useMemo(() => new Map(provinces.map((item) => [item.id, item])), [provinces]);

  return (
    <section className="section">
      <h2>Tra cứu trường đại học</h2>
      <div className="filters">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên trường..." />
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}>
          <option value="all">Tất cả loại trường</option>
          <option value="công_lập">Công lập</option>
          <option value="dân_lập">Dân lập</option>
          <option value="quân_sự">Quân sự</option>
        </select>
        <select
          value={provinceFilter}
          onChange={(event) =>
            setProvinceFilter(event.target.value === 'all' ? 'all' : Number(event.target.value))
          }
        >
          <option value="all">Tất cả tỉnh/thành</option>
          {provinces.map((province) => (
            <option key={province.id} value={province.id}>
              {province.name}
            </option>
          ))}
        </select>
      </div>
      <p className="hint">Kết quả: {count} trường</p>
      <div className="cards">
        {results.map((item) => (
          <article key={item.id} className="university-card">
            <div className="card-head">
              <h3>{item.short_name}</h3>
              <span>{item.type}</span>
            </div>
            <p>{item.name}</p>
            <div className="card-foot">
              <span>{provinceMap.get(item.province)?.name}</span>
              <span>{provinceMap.get(item.province)?.region}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
