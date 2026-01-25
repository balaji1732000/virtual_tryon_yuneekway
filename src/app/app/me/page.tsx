import { Suspense } from "react";
import MyProfileClient from "./MyProfileClient";

export default function MyProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center opacity-70">Loading…</div>}>
      <MyProfileClient />
    </Suspense>
  );
}


