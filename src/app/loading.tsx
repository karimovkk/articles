import { Spinner } from "@/components/ui";

export default function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center text-muted">
      <Spinner />
    </div>
  );
}
