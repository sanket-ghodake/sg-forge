"use client";

import { useEffect, useState } from "react";

interface ManagerOpsAppProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  runQuery: (sql: string) => Promise<{ rows: any[]; rowCount: number }>;
}

export default function ManagerOpsApp({ user, runQuery }: ManagerOpsAppProps) {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadReports = async () => {
    setLoading(true);
    setError("");
    try {
      // Find direct reports for the current user (if any) or general list if they are super admin
      const query = `
        SELECT u.eid, u.name, u.email, dm.name as designation, vm.name as vertical
        FROM users u
        LEFT JOIN structural_metadata dm ON u.designation_id = dm.id
        LEFT JOIN structural_metadata vm ON u.vertical_id = vm.id
        WHERE u.manager_id = '${user.id}'
        ORDER BY u.name ASC;
      `;
      const res = await runQuery(query);
      setReports(res.rows || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to fetch manager-specific reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [runQuery, user.id]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-border-accent/40 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-brand-accent">
            Manager Operations Dashboard
          </h2>
          <p className="text-xs text-text-secondary">
            Strategic team tracking, performance indices, and access matrix controls.
          </p>
        </div>
        <span className="px-3 py-1 bg-brand-muted text-brand-accent border border-brand-accent/20 rounded-full font-bold text-xs uppercase">
          L3+ Management Scope
        </span>
      </div>

      {error && (
        <div className="p-4 bg-danger/15 border border-danger/20 text-danger rounded-xl text-xs font-mono">
          {error}
        </div>
      )}

      {/* Metric Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-elevated/40 border border-border-accent/40 p-4.5 rounded-2xl">
          <div className="text-2xl mb-1">📊</div>
          <p className="text-[10px] text-text-tertiary uppercase font-black tracking-wider">
            Department Utilisation
          </p>
          <p className="text-lg font-black text-text-primary mt-1">87.5%</p>
          <span className="text-[9px] text-success font-semibold">↑ 2.4% from last quarter</span>
        </div>
        <div className="bg-surface-elevated/40 border border-border-accent/40 p-4.5 rounded-2xl">
          <div className="text-2xl mb-1">⏳</div>
          <p className="text-[10px] text-text-tertiary uppercase font-black tracking-wider">
            Open Procurement Items
          </p>
          <p className="text-lg font-black text-text-primary mt-1">4 Actions</p>
          <span className="text-[9px] text-warning-text font-semibold">
            Requires immediate review
          </span>
        </div>
        <div className="bg-surface-elevated/40 border border-border-accent/40 p-4.5 rounded-2xl">
          <div className="text-2xl mb-1">🎯</div>
          <p className="text-[10px] text-text-tertiary uppercase font-black tracking-wider">
            Sprint Delivery Velocity
          </p>
          <p className="text-lg font-black text-text-primary mt-1">94.2%</p>
          <span className="text-[9px] text-success font-semibold">Excellent consistency</span>
        </div>
      </div>

      {/* Reports section */}
      <div className="bg-surface-card border border-border-accent/60 rounded-3xl p-6 shadow-sm">
        <h3 className="font-extrabold text-sm text-text-primary mb-3">Direct Reports Overview</h3>
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <span className="w-6 h-6 border-2 border-brand-accent border-t-transparent rounded-full animate-spin"></span>
          </div>
        ) : reports.length === 0 ? (
          <p className="text-xs text-text-tertiary italic">
            You do not have any registered direct reports under your profile coordinates.
          </p>
        ) : (
          <div className="overflow-x-auto border border-border-accent/40 rounded-2xl">
            <table className="min-w-full divide-y divide-border-accent/30 text-left text-xs">
              <thead className="bg-surface-elevated/50 text-text-secondary font-mono">
                <tr>
                  <th className="px-4 py-3">EID</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Position</th>
                  <th className="px-4 py-3">Vertical</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-accent/20 text-text-secondary">
                {reports.map((emp) => (
                  <tr key={emp.eid} className="hover:bg-surface-elevated/20 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-text-primary">{emp.eid}</td>
                    <td className="px-4 py-3 font-bold text-text-primary">{emp.name}</td>
                    <td className="px-4 py-3">{emp.email}</td>
                    <td className="px-4 py-3">{emp.designation}</td>
                    <td className="px-4 py-3">{emp.vertical}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
