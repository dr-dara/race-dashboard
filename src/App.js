import React, { useState, useMemo, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, AreaChart, Area, Cell
} from 'recharts';
import { TrendingUp, Users, Timer, Trophy, Rocket, Activity } from 'lucide-react';
import Papa from 'papaparse';
import './App.css';

const colors = ['#0d9488', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#10b981', '#f97316', '#6366f1', '#14b8a6'];
const MILE_TO_KM = 1.60934;

const timeToTotalSeconds = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return NaN;
  const parts = timeStr.split(':').map(Number);
  if (parts.some(isNaN)) return NaN;
  let seconds = 0;
  if (parts.length === 3) { seconds = parts[0] * 3600 + parts[1] * 60 + parts[2]; }
  else if (parts.length === 2) { seconds = parts[0] * 60 + parts[1]; }
  else { return NaN; }
  return seconds;
};

const secondsToPace = (totalSecondsPerMile, unit = 'mile') => {
  if (isNaN(totalSecondsPerMile) || totalSecondsPerMile === null) return 'N/A';
  let convertedSeconds = totalSecondsPerMile;
  if (unit === 'km') {
    convertedSeconds /= MILE_TO_KM;
  }
  const minutes = Math.floor(Math.abs(convertedSeconds) / 60);
  const seconds = Math.round(Math.abs(convertedSeconds) % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const processData = (data) => {
  return data
    .filter(row => row.runner && row.year && row.time && row.event)
    .map(row => {
      const totalSeconds = timeToTotalSeconds(String(row.time).trim());
      const distance = parseFloat(row.event);
      if (isNaN(totalSeconds) || isNaN(distance) || distance === 0) {
        return { ...row, paceInSeconds: NaN };
      }
      const paceInSecondsPerMile = totalSeconds / distance;
      return {
        runner: String(row.runner).trim(),
        year: parseInt(row.year),
        paceInSeconds: paceInSecondsPerMile,
        event: String(row.event).trim()
      };
    })
    .filter(row => !isNaN(row.year) && !isNaN(row.paceInSeconds));
};

function App() {
  const [raceData, setRaceData] = useState([]);
  const [selectedRunners, setSelectedRunners] = useState(new Set());
  const [selectedYear, setSelectedYear] = useState('all');
  const [viewMode, setViewMode] = useState('trends');
  const [paceUnit, setPaceUnit] = useState('mile');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const csvFilePath = `${process.env.PUBLIC_URL}/race_data.csv`;
    Papa.parse(csvFilePath, {
      download: true, header: true, skipEmptyLines: true,
      complete: (results) => {
        try {
          const cleanedData = processData(results.data);
          if (cleanedData.length === 0) {
            setError('No valid data found. Check race_data.csv for runner, year, time, and event columns.');
            setIsLoading(false);
            return;
          }
          setRaceData(cleanedData);
          setIsLoading(false);
        } catch (err) {
          setError('Error processing CSV file: ' + err.message);
          setIsLoading(false);
        }
      },
      error: (err) => {
        setError(`Could not load race_data.csv. Ensure it's in the 'public' folder. Error: ${err.message}`);
        setIsLoading(false);
      }
    });
  }, []);

  const runners = useMemo(() => [...new Set(raceData.map(d => d.runner))], [raceData]);
  const years = useMemo(() => [...new Set(raceData.map(d => d.year))].sort(), [raceData]);

  const runnerColorMap = useMemo(() => {
    const map = {};
    runners.forEach((r, i) => { map[r] = colors[i % colors.length]; });
    return map;
  }, [runners]);

  const summaryStats = useMemo(() => {
    if (raceData.length === 0) return null;
    const fastest = raceData.reduce((best, d) => d.paceInSeconds < best.paceInSeconds ? d : best, raceData[0]);
    const latestYear = years[years.length - 1];
    const latestCount = raceData.filter(d => d.year === latestYear).length;
    return {
      runnerCount: runners.length,
      yearSpan: years.length > 1 ? `${years[0]}–${years[years.length - 1]}` : String(years[0]),
      recordCount: raceData.length,
      fastestRunner: fastest.runner,
      fastestPace: fastest.paceInSeconds,
      latestYear,
      latestCount
    };
  }, [raceData, runners, years]);

  const trendData = useMemo(() => {
    const yearlyData = {};
    raceData.forEach(record => {
      if (!yearlyData[record.year]) { yearlyData[record.year] = { year: record.year }; }
      yearlyData[record.year][record.runner] = record.paceInSeconds;
    });
    return Object.values(yearlyData).sort((a, b) => a.year - b.year);
  }, [raceData]);

  const yAxisDomain = useMemo(() => {
    if (isLoading || raceData.length === 0) return ['auto', 'auto'];
    const dataToConsider = selectedRunners.size > 0 ? raceData.filter(d => selectedRunners.has(d.runner)) : raceData;
    if (dataToConsider.length === 0) return ['auto', 'auto'];
    const allPaces = dataToConsider.map(d => d.paceInSeconds);
    const minPace = Math.min(...allPaces);
    const maxPace = Math.max(...allPaces);
    const padding = (maxPace - minPace) * 0.05;
    return [Math.max(0, minPace - padding), maxPace + padding];
  }, [raceData, selectedRunners, isLoading]);

  const comparisonData = useMemo(() => {
    if (selectedYear === 'all') return [];
    return raceData
      .filter(d => d.year === parseInt(selectedYear))
      .sort((a, b) => a.paceInSeconds - b.paceInSeconds)
      .map(d => ({
        runner: d.runner.split(' ')[0],
        paceInSeconds: d.paceInSeconds,
        fullName: d.runner
      }));
  }, [selectedYear, raceData]);

  const paceDistributionData = useMemo(() => {
    return years.map(year => {
      const pacesInYear = raceData.filter(d => d.year === year).map(d => d.paceInSeconds).sort((a, b) => a - b);
      if (pacesInYear.length === 0) return null;
      const minPace = pacesInYear[0];
      const maxPace = pacesInYear[pacesInYear.length - 1];
      const midIndex = Math.floor(pacesInYear.length / 2);
      const medianPace = pacesInYear.length % 2 === 0
        ? (pacesInYear[midIndex - 1] + pacesInYear[midIndex]) / 2
        : pacesInYear[midIndex];
      return { year, minPace, medianPace, maxPace };
    }).filter(Boolean);
  }, [raceData, years]);

  const bumpChartData = useMemo(() => {
    const yearlyRanks = {};
    years.forEach(year => {
      const yearlyData = raceData.filter(d => d.year === year).sort((a, b) => a.paceInSeconds - b.paceInSeconds);
      yearlyRanks[year] = { year };
      yearlyData.forEach((d, index) => { yearlyRanks[year][d.runner] = index + 1; });
    });
    return Object.values(yearlyRanks);
  }, [raceData, years]);

  const yearOverYearImprovers = useMemo(() => {
    if (years.length < 2) return [];
    const latestYear = years[years.length - 1];
    const previousYear = years[years.length - 2];
    return runners.map(runner => {
      const latestData = raceData.find(d => d.runner === runner && d.year === latestYear);
      const previousData = raceData.find(d => d.runner === runner && d.year === previousYear);
      if (!latestData || !previousData) return null;
      const improvement = previousData.paceInSeconds - latestData.paceInSeconds;
      const improvementPercent = ((improvement / previousData.paceInSeconds) * 100).toFixed(1);
      return { runner, improvement, improvementPercent, latestPace: latestData.paceInSeconds, previousPace: previousData.paceInSeconds, isImprovement: improvement > 0 };
    })
      .filter(Boolean)
      .filter(stat => stat.isImprovement)
      .sort((a, b) => b.improvement - a.improvement);
  }, [raceData, years, runners]);

  const overallImprovers = useMemo(() => {
    return runners.map(runner => {
      const runnerData = raceData.filter(d => d.runner === runner).sort((a, b) => a.year - b.year);
      if (runnerData.length < 2) return null;
      const firstPace = runnerData[0].paceInSeconds;
      const lastPace = runnerData[runnerData.length - 1].paceInSeconds;
      const improvement = firstPace - lastPace;
      const improvementPercent = ((improvement / firstPace) * 100).toFixed(1);
      return { runner, improvement, improvementPercent, firstPace, lastPace, isImprovement: improvement > 0 };
    })
      .filter(Boolean)
      .filter(stat => stat.isImprovement)
      .sort((a, b) => b.improvement - a.improvement);
  }, [runners, raceData]);

  const handleRunnerToggle = (runner) => {
    const newSelected = new Set(selectedRunners);
    if (newSelected.has(runner)) newSelected.delete(runner);
    else newSelected.add(runner);
    setSelectedRunners(newSelected);
  };

  const paceLabel = `min/${paceUnit}`;

  return (
    <div className="app">
      <div className="container">
        <header className="hero">
          <h1>Derravaragh &amp; Group G Race Dashboard</h1>
          <p>Track pace trends, compare performances, and celebrate improvements across the years.</p>
          <div className="status-bar">
            {isLoading && <span className="status-pill loading">Loading race data…</span>}
            {error && <span className="status-pill error">⚠ {error}</span>}
            {!isLoading && !error && (
              <span className="status-pill success">
                <Activity size={14} />
                {raceData.length} race records loaded
              </span>
            )}
          </div>
        </header>

        {summaryStats && (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="label">Runners</div>
              <div className="value">{summaryStats.runnerCount}</div>
            </div>
            <div className="stat-card">
              <div className="label">Years</div>
              <div className="value">{summaryStats.yearSpan}</div>
            </div>
            <div className="stat-card">
              <div className="label">Fastest Pace</div>
              <div className="value">{secondsToPace(summaryStats.fastestPace, paceUnit)}</div>
              <div className="sub">{summaryStats.fastestRunner}</div>
            </div>
            <div className="stat-card">
              <div className="label">Latest Year</div>
              <div className="value">{summaryStats.latestYear}</div>
              <div className="sub">{summaryStats.latestCount} finishers</div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="controls">
            <div className="tab-group">
              <button
                className={`tab ${viewMode === 'trends' ? 'active' : ''}`}
                onClick={() => setViewMode('trends')}
              >
                <TrendingUp size={16} /> Trends
              </button>
              <button
                className={`tab ${viewMode === 'comparison' ? 'active' : ''}`}
                onClick={() => setViewMode('comparison')}
              >
                <Users size={16} /> Comparison
              </button>
            </div>
            <button className="btn-outline" onClick={() => setPaceUnit(paceUnit === 'mile' ? 'km' : 'mile')}>
              <Timer size={16} />
              Pace: {paceLabel}
            </button>
            {viewMode === 'comparison' && (
              <select
                className="year-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                <option value="all">Select a year…</option>
                {years.map(year => <option key={year} value={year}>{year}</option>)}
              </select>
            )}
          </div>
        </div>

        <div className="main-grid">
          <aside className="runner-panel">
            <h3 className="card-title">Runners</h3>
            <div className="runner-list">
              {runners.map((runner) => (
                <label key={runner} className="runner-item">
                  <input
                    type="checkbox"
                    checked={selectedRunners.has(runner)}
                    onChange={() => handleRunnerToggle(runner)}
                  />
                  <div className="runner-dot" style={{ backgroundColor: runnerColorMap[runner] }} />
                  <span className="runner-name">{runner}</span>
                </label>
              ))}
            </div>
            <div className="panel-actions">
              <button className="btn-primary" onClick={() => setSelectedRunners(new Set(runners))}>Select All</button>
              <button className="btn-secondary" onClick={() => setSelectedRunners(new Set())}>Clear All</button>
            </div>
          </aside>

          <div className="chart-card">
            {viewMode === 'trends' ? (
              <>
                <h3 className="card-title"><TrendingUp size={18} /> Pace Trends Over Time</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 13 }} />
                    <YAxis
                      domain={yAxisDomain}
                      label={{ value: `Pace (${paceLabel})`, angle: -90, position: 'insideLeft', fill: '#64748b' }}
                      tickFormatter={(s) => secondsToPace(s, paceUnit)}
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      reversed
                    />
                    <Tooltip
                      formatter={(value) => [secondsToPace(value, paceUnit), 'Pace']}
                      labelFormatter={(label) => `Year ${label}`}
                      contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                    />
                    <Legend />
                    {runners.map((runner) => (
                      <Line
                        key={runner}
                        type="monotone"
                        dataKey={runner}
                        stroke={runnerColorMap[runner]}
                        strokeWidth={selectedRunners.has(runner) ? 3 : 1.5}
                        opacity={selectedRunners.size === 0 || selectedRunners.has(runner) ? 1 : 0.25}
                        dot={{ r: selectedRunners.has(runner) ? 5 : 3 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </>
            ) : (
              <>
                <h3 className="card-title">
                  <Users size={18} />
                  Year Comparison{selectedYear !== 'all' && ` — ${selectedYear}`}
                </h3>
                {selectedYear === 'all' ? (
                  <div className="empty-state">
                    <Users size={40} strokeWidth={1.5} color="#94a3b8" />
                    <p>Select a year above to compare runner paces</p>
                    <span className="hint">Lower pace = faster runner</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={comparisonData} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                      <XAxis
                        type="number"
                        tickFormatter={(s) => secondsToPace(s, paceUnit)}
                        tick={{ fill: '#64748b', fontSize: 12 }}
                      />
                      <YAxis type="category" dataKey="runner" tick={{ fill: '#64748b', fontSize: 13 }} width={70} />
                      <Tooltip
                        formatter={(value) => [secondsToPace(value, paceUnit), 'Pace']}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                        contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                      />
                      <Bar dataKey="paceInSeconds" radius={[0, 4, 4, 0]}>
                        {comparisonData.map((entry) => (
                          <Cell key={entry.fullName} fill={runnerColorMap[entry.fullName]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </>
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="card-title"><Activity size={18} /> Group Pace Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={paceDistributionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" tick={{ fill: '#64748b' }} />
              <YAxis
                label={{ value: `Pace (${paceLabel})`, angle: -90, position: 'insideLeft', fill: '#64748b' }}
                tickFormatter={(s) => secondsToPace(s, paceUnit)}
                tick={{ fill: '#64748b', fontSize: 12 }}
                reversed
              />
              <Tooltip
                formatter={(value, name) => [secondsToPace(value, paceUnit), name.replace('Pace', ' Pace')]}
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Legend />
              <Area type="monotone" dataKey="maxPace" stroke="#f97316" fill="#f97316" fillOpacity={0.1} name="Slowest" />
              <Area type="monotone" dataKey="minPace" stroke="#0d9488" fill="#0d9488" fillOpacity={0.2} name="Fastest" />
              <Line type="monotone" dataKey="medianPace" stroke="#3b82f6" strokeWidth={2.5} name="Median" dot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="card-title"><TrendingUp size={18} /> Annual Ranking Changes</h3>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={bumpChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" allowDecimals={false} tick={{ fill: '#64748b' }} />
              <YAxis
                label={{ value: 'Rank', angle: -90, position: 'insideLeft', fill: '#64748b' }}
                reversed
                allowDecimals={false}
                tick={{ fill: '#64748b' }}
              />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Legend />
              {runners.map((runner) => (
                <Line
                  key={runner}
                  type="monotone"
                  dataKey={runner}
                  stroke={runnerColorMap[runner]}
                  strokeWidth={selectedRunners.has(runner) ? 3 : 1.5}
                  opacity={selectedRunners.size === 0 || selectedRunners.has(runner) ? 1 : 0.25}
                  dot={{ r: 4 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="improvement-grid">
          <div className="card" style={{ marginBottom: 0 }}>
            <h3 className="card-title">
              <Trophy size={18} />
              Annual Pace Busters
              {years.length >= 2 && ` (${years[years.length - 2]} vs ${years[years.length - 1]})`}
            </h3>
            {yearOverYearImprovers.length > 0 ? (
              <div style={{ display: 'grid', gap: 12 }}>
                {yearOverYearImprovers.map((stat) => (
                  <div key={stat.runner} className="improvement-card">
                    <div className="improvement-header">
                      <h4>{stat.runner}</h4>
                      <span className="badge-success">↓ {secondsToPace(stat.improvement, paceUnit)}</span>
                    </div>
                    <div className="improvement-details">
                      <p>{secondsToPace(stat.previousPace, paceUnit)} → {secondsToPace(stat.latestPace, paceUnit)}</p>
                      <p className="improvement-highlight">Pace improved by {stat.improvementPercent}%</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted-text">No year-over-year improvements yet — great baseline for next year!</p>
            )}
          </div>

          <div className="card" style={{ marginBottom: 0 }}>
            <h3 className="card-title"><Rocket size={18} /> All-Time Improvers</h3>
            {overallImprovers.length > 0 ? (
              <div style={{ display: 'grid', gap: 12 }}>
                {overallImprovers.map((stat) => (
                  <div key={stat.runner} className="improvement-card">
                    <div className="improvement-header">
                      <h4>{stat.runner}</h4>
                      <span className="badge-success">↓ {secondsToPace(stat.improvement, paceUnit)}</span>
                    </div>
                    <div className="improvement-details">
                      <p>{secondsToPace(stat.firstPace, paceUnit)} → {secondsToPace(stat.lastPace, paceUnit)}</p>
                      <p className="improvement-highlight">Pace improved by {stat.improvementPercent}% overall</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted-text">No overall improvements recorded yet. Keep on running!</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
