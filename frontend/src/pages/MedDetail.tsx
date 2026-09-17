import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { MedicationDetail } from "../api/client";

export default function MedDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [med, setMed] = useState<MedicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRefill, setShowRefill] = useState(false);
  const [refillCount, setRefillCount] = useState(30);

  useEffect(() => {
    api
      .getMedication(Number(id))
      .then(setMed)
      .catch(() => navigate("/"))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleRefill() {
    if (!med) return;
    try {
      const updated = await api.refillMedication(med.id, refillCount);
      setMed((prev) =>
        prev
          ? {
              ...prev,
              remainingPillCount: updated.remainingPillCount,
              totalPillCount: updated.totalPillCount,
            }
          : prev
      );
      setShowRefill(false);
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleDelete() {
    if (!med || !confirm("Deactivate this medication?")) return;
    await api.deleteMedication(med.id);
    navigate("/");
  }

  if (loading || !med) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const pillPercent = Math.round(
    (med.remainingPillCount / med.totalPillCount) * 100
  );
  const daysLeft = Math.floor(med.remainingPillCount / med.frequency);
  const barColor =
    pillPercent > 50 ? "bg-green-500" : pillPercent > 20 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{med.name}</h2>
          <p className="text-gray-500">
            {med.dosage} - {med.frequency}x daily
          </p>
        </div>
        <button
          onClick={handleDelete}
          className="text-sm text-red-600 hover:text-red-700"
        >
          Deactivate
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Pills Remaining</span>
          <span className="text-sm text-gray-500">
            {med.remainingPillCount} / {med.totalPillCount} (~{daysLeft} days)
          </span>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${pillPercent}%` }}
          />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setShowRefill(!showRefill)}
            className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
          >
            Refill
          </button>
        </div>

        {showRefill && (
          <div className="mt-3 flex gap-2 items-center">
            <input
              type="number"
              value={refillCount}
              onChange={(e) => setRefillCount(Number(e.target.value))}
              min={1}
              className="w-24 px-3 py-1 border border-gray-300 rounded-lg text-sm"
            />
            <button
              onClick={handleRefill}
              className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              Update Count
            </button>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Schedule</h3>
        <div className="space-y-2">
          {med.schedules.map((s) => (
            <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <span className="font-mono text-sm text-gray-600">{s.timeOfDay}</span>
              <span className="text-sm text-gray-500 capitalize">{s.label}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${s.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {s.enabled ? "Active" : "Disabled"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Recent History</h3>
        {med.recentLogs.length === 0 ? (
          <p className="text-gray-500 text-sm">No dose history yet</p>
        ) : (
          <div className="space-y-2">
            {med.recentLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-600">
                  {new Date(log.scheduledAt).toLocaleString()}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    log.status === "taken"
                      ? "bg-green-100 text-green-700"
                      : log.status === "missed"
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {log.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
