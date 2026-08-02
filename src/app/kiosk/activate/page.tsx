"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function KioskActivateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get("code") || "";

  const [code, setCode] = useState(codeFromUrl);
  const [status, setStatus] = useState<"idle" | "activating" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const hasTriggeredActivation = useRef(false);

  const handleActivate = useCallback(async (activationCode: string) => {
    if (!activationCode.trim()) {
      setErrorMessage("Please enter an activation code");
      return;
    }

    setStatus("activating");
    setErrorMessage("");

    try {
      const response = await fetch("/api/kiosk/activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: activationCode.trim() }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setStatus("error");
        setErrorMessage(data.error || "Activation failed");
        return;
      }

      setStatus("success");

      // Redirect to the device kiosk page after a short delay
      setTimeout(() => {
        router.push("/kiosk/device");
      }, 1500);
    } catch (error) {
      console.error("Activation error:", error);
      setStatus("error");
      setErrorMessage("An error occurred during activation");
    }
  }, [router]);

  // Auto-activate if code is in URL - use ref to prevent cascading renders
  useEffect(() => {
    if (codeFromUrl && !hasTriggeredActivation.current) {
      hasTriggeredActivation.current = true;
      // Use setTimeout to defer the state update outside the effect
      const timer = setTimeout(() => {
        handleActivate(codeFromUrl);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [codeFromUrl, handleActivate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleActivate(code);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Kiosk Activation
            </h1>
            <p className="text-gray-600 mt-2">
              Enter your activation code to set up this kiosk device
            </p>
          </div>

          {status === "success" ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                Activation Successful!
              </h2>
              <p className="text-gray-600 mt-2">
                Redirecting to kiosk...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <label
                  htmlFor="code"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Activation Code
                </label>
                <input
                  type="text"
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Enter 8-character code"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-xl tracking-widest font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  maxLength={8}
                  disabled={status === "activating"}
                />
              </div>

              {errorMessage && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600 text-center">
                    {errorMessage}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={status === "activating" || !code.trim()}
                className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === "activating" ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Activating...
                  </span>
                ) : (
                  "Activate Device"
                )}
              </button>
            </form>
          )}

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>
              This device will be securely bound to your kiosk after activation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-blue-600 animate-pulse"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Loading...
            </h1>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function KioskActivatePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <KioskActivateForm />
    </Suspense>
  );
}