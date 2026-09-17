import { useState, useEffect } from "react";
import { api } from "../api/client";
import type { HistoryDose, Medication } from "../api/client";

export default function History() {
  const [logs, setLogs] = useState<HistoryDose[]>([]);
  const [meds, setMeds] = useState<Medication[]>([]);
  const [selectedMed, setSelectedMed] = useState<string>("");
  const [loading, setLoading] = useState(true);

  async function loadHistory() {
    setLoading(true);
    try {
      const params: { medId?: number } = {};
      if (selectedMed) params.medId = Number(selectedMed);
      const [history, medications] = await Promise.all([
        api.getHistory(params),
        meds.length ? Promise.resolve(meds) : api.getMedications(),
      ]);
      setLogs(history);
      if (!meds.length) setMeds(medications);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, [selectedMed]);

  const takenCount = logs.filter((l) => l.status === "taken").length;
  const missedCount = logs.filter((l) => l.status === "missed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Dose History</h2>
        <select
          value={selectedMed}
          onChange={(e) => setSelectedMed(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="">All medications</option>
          {meds.map((med) => (
            <option key={med.id} value={med.id}>
              {med.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{takenCount}</p>
          <p className="text-sm text-green-600">Taken</p>
        </div>
        <div className="flex-1 bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-700">{missedCount}</p>
          <p className="text-sm text-red-600">Missed</p>
        </div>
        <div className="flex-1 bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">
            {takenCount + missedCount > 0
              ? Math.round((takenCount / (takenCount + missedCount)) * 100)
              : 0}
            %
          </p>
          <p className="text-sm text-blue-600">Adherence</p>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500 text-center py-8">Loading...</p>
      ) : logs.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No history yet</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Date</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Medication</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Dosage</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Time</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(log.scheduledAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {log.medicationName}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{log.dosage}</td>
                  <td className="px-4 py-3 text-gray-600">{log.scheduleLabel}</td>
                  <td className="px-4 py-3">
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
