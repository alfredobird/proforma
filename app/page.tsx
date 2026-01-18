"use client";

import React, { useMemo, useState } from "react";

type Project = {
  id: string;
  name: string;
  startDate: string; // yyyy-mm-dd
  endDate: string; // yyyy-mm-dd
  weeklyRevenue: number;
  weeklyCost: number;
  weeklyAdjustments: number;
};

type MonthBucket = {
  monthIndex: number; // 0..11
  start: Date; // noon
  end: Date; // noon
  label: string; // Jan, Feb...
  key: string;
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
  if (!value) return null;
  const [y, m, d] = value.split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  dt.setHours(12, 0, 0, 0); // normalize to noon to reduce DST edge cases
  return dt;
}

function startOfDayNoon(d: Date) {
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  return x;
}

function clampNumber(value: string, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function formatPct(n: number | null) {
  if (n === null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 1
  }).format(n);
}

function computeWeeklyMargin(p: Project) {
  return p.weeklyRevenue - p.weeklyCost + p.weeklyAdjustments;
}

/**
 * Inclusive overlap in days between [aStart,aEnd] and [bStart,bEnd], both at noon.
 */
function overlapDaysInclusive(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  const start = aStart > bStart ? aStart : bStart;
  const end = aEnd < bEnd ? aEnd : bEnd;
  if (start > end) return 0;

  // difference in whole days, inclusive
  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = Math.round((end.getTime() - start.getTime()) / msPerDay);
  return diff + 1;
}

function buildMonthsForYear(year: number): MonthBucket[] {
  const months: MonthBucket[] = [];
  for (let m = 0; m < 12; m++) {
    const start = startOfDayNoon(new Date(year, m, 1));
    const end = startOfDayNoon(new Date(year, m + 1, 0)); // last day of month
    const label = start.toLocaleDateString("en-US", { month: "short" });
    months.push({
      monthIndex: m,
      start,
      end,
      label,
      key: `${year}-${m + 1}`
    });
  }
  return months;
}

function clampProjectDatesToYear(p: Project, year: number): Project {
  const yearStart = startOfDayNoon(new Date(year, 0, 1));
  const yearEnd = startOfDayNoon(new Date(year, 11, 31));

  const ps = parseDateInput(p.startDate) ?? yearStart;
  const pe = parseDateInput(p.endDate) ?? yearEnd;

  const clampedStart = ps < yearStart ? yearStart : ps > yearEnd ? yearEnd : ps;
  const clampedEnd = pe < yearStart ? yearStart : pe > yearEnd ? yearEnd : pe;

  const finalStart = clampedStart;
  const finalEnd = clampedEnd < finalStart ? finalStart : clampedEnd;

  return {
    ...p,
    startDate: toISODateInput(finalStart),
    endDate: toISODateInput(finalEnd)
  };
}

type Amounts = {
  revenue: number;
  cost: number;
  adjustments: number;
  margin: number;
};

function addAmounts(a: Amounts, b: Amounts): Amounts {
  return {
    revenue: a.revenue + b.revenue,
    cost: a.cost + b.cost,
    adjustments: a.adjustments + b.adjustments,
    margin: a.margin + b.margin
  };
}

function amountsFromWeekly(weeklyRevenue: number, weeklyCost: number, weeklyAdjustments: number, factorWeeks: number): Amounts {
  const revenue = weeklyRevenue * factorWeeks;
  const cost = weeklyCost * factorWeeks;
  const adjustments = weeklyAdjustments * factorWeeks;
  const margin = revenue - cost + adjustments;
  return { revenue, cost, adjustments, margin };
}

function marginPct(revenue: number, margin: number): number | null {
  if (!Number.isFinite(revenue) || revenue <= 0) return null;
  return margin / revenue;
}

