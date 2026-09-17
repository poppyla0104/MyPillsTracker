/**
 * Add Medication form page.
 * Dynamically generates schedule time/label rows when the frequency changes.
 * Uses sensible defaults (08:00 morning, 12:00 afternoon, 18:00 evening, etc.).
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";

const DEFAULT_TIMES = ["08:00", "12:00", "18:00", "22:00", "06:00", "14:00"];
const DEFAULT_LABELS = ["morning", "afternoon", "evening", "bedtime", "early morning", "midday"];

export default function AddMed() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState(1);
  const [totalPillCount, setTotalPillCount] = useState(30);
  const [schedules, setSchedules] = useState([
    { timeOfDay: "08:00", label: "morning" },
  ]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Regenerate schedule rows with sensible defaults when frequency changes
  function handleFrequencyChange(newFreq: number) {
    setFrequency(newFreq);
    const newSchedules = Array.from({ length: newFreq }, (_, i) => ({
      timeOfDay: schedules[i]?.timeOfDay || DEFAULT_TIMES[i] || "12:00",
      label: schedules[i]?.label || DEFAULT_LABELS[i] || `dose ${i + 1}`,
    }));
    setSchedules(newSchedules);
  }

  function updateSchedule(index: number, field: "timeOfDay" | "label", value: string) {
    setSchedules((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.createMedication({
        name,
        dosage,
        frequency,
        totalPillCount,
        schedules,
      });
      navigate("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Add Medication</h2>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Medication Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Metformin"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dosage
          </label>
          <input
            type="text"
            value={dosage}
            onChange={(e) => setDosage(e.target.value)}
            placeholder="e.g. 500mg"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Times per Day
            </label>
            <select
              value={frequency}
              onChange={(e) => handleFrequencyChange(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}x daily
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total Pill Count
            </label>
            <input
              type="number"
              value={totalPillCount}
              onChange={(e) => setTotalPillCount(Number(e.target.value))}
              min={1}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Schedule
          </label>
          <div className="space-y-3">
            {schedules.map((s, i) => (
              <div key={i} className="flex gap-3">
                <input
                  type="time"
                  value={s.timeOfDay}
                  onChange={(e) => updateSchedule(i, "timeOfDay", e.target.value)}
                  required
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <input
                  type="text"
                  value={s.label}
                  onChange={(e) => updateSchedule(i, "label", e.target.value)}
                  placeholder="Label (e.g. morning)"
                  required
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {loading ? "Adding..." : "Add Medication"}
          </button>
        </div>
      </form>
    </div>
  );
}
