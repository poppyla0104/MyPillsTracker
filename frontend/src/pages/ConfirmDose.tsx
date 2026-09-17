import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";

export default function ConfirmDose() {
  const { logId } = useParams<{ logId: string }>();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    api
      .confirmDose(Number(logId))
      .then((result) => {
        setStatus("success");
        setMessage(
          result.refillWarning
            ? "Dose confirmed! Heads up: you're running low on this medication."
            : "Dose confirmed!"
        );
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.message);
      });
  }, [logId]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        {status === "loading" && <p className="text-gray-500">Confirming dose...</p>}
        {status === "success" && (
          <>
            <div className="text-5xl mb-4">&#10003;</div>
            <p className="text-lg font-semibold text-green-700 mb-2">{message}</p>
            <Link to="/" className="text-blue-600 hover:underline text-sm">
              Go to Dashboard
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <p className="text-lg font-semibold text-red-700 mb-2">{message}</p>
            <Link to="/" className="text-blue-600 hover:underline text-sm">
              Go to Dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
