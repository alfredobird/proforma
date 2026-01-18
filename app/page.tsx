"use client";

import React, { useMemo, useState } from "react";

type Project = {
  id: string;
  name: string;
  startDate: string; // yyyy-mm-dd
  endDate: string;   // yyyy-mm-dd
  weeklyRevenue: number;
  weeklyCost: number;
  weeklyAdjustments: number;
};

type Week = {
  index: number;         // 1..N
  start: Date;           // local
  end: Date;             // local (start + 6 days)
  label: string;         // e.g., "Jan 01"
  key: string;           // ISO-ish key for React
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function toISODateInput(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseDateInput(value: string): Date | null {
  // value expected yyyy-mm-dd
  if (!value) return null;
  const [y, m, d] = value.split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  // guard: if browser coerced
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  // normalize time to noon to reduce DST edge cases
  dt.setHours(12, 0, 0, 0);
  return dt;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function clampNumber(value: string, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function startOfDayNoon(d: Date) {
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  return x;
}

function isOverlapping(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  // inclusive overlap
  return aStart <= bEnd && bStart <= aEnd;
}

function buildWeeksForYear(year: number): Week[] {
  // Weeks are Jan 1 -> Dec 31 in 7-day buckets, starting on Jan 1 (per "Jan–Dec").
  // This yields 53 weeks in some years depending on day-of-week and leap years.
  const jan1 = startOfDayNoon(new Date(year, 0, 1));
  const dec31 = startOfDayNoon(new Date(year, 11, 31));

  const weeks: Week[] = [];
  let current = new Date(jan1);
  let index = 1;

  while (current <= dec31) {
    const start = startOfDayNoon(current);
    const end = startOfDayNoon(new Date(start));
    end.setDate(end.getDate() + 6);

    const label = start.toLocaleDateString("en-US", { month: "short", day: "2-digit" });

    weeks.push({
      index,
      start,
      end,
      label,
      key: `${year}-w${index}-${start.getMonth() + 1}-${start.getDate()}`
    });

    current.setDate(current.getDate() + 7);
    index += 1;
  }

  return weeks;
}

function computeProjectWeeklyMargin(p: Project) {
  return p.weeklyRevenue - p.weeklyCost + p.weeklyAdjustments;
}

function isProjectActiveInWeek(p: Project, w: Week) {
  const ps = parseDateInput(p.startDate);
  const pe = parseDateInput(p.endDate);
  if (!ps || !pe) return false;
  const start = startOfDayNoon(ps);
  const end = startOfDayNoon(pe);
  return isOverlapping(start, end, w.start, w.end);
}

export default function Page() {
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());

  const defaultStart = useMemo(() => toISODateInput(new Date(year, 0, 1)), [year]);
  const defaultEnd = useMemo(() => toISODateInput(new Date(year, 11, 31)), [year]);

  const [projects, setProjects] = useState<Project[]>([
    {
      id: uid(),
      name: "Project 1",
      startDate: defaultStart,
      endDate: defaultEnd,
      weeklyRevenue: 10000,
      weeklyCost: 7000,
      weeklyAdjustments: 0
    }
  ]);

  const weeks = useMemo(() => buildWeeksForYear(year), [year]);

  // Ensure dates stay within the selected year if user switches year
  React.useEffect(() => {
    setProjects((prev) =>
      prev.map((p) => {
        const ps = parseDateInput(p.startDate);
        const pe = parseDateInput(p.endDate);

        const yearStart = startOfDayNoon(new Date(year, 0, 1));
        const yearEnd = startOfDayNoon(new Date(year, 11, 31));

        const newStart = ps ? ps : yearStart;
        const newEnd = pe ? pe : yearEnd;

        const clampedStart = newStart < yearStart ? yearStart : newStart > yearEnd ? yearEnd : newStart;
        const clampedEnd = newEnd < yearStart ? yearStart : newEnd > yearEnd ? yearEnd : newEnd;

        // If clamping causes start > end, set end = start
        const finalStart = clampedStart;
        const finalEnd = clampedEnd < finalStart ? finalStart : clampedEnd;

        return {
          ...p,
          startDate: toISODateInput(finalStart),
          endDate: toISODateInput(finalEnd)
        };
      })
    );
  }, [year]);

  const addProject = () => {
    setProjects((prev) => {
      const idx = prev.length + 1;
      return [
        ...prev,
        {
          id: uid(),
          name: `Project ${idx}`,
          startDate: defaultStart,
          endDate: defaultEnd,
          weeklyRevenue: 0,
          weeklyCost: 0,
          weeklyAdjustments: 0
        }
      ];
    });
  };

  const removeProject = (id: string) => {
    setProjects((prev) => (prev.length <= 1 ? prev : prev.filter((p) => p.id !== id)));
  };

  const updateProject = (id: string, patch: Partial<Project>) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const projectSummaries = useMemo(() => {
    return projects.map((p) => {
      const weeklyMargin = computeProjectWeeklyMargin(p);
      const projected = weeks.reduce((sum, w) => {
        if (!isProjectActiveInWeek(p, w)) return sum;
        return sum + weeklyMargin;
      }, 0);

      const ps = parseDateInput(p.startDate);
      const pe = parseDateInput(p.endDate);
      const dateError =
        !ps || !pe ? "Start and end dates are required." : ps > pe ? "Start date must be on/before end date." : null;

      return {
        id: p.id,
        weeklyMargin,
        projectedMargin: projected,
        dateError
      };
    });
  }, [projects, weeks]);

  const portfolioWeekly = useMemo(() => {
    return weeks.map((w) => {
      const margin = projects.reduce((sum, p) => {
        if (!isProjectActiveInWeek(p, w)) return sum;
        return sum + computeProjectWeeklyMargin(p);
      }, 0);
      return { week: w, margin };
    });
  }, [weeks, projects]);

  const projectedPortfolioMargin = useMemo(() => {
    return portfolioWeekly.reduce((sum, x) => sum + x.margin, 0);
  }, [portfolioWeekly]);

  const yearOptions = useMemo(() => {
    const y = now.getFullYear();
    return [y - 1, y, y + 1, y + 2];
  }, [now]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8 flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Proforma Builder</h1>
        <p className="text-zinc-600">
          Build project proformas and a portfolio rollup on a weekly calendar running January through December.
        </p>

        <div className="mt-2 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Year</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-40 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={addProject}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
          >
            + Add project
          </button>

          <div className="ml-auto rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-zinc-500">Projected portfolio margin</div>
            <div className="mt-1 text-2xl font-semibold">{formatMoney(projectedPortfolioMargin)}</div>
          </div>
        </div>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">Projects</h2>

        <div className="grid grid-cols-1 gap-4">
          {projects.map((p, idx) => {
            const summary = projectSummaries.find((s) => s.id === p.id)!;

            return (
              <div key={p.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="text-xs uppercase tracking-wide text-zinc-500">Project</div>
                    <input
                      value={p.name}
                      onChange={(e) => updateProject(p.id, { name: e.target.value })}
                      className="w-[min(520px,90vw)] rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                      placeholder={`Project ${idx + 1} name`}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => removeProject(p.id)}
                      disabled={projects.length <= 1}
                      className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                      title={projects.length <= 1 ? "At least one project is required." : "Remove project"}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">Start date</label>
                    <input
                      type="date"
                      value={p.startDate}
                      onChange={(e) => updateProject(p.id, { startDate: e.target.value })}
                      className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">End date</label>
                    <input
                      type="date"
                      value={p.endDate}
                      onChange={(e) => updateProject(p.id, { endDate: e.target.value })}
                      className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                    <div className="text-xs uppercase tracking-wide text-zinc-500">Projected project margin</div>
                    <div className="mt-1 text-xl font-semibold">{formatMoney(summary.projectedMargin)}</div>
                    <div className="mt-1 text-xs text-zinc-600">
                      Weekly margin: <span className="font-medium">{formatMoney(summary.weeklyMargin)}</span>
                    </div>
                  </div>
                </div>

                {summary.dateError ? (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {summary.dateError}
                  </div>
                ) : null}

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">Weekly revenue (USD)</label>
                    <input
                      inputMode="decimal"
                      value={String(p.weeklyRevenue)}
                      onChange={(e) => updateProject(p.id, { weeklyRevenue: clampNumber(e.target.value) })}
                      className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">Weekly cost (USD)</label>
                    <input
                      inputMode="decimal"
                      value={String(p.weeklyCost)}
                      onChange={(e) => updateProject(p.id, { weeklyCost: clampNumber(e.target.value) })}
                      className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">Weekly adjustments (USD)</label>
                    <input
                      inputMode="decimal"
                      value={String(p.weeklyAdjustments)}
                      onChange={(e) => updateProject(p.id, { weeklyAdjustments: clampNumber(e.target.value) })}
                      className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                    />
                    <div className="text-xs text-zinc-500">Margin = revenue − cost + adjustments</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Portfolio weekly margin (Jan–Dec)</h2>
            <p className="text-sm text-zinc-600">
              Each row is a 7-day bucket starting on Jan 1 of the selected year.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-zinc-500">Weeks</div>
            <div className="mt-1 text-lg font-semibold">{weeks.length}</div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                <tr className="text-left">
                  <th className="w-24 px-4 py-3 font-semibold">Week</th>
                  <th className="w-40 px-4 py-3 font-semibold">Start</th>
                  <th className="w-40 px-4 py-3 font-semibold">End</th>
                  <th className="px-4 py-3 font-semibold">Weekly portfolio margin</th>
                </tr>
              </thead>
              <tbody>
                {portfolioWeekly.map(({ week: w, margin }) => {
                  const startStr = w.start.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
                  const endStr = w.end.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
                  return (
                    <tr key={w.key} className="border-t border-zinc-100">
                      <td className="px-4 py-3 text-zinc-600">{w.index}</td>
                      <td className="px-4 py-3">{startStr}</td>
                      <td className="px-4 py-3">{endStr}</td>
                      <td className="px-4 py-3 font-medium">{formatMoney(margin)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-zinc-200 bg-zinc-50">
                  <td className="px-4 py-3 font-semibold" colSpan={3}>
                    Projected portfolio margin
                  </td>
                  <td className="px-4 py-3 text-base font-semibold">{formatMoney(projectedPortfolioMargin)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="mt-4 text-xs text-zinc-500">
          Note: A project contributes its weekly values to any week bucket that overlaps the project’s date range.
        </div>
      </section>

      <footer className="mt-12 border-t border-zinc-200 pt-6 text-sm text-zinc-600">
        <div className="flex flex-col gap-1">
          <div className="font-medium text-zinc-800">Next improvements you might want</div>
          <ul className="list-disc pl-5">
            <li>Portfolios (named groupings) and filtering by portfolio</li>
            <li>CSV export, PDF export, and saving to browser (localStorage)</li>
            <li>Different revenue/cost schedules (monthly, ramp, one-time fees)</li>
          </ul>
        </div>
      </footer>
    </main>
  );
}
