"use client";

import React, { useMemo, useState } from "react";

type MonthKey =
  | "jan" | "feb" | "mar" | "apr" | "may" | "jun"
  | "jul" | "aug" | "sep" | "oct" | "nov" | "dec";

type MonthLabel = { key: MonthKey; label: string };

const MONTHS: MonthLabel[] = [
  { key: "jan", label: "Jan" },
  { key: "feb", label: "Feb" },
  { key: "mar", label: "Mar" },
  { key: "apr", label: "Apr" },
  { key: "may", label: "May" },
  { key: "jun", label: "Jun" },
  { key: "jul", label: "Jul" },
  { key: "aug", label: "Aug" },
  { key: "sep", label: "Sep" },
  { key: "oct", label: "Oct" },
  { key: "nov", label: "Nov" },
  { key: "dec", label: "Dec" }
];

type MonthlyNumbers = Record<MonthKey, number>;

type Project = {
  id: string;
  name: string;
  revenue: MonthlyNumbers;
  cost: MonthlyNumbers;
  adjustments: MonthlyNumbers;
  isOpen: boolean;
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function makeMonthly(init = 0): MonthlyNumbers {
  return {
    jan: init, feb: init, mar: init, apr: init, may: init, jun: init,
    jul: init, aug: init, sep: init, oct: init, nov: init, dec: init
  };
}

function clampNumber(value: string, fallback = 0) {
  // allow empty -> 0 while typing
  if (value.trim() === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function formatPct(n: number | null) {
  if (n === null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 }).format(n);
}

type Amounts = { revenue: number; cost: number; adjustments: number; margin: number };

function addAmounts(a: Amounts, b: Amounts): Amounts {
  return {
    revenue: a.revenue + b.revenue,
    cost: a.cost + b.cost,
    adjustments: a.adjustments + b.adjustments,
    margin: a.margin + b.margin
  };
}

function marginPct(revenue: number, margin: number): number | null {
  if (!Number.isFinite(revenue) || revenue <= 0) return null;
  return margin / revenue;
}

function sumMonths(m: MonthlyNumbers) {
  return MONTHS.reduce((acc, { key }) => acc + (m[key] ?? 0), 0);
}

function perMonthAmounts(p: Project): Record<MonthKey, Amounts> {
  const out = {} as Record<MonthKey, Amounts>;
  for (const { key } of MONTHS) {
    const revenue = p.revenue[key] ?? 0;
    const cost = p.cost[key] ?? 0;
    const adjustments = p.adjustments[key] ?? 0;
    const margin = revenue - cost + adjustments;
    out[key] = { revenue, cost, adjustments, margin };
  }
  return out;
}

function totalsForProject(p: Project): Amounts {
  const revenue = sumMonths(p.revenue);
  const cost = sumMonths(p.cost);
  const adjustments = sumMonths(p.adjustments);
  const margin = revenue - cost + adjustments;
  return { revenue, cost, adjustments, margin };
}

export default function Page() {
  const [projects, setProjects] = useState<Project[]>([
    {
      id: uid(),
      name: "Project 1",
      revenue: { ...makeMonthly(0), jan: 50000, feb: 50000, mar: 50000 },
      cost: { ...makeMonthly(0), jan: 35000, feb: 35000, mar: 35000 },
      adjustments: makeMonthly(0),
      isOpen: false
    }
  ]);

  const addProject = () => {
    setProjects((prev) => {
      const idx = prev.length + 1;
      return [
        ...prev,
        {
          id: uid(),
          name: `Project ${idx}`,
          revenue: makeMonthly(0),
          cost: makeMonthly(0),
          adjustments: makeMonthly(0),
          isOpen: true
        }
      ];
    });
  };

  const removeProject = (id: string) => {
    setProjects((prev) => (prev.length <= 1 ? prev : prev.filter((p) => p.id !== id)));
  };

  const toggleOpen = (id: string) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, isOpen: !p.isOpen } : p)));
  };

  const updateProject = (id: string, patch: Partial<Project>) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const updateMonthlyField = (
    id: string,
    field: "revenue" | "cost" | "adjustments",
    month: MonthKey,
    value: number
  ) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        return {
          ...p,
          [field]: {
            ...p[field],
            [month]: value
          }
        };
      })
    );
  };

  const derived = useMemo(() => {
    const projectRows = projects.map((p) => {
      const byMonth = perMonthAmounts(p);
      const total = totalsForProject(p);
      return {
        id: p.id,
        name: p.name,
        isOpen: p.isOpen,
        byMonth,
        total,
        totalPct: marginPct(total.revenue, total.margin)
      };
    });

    const portfolioByMonth: Record<MonthKey, Amounts> = {} as any;
    for (const { key } of MONTHS) {
      portfolioByMonth[key] = projectRows.reduce(
        (acc, r) => addAmounts(acc, r.byMonth[key]),
        { revenue: 0, cost: 0, adjustments: 0, margin: 0 }
      );
    }

    const portfolioTotal = MONTHS.reduce(
      (acc, { key }) => addAmounts(acc, portfolioByMonth[key]),
      { revenue: 0, cost: 0, adjustments: 0, margin: 0 }
    );

    const portfolioPct = marginPct(portfolioTotal.revenue, portfolioTotal.margin);

    return { projectRows, portfolioByMonth, portfolioTotal, portfolioPct };
  }, [projects]);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-10">
      {/* Header */}
      <header className="mb-8 flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Xtillion Portfolio ProForma</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Monthly proforma. Expand a project row to edit monthly revenue, cost, and adjustments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={addProject}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
            >
              + Add project
            </button>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 px-4 py-3 shadow-sm">
              <div className="text-[11px] uppercase tracking-wide text-zinc-400">Projected portfolio margin</div>
              <div className="mt-1 text-2xl font-semibold">{formatMoney(derived.portfolioTotal.margin)}</div>
              <div className="mt-1 text-xs text-zinc-400">
                Margin %: <span className="font-medium text-zinc-200">{formatPct(derived.portfolioPct)}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Table */}
      <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/30 shadow-sm">
        <div className="overflow-auto">
          <table className="min-w-[1200px] w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-zinc-950/95 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/75">
              <tr className="text-left">
                <th className="w-[420px] px-4 py-3 font-semibold text-zinc-200">
                  Projects <span className="ml-2 text-xs font-normal text-zinc-500">(collapse/expand)</span>
                </th>

                {MONTHS.map((m) => (
                  <th key={m.key} className="px-4 py-3 font-semibold text-zinc-200">
                    {m.label}
                  </th>
                ))}

                <th className="px-4 py-3 font-semibold text-zinc-200">Total</th>
              </tr>
            </thead>

            <tbody>
              {derived.projectRows.map((r) => {
                const p = projects.find((x) => x.id === r.id)!;

                return (
                  <React.Fragment key={r.id}>
                    {/* Collapsed row: margin $ + margin % */}
                    <tr className="border-t border-zinc-900">
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-start justify-between gap-3">
                          <button
                            onClick={() => toggleOpen(r.id)}
                            className="group flex items-start gap-3 text-left"
                            title={r.isOpen ? "Collapse" : "Expand"}
                          >
                            <span
                              className={[
                                "mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-lg",
                                "border border-zinc-800 bg-zinc-950/40 text-zinc-300",
                                "group-hover:border-zinc-700 group-hover:text-zinc-100"
                              ].join(" ")}
                              aria-hidden="true"
                            >
                              {r.isOpen ? "–" : "+"}
                            </span>
                            <div>
                              <div className="font-medium text-zinc-100">{r.name}</div>
                              <div className="mt-1 text-xs text-zinc-500">
                                Year margin:{" "}
                                <span className="font-medium text-zinc-300">{formatMoney(r.total.margin)}</span>{" "}
                                <span className="text-zinc-500">({formatPct(r.totalPct)})</span>
                              </div>
                            </div>
                          </button>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => removeProject(r.id)}
                              disabled={projects.length <= 1}
                              className="rounded-xl border border-zinc-800 bg-zinc-950/30 px-3 py-2 text-xs text-zinc-200 shadow-sm hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
                              title={projects.length <= 1 ? "At least one project is required." : "Remove project"}
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        {/* Inline rename */}
                        {r.isOpen ? (
                          <div className="mt-3">
                            <label className="text-xs text-zinc-500">Project name</label>
                            <input
                              value={p.name}
                              onChange={(e) => updateProject(r.id, { name: e.target.value })}
                              className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
                              placeholder="Project name"
                            />
                          </div>
                        ) : null}
                      </td>

                      {MONTHS.map(({ key }) => {
                        const a = r.byMonth[key];
                        const pct = marginPct(a.revenue, a.margin);
                        return (
                          <td key={key} className="px-4 py-3 align-top">
                            <div className="font-medium text-zinc-100">{formatMoney(a.margin)}</div>
                            <div className="text-xs text-zinc-500">{formatPct(pct)}</div>
                          </td>
                        );
                      })}

                      <td className="px-4 py-3 align-top">
                        <div className="font-semibold text-zinc-100">{formatMoney(r.total.margin)}</div>
                        <div className="text-xs text-zinc-400">{formatPct(r.totalPct)}</div>
                      </td>
                    </tr>

                    {/* Expanded editor row */}
                    {r.isOpen ? (
                      <tr className="border-t border-zinc-900 bg-zinc-950/40">
                        <td className="px-4 py-4 align-top">
                          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3">
                            <div className="text-xs font-medium text-zinc-300">Edit monthly values</div>
                            <div className="mt-1 text-xs text-zinc-500">
                              Enter monthly revenue, cost, adjustments (USD). Margin auto-calculates.
                            </div>
                          </div>
                        </td>

                        {MONTHS.map(({ key }) => {
                          const a = r.byMonth[key];
                          const pct = marginPct(a.revenue, a.margin);

                          const inputClass =
                            "w-28 rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100 " +
                            "placeholder:text-zinc-700 focus:border-indigo-500";

                          return (
                            <td key={key} className="px-4 py-4 align-top">
                              <div className="flex flex-col gap-2">
                                <div>
                                  <div className="text-[11px] text-zinc-500">Revenue</div>
                                  <input
                                    inputMode="decimal"
                                    value={String(p.revenue[key] ?? 0)}
                                    onChange={(e) => updateMonthlyField(r.id, "revenue", key, clampNumber(e.target.value))}
                                    className={inputClass}
                                  />
                                </div>

                                <div>
                                  <div className="text-[11px] text-zinc-500">Cost</div>
                                  <input
                                    inputMode="decimal"
                                    value={String(p.cost[key] ?? 0)}
                                    onChange={(e) => updateMonthlyField(r.id, "cost", key, clampNumber(e.target.value))}
                                    className={inputClass}
                                  />
                                </div>

                                <div>
                                  <div className="text-[11px] text-zinc-500">Adjust</div>
                                  <input
                                    inputMode="decimal"
                                    value={String(p.adjustments[key] ?? 0)}
                                    onChange={(e) =>
                                      updateMonthlyField(r.id, "adjustments", key, clampNumber(e.target.value))
                                    }
                                    className={inputClass}
                                  />
                                </div>

                                <div className="mt-1 rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2">
                                  <div className="text-[11px] uppercase tracking-wide text-zinc-500">Margin</div>
                                  <div className="mt-0.5 text-xs font-medium text-zinc-100">{formatMoney(a.margin)}</div>
                                  <div className="text-[11px] text-zinc-500">{formatPct(pct)}</div>
                                </div>
                              </div>
                            </td>
                          );
                        })}

                        <td className="px-4 py-4 align-top">
                          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3">
                            <div className="text-xs uppercase tracking-wide text-zinc-500">Project total</div>
                            <div className="mt-1 text-base font-semibold text-zinc-100">{formatMoney(r.total.margin)}</div>
                            <div className="mt-1 text-xs text-zinc-400">Margin %: {formatPct(r.totalPct)}</div>

                            <div className="mt-3 grid grid-cols-1 gap-1 text-xs text-zinc-500">
                              <div>
                                Revenue: <span className="text-zinc-300">{formatMoney(r.total.revenue)}</span>
                              </div>
                              <div>
                                Cost: <span className="text-zinc-300">{formatMoney(r.total.cost)}</span>
                              </div>
                              <div>
                                Adjust: <span className="text-zinc-300">{formatMoney(r.total.adjustments)}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>

            <tfoot>
              <tr className="border-t border-zinc-800 bg-zinc-950/70">
                <td className="px-4 py-4 font-semibold text-zinc-100">Portfolio</td>

                {MONTHS.map(({ key }) => {
                  const a = derived.portfolioByMonth[key];
                  const pct = marginPct(a.revenue, a.margin);
                  return (
                    <td key={key} className="px-4 py-4">
                      <div className="font-semibold text-zinc-100">{formatMoney(a.margin)}</div>
                      <div className="text-xs text-zinc-400">{formatPct(pct)}</div>
                    </td>
                  );
                })}

                <td className="px-4 py-4">
                  <div className="text-base font-bold text-zinc-100">{formatMoney(derived.portfolioTotal.margin)}</div>
                  <div className="text-xs text-zinc-300">{formatPct(derived.portfolioPct)}</div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <footer className="mt-6 text-xs text-zinc-500">
        Tip: Margin % is calculated as <span className="text-zinc-300">margin ÷ revenue</span>. If revenue is 0, we show “—”.
      </footer>
    </main>
  );
}
