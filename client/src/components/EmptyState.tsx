import { LockIcon } from "@/components";

export const EmptyState = () => (
  <div className="card text-center py-10">
    <div className="mb-3 opacity-40">
      <LockIcon />
    </div>
    <h4 className="text-ink-soft">No current unlock challenges available!</h4>
    <p className="text-sm text-ink-soft mt-1">Check back later for the next drop.</p>
  </div>
);

export default EmptyState;
