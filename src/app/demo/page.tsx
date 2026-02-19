import { DemoRunner } from "./demo-runner";

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-sm border max-w-2xl w-full p-8">
        <h1 className="text-2xl font-bold mb-2">Core Matching Test Mode</h1>
        <p className="text-sm text-gray-600 mb-6">
          This bypasses signup, payments, and auto-filing. It runs the active-cases
          scrape for top settlement administrators, seeds demo transaction history,
          and executes the matching engine so you can validate end-to-end claim finding.
        </p>
        <DemoRunner />
      </div>
    </div>
  );
}
