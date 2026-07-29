interface Step {
  id: number;
  label: string;
}

interface StepIndicatorProps {
  steps: Step[];
  current: number;
}

/** Linear step progress indicator for the tokenize wizard. */
export function StepIndicator({ steps, current }: StepIndicatorProps) {
  return (
    <nav aria-label="Wizard progress" className="mb-8">
      <ol className="flex items-center gap-0">
        {steps.map((step, i) => {
          const done = step.id < current;
          const active = step.id === current;
          return (
            <li key={step.id} className="flex flex-1 items-center">
              {/* Node */}
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                    done
                      ? "border-brand-500 bg-brand-500 text-base-950"
                      : active
                        ? "border-brand-500 bg-transparent text-brand-300"
                        : "border-white/10 bg-transparent text-base-100/30"
                  }`}
                  aria-current={active ? "step" : undefined}
                >
                  {done ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    step.id
                  )}
                </div>
                <span
                  className={`mt-1.5 hidden text-[11px] font-medium sm:block ${
                    active ? "text-brand-300" : done ? "text-base-100/60" : "text-base-100/30"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {/* Connector line (not after last) */}
              {i < steps.length - 1 && (
                <div
                  className={`mx-2 mb-5 h-px flex-1 transition-colors ${
                    done ? "bg-brand-500/60" : "bg-white/10"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
