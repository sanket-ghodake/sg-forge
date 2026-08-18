"use client";

import { useEffect, useState } from "react";

interface BillingAppProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  runQuery: (sql: string) => Promise<{ rows: any[]; rowCount: number }>;
}

export default function BillingApp({ user, runQuery }: BillingAppProps) {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [clientName, setClientName] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("pending");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // We will store invoices in a temporary table or simulate it
  // Let's check if the invoices table exists, if not we create it or simulate it
  useEffect(() => {
    const initBilling = async () => {
      setLoading(true);
      try {
        // Create an invoices table in PostgreSQL if it doesn't exist to show Drizzle/Postgres persistence!
        await runQuery(`
          CREATE TABLE IF NOT EXISTS billing_invoices (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            client_name VARCHAR(255) NOT NULL,
            amount NUMERIC(10, 2) NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            created_by VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL
          );
        `);

        // Load invoices
        const res = await runQuery("SELECT * FROM billing_invoices ORDER BY created_at DESC;");
        setInvoices(res.rows || []);
      } catch (err: any) {
        console.error(err);
        setError(
          "Failed to load billing records. Make sure you are super_admin or have table creation privileges.",
        );
      } finally {
        setLoading(false);
      }
    };

    initBilling();
  }, [runQuery]);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !amount) return;

    setLoading(true);
    setError("");
    try {
      const sanitizedClient = clientName.replace(/'/g, "''");
      const amtVal = parseFloat(amount);
      if (isNaN(amtVal)) throw new Error("Invalid amount");

      await runQuery(`
        INSERT INTO billing_invoices (client_name, amount, status, created_by)
        VALUES ('${sanitizedClient}', ${amtVal}, '${status}', '${user.name}');
      `);

      // Log invoice creation in system logs
      const logPayload = JSON.stringify({ clientName, amount: amtVal, status });
      await runQuery(`
        INSERT INTO system_logs (user_id, action, severity, payload)
        VALUES ('${user.id}', 'Created Invoice', 'INFO', '${logPayload}'::jsonb);
      `);

      // Reload invoices
      const res = await runQuery("SELECT * FROM billing_invoices ORDER BY created_at DESC;");
      setInvoices(res.rows || []);
      setClientName("");
      setAmount("");
    } catch (err: any) {
      setError(err.message || "Failed to create invoice.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/5 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-brand-accent">
            Billing Operations Sandbox
          </h2>
          <p className="text-xs text-gray-400">
            Manage billing invoices, track payments, and verify automated database records.
          </p>
        </div>
        <div className="mt-2 sm:mt-0 text-right">
          <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-1 bg-[#2563eb]/20 text-blue-400 rounded-full border border-blue-500/30">
            Isolated Sub-App
          </span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-mono">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Create Invoice Panel */}
        <div className="p-6 rounded-2xl bg-surface-card border border-white/5 shadow-md h-fit">
          <h3 className="font-bold text-sm mb-4">Generate New Invoice</h3>
          <form onSubmit={handleCreateInvoice} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Client Name</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Initech LLC"
                className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">
                Amount ($ USD)
              </label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">
                Initial Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
              >
                <option value="pending">Pending Payment</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-gradient-to-r from-[#2563eb] to-[#ff007f] text-white text-xs font-bold rounded-lg shadow-md hover:from-blue-600 hover:to-pink-600 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                "Create Invoice Record"
              )}
            </button>
          </form>
        </div>

        {/* Invoices List */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-surface-card border border-white/5 shadow-md">
          <h3 className="font-bold text-sm mb-4">Invoice Ledger</h3>
          {loading && invoices.length === 0 ? (
            <div className="flex justify-center items-center py-12">
              <span className="w-6 h-6 border-2 border-[#2563eb] border-t-transparent rounded-full animate-spin"></span>
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-xs italic border border-dashed border-white/10 rounded-xl">
              No invoices created yet. Fill the form to create the first invoice.
            </div>
          ) : (
            <div className="overflow-x-auto border border-white/5 rounded-xl">
              <table className="min-w-full divide-y divide-white/5 text-left text-xs">
                <thead className="bg-white/5 text-gray-300 font-mono">
                  <tr>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created By</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-400">
                  {invoices.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-semibold text-text-primary">
                        {inv.client_name}
                      </td>
                      <td className="px-4 py-3 font-mono">${parseFloat(inv.amount).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.status === "paid"
                              ? "bg-success/20 text-success"
                              : inv.status === "overdue"
                                ? "bg-danger/20 text-danger"
                                : "bg-warning/20 text-warning-text"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[10px]">{inv.created_by}</td>
                      <td className="px-4 py-3 text-[10px] font-mono">
                        {new Date(inv.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