export default function Page() {
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());

  const months = useMemo(() => buildMonthsForYear(year), [year]);

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

  // When year changes, keep project dates within that year (no crashes, no missing calc)
  React.useEffect(() => {
    setProjects((prev) => prev.map((p) => clampProjectDatesToYear(p, year)));
  }, [year]);

  const yearOptions = useMemo(() => {
    const y = now.getFullYear();
    return [y - 1, y, y + 1, y + 2];
  }, [now]);

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

  /**
   * For each project and month:
   * - compute overlapDays between project range and month
   * - convert to "week factors" (overlapDays/7)
   * - allocate weekly revenue/cost/adjustments to that month
   */
  const projectMonthGrid = useMemo(() => {
    return projects.map((p) => {
      const ps = parseDateInput(p.startDate);
      const pe = parseDateInput(p.endDate);

      const dateError =
        !ps || !pe ? "Start and end dates are required." : ps > pe ? "Start date must be on/before end date." : null;

      const start = ps ? startOfDayNoon(ps) : null;
      const end = pe ? startOfDayNoon(pe) : null;

      const byMonth: Amounts[] = months.map((m) => {
        if (!start || !end) return { revenue: 0, cost: 0, adjustments: 0, margin: 0 };
        const days = overlapDaysInclusive(start, end, m.start, m.end);
        if (days <= 0) return { revenue: 0, cost: 0, adjustments: 0, margin: 0 };
        const factorWeeks = days / 7;
        return amountsFromWeekly(p.weeklyRevenue, p.weeklyCost, p.weeklyAdjustments, factorWeeks);
      });

      const total = byMonth.reduce(
        (acc, a) => addAmounts(acc, a),
        { revenue: 0, cost: 0, adjustments: 0, margin: 0 }
      );

      const weeklyMargin = computeWeeklyMargin(p);
      const weeklyPct = marginPct(p.weeklyRevenue, weeklyMargin);
      const projectedPct = marginPct(total.revenue, total.margin);

      return {
        project: p,
        dateError,
        byMonth,
        total,
        weeklyMargin,
        weeklyPct,
        projectedPct
      };
    });
  }, [projects, months]);

  const portfolioByMonth = useMemo(() => {
    const byMonth = months.map((_, mi) => {
      return projectMonthGrid.reduce(
        (acc, row) => addAmounts(acc, row.byMonth[mi]),
        { revenue: 0, cost: 0, adjustments: 0, margin: 0 }
      );
    });

    const total = byMonth.reduce(
      (acc, a) => addAmounts(acc, a),
      { revenue: 0, cost: 0, adjustments: 0, margin: 0 }
    );

    return { byMonth, total, projectedPct: marginPct(total.revenue, total.margin) };
  }, [projectMonthGrid, months]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <header className="mb-8 flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Proforma Builder</h1>
        <p className="text-zinc-600">
          Monthly proforma (Jan–Dec). Enter weekly revenue/cost/adjustments per project; the app allocates them into months.
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
            <div className="mt-1 text-2xl font-semibold">{formatMoney(portfolioByMonth.total.margin)}</div>
            <div className="mt-1 text-xs text-zinc-600">
              Margin %: <span className="font-medium">{formatPct(portfolioByMonth.projectedPct)}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Projects */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">Projects</h2>

        <div className="grid grid-cols-1 gap-4">
          {projectMonthGrid.map((row) => {
            const p = row.project;

            return (
              <div key={p.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="text-xs uppercase tracking-wide text-zinc-500">Project</div>
                    <input
                      value={p.name}
                      onChange={(e) => updateProject(p.id, { name: e.target.value })}
                      className="w-[min(520px,90vw)] rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                      placeholder="Project name"
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
                    <div className="text-xs uppercase tracking-wide text-zinc-500">Projected (year) margin</div>
                    <div className="mt-1 text-xl font-semibold">{formatMoney(row.total.margin)}</div>
                    <div className="mt-1 text-xs text-zinc-600">
                      Margin %: <span className="font-medium">{formatPct(row.projectedPct)}</span>
                    </div>
                    <div className="mt-1 text-xs text-zinc-600">
                      Weekly margin:{" "}
                      <span className="font-medium">{formatMoney(row.weeklyMargin)}</span>{" "}
                      <span className="text-zinc-500">({formatPct(row.weeklyPct)})</span>
                    </div>
                  </div>
                </div>

                {row.dateError ? (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {row.dateError}
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

      {/* Monthly Table */}
      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold">Monthly margin table (months as columns)</h2>
          <p className="text-sm text-zinc-600">
            Each cell shows <span className="font-medium">margin $</span> and <span className="font-medium">margin %</span>{" "}
            (margin ÷ revenue). Months run January through December.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-auto">
            <table className="min-w-[1100px] w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                <tr className="text-left">
                  <th className="w-64 px-4 py-3 font-semibold">Project</th>
                  {months.map((m) => (
                    <th key={m.key} className="px-4 py-3 font-semibold">
                      {m.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-semibold">Total</th>
                </tr>
              </thead>

              <tbody>
                {projectMonthGrid.map((row) => (
                  <tr key={row.project.id} className="border-t border-zinc-100">
                    <td className="px-4 py-3 font-medium">{row.project.name}</td>

                    {row.byMonth.map((a, idx) => (
                      <td key={idx} className="px-4 py-3">
                        <div className="font-medium">{formatMoney(a.margin)}</div>
                        <div className="text-xs text-zinc-500">{formatPct(marginPct(a.revenue, a.margin))}</div>
                      </td>
                    ))}

                    <td className="px-4 py-3">
                      <div className="font-semibold">{formatMoney(row.total.margin)}</div>
                      <div className="text-xs text-zinc-600">{formatPct(row.projectedPct)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr className="border-t border-zinc-200 bg-zinc-50">
                  <td className="px-4 py-3 font-semibold">Portfolio</td>

                  {portfolioByMonth.byMonth.map((a, idx) => (
                    <td key={idx} className="px-4 py-3">
                      <div className="font-semibold">{formatMoney(a.margin)}</div>
                      <div className="text-xs text-zinc-600">{formatPct(marginPct(a.revenue, a.margin))}</div>
                    </td>
                  ))}

                  <td className="px-4 py-3">
                    <div className="text-base font-bold">{formatMoney(portfolioByMonth.total.margin)}</div>
                    <div className="text-xs text-zinc-700">{formatPct(portfolioByMonth.projectedPct)}</div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="mt-4 text-xs text-zinc-500">
          Allocation note: weekly values are distributed into months by overlapping days (monthly amount = weekly × overlapDays/7).
        </div>
      </section>
    </main>
  );
}
