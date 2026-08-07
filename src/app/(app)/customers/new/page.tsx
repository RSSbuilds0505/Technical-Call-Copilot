import { CustomerForm } from "@/components/CustomerForm";

export default function NewCustomerPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">New customer workspace</h1>
      <CustomerForm />
    </div>
  );
}
