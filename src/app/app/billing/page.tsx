import Billing from "@/components/Billing";

export default function BillingPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Billing</h1>
      <p className="text-sm opacity-70">Manage your subscription and monthly credits.</p>
      <Billing />
    </div>
  );
}




