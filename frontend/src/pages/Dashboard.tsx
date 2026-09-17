/**
 * Dashboard page showing today's medication schedule.
 * Displays pending/taken/missed dose cards with "Mark as Taken" buttons,
 * a refill warnings banner, and a dose counter. Polls every 30 seconds.
 */

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { TodayDose, Medication } from "../api/client";

export default function Dashboard() {
  const [doses, setDoses] = useState<TodayDose[]>([]);
  const [refills, setRefills] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      const [todayDoses, refillMeds] = await Promise.all([
        api.getTodayDoses(),
        api.getRefills(),
      ]);
      setDoses(todayDoses);
      setRefills(refillMeds);
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Confirm a dose, then refresh refill warnings if the pill count got low
  async function handleConfirm(logId: number) {
    try {
      const result = await api.confirmDose(logId);
      setDoses((prev) =>
        prev.map((d) =>
          d.id === logId ? { ...d, status: "taken", takenAt: new Date().toISOString() } : d
        )
      );
      if (result.refillWarning) {
        loadData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  }

  const taken = doses.filter((d) => d.status === "taken").length;
  const total = doses.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Refill warnings banner */}
      {refills.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="font-semibold text-amber-800 mb-2">Refill Needed</h3>
          {refills.map((med) => (
            <div key={med.id} className="flex items-center justify-between text-sm text-amber-700">
              <span>
                {med.name} - {med.remainingPillCount} pills left
                (~{Math.floor(med.remainingPillCount / med.frequency)} days)
              </span>
              <Link
                to={`/medications/${med.id}`}
                className="text-amber-800 underline hover:no-underline"
              >
                Refill
              </Link>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Today's Schedule</h2>
          <p className="text-sm text-gray-500">
            {taken} of {total} doses taken
          </p>
        </div>
        <Link
          to="/medications/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + Add Medication
        </Link>
      </div>

      {doses.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <p className="text-gray-500 mb-2">No doses scheduled for today</p>
          <Link to="/medications/new" className="text-blue-600 hover:underline text-sm">
            Add your first medication
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {doses.map((dose) => (
            <div
              key={dose.id}
              className={`flex items-center justify-between p-4 rounded-xl border ${
                dose.status === "taken"
                  ? "bg-green-50 border-green-200"
                  : dose.status === "missed"
                  ? "bg-red-50 border-red-200"
                  : "bg-white border-gray-200"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="text-sm font-mono text-gray-500 w-14">
                  {dose.scheduleTime}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{dose.medicationName}</p>
                  <p className="text-sm text-gray-500">
                    {dose.dosage} - {dose.scheduleLabel}
                  </p>
                </div>
              </div>

              <div>
                {dose.status === "pending" && (
                  <button
                    onClick={() => handleConfirm(dose.id)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                  >
                    Mark as Taken
                  </button>
                )}
                {dose.status === "taken" && (
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                    Taken
                  </span>
                )}
                {dose.status === "missed" && (
                  <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                    Missed
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
