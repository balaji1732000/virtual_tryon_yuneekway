import { Suspense } from "react";
import OnboardingClient from "./OnboardingClient";

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center opacity-70">Loading…</div>}>
      <OnboardingClient />
    </Suspense>
  );
}


