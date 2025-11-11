import { CheckCircle, Circle, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepNavigationCardsProps {
  currentStep: number;
  totalSteps: number;
  completedSteps: number[];
  onStepClick: (step: number) => void;
  canAccessStep: (step: number) => boolean;
}

const stepTitles = [
  'Personal Information',
  'Availability',
  'Emergency Contact',
  'Employment History',
  'References',
  'Skills & Experience',
  'Declaration',
  'Terms & Policy'
];

const stepIcons = ['👤', '📅', '🆘', '💼', '📝', '⚡', '✍️', '📋'];

export function StepNavigationCards({
  currentStep,
  totalSteps,
  completedSteps,
  onStepClick,
  canAccessStep
}: StepNavigationCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        const isCompleted = completedSteps.includes(step);
        const isCurrent = step === currentStep;
        const canAccess = canAccessStep(step);
        const isLocked = !canAccess && step > currentStep;

        return (
          <button
            key={step}
            onClick={() => canAccess && onStepClick(step)}
            disabled={!canAccess}
            className={cn(
              "relative p-3 rounded-lg border-2 transition-all duration-200",
              "flex flex-col items-center justify-center gap-2 min-h-[100px]",
              "hover:shadow-md active:scale-95",
              isCurrent && "border-primary bg-primary/5 shadow-md scale-105",
              isCompleted && !isCurrent && "border-green-500 bg-green-50",
              !isCompleted && !isCurrent && canAccess && "border-border bg-card hover:border-primary/50",
              isLocked && "border-border bg-muted opacity-60 cursor-not-allowed hover:shadow-none"
            )}
          >
            {/* Step Number/Icon */}
            <div className={cn(
              "text-2xl mb-1",
              isCurrent && "animate-pulse"
            )}>
              {stepIcons[i]}
            </div>

            {/* Title */}
            <div className={cn(
              "text-xs font-medium text-center leading-tight",
              isCurrent && "text-primary font-bold",
              isCompleted && !isCurrent && "text-green-700",
              isLocked && "text-muted-foreground"
            )}>
              {stepTitles[i]}
            </div>

            {/* Status Badge */}
            <div className="absolute top-1 right-1">
              {isCompleted && !isCurrent && (
                <CheckCircle className="w-4 h-4 text-green-500 fill-green-100" />
              )}
              {isCurrent && (
                <Circle className="w-4 h-4 text-primary fill-primary" />
              )}
              {isLocked && (
                <Lock className="w-3 h-3 text-muted-foreground" />
              )}
            </div>

            {/* Step Number */}
            <div className={cn(
              "absolute bottom-1 left-1 text-[10px] font-bold",
              isCurrent && "text-primary",
              isCompleted && !isCurrent && "text-green-600",
              isLocked && "text-muted-foreground"
            )}>
              {step}/{totalSteps}
            </div>
          </button>
        );
      })}
    </div>
  );
}
