import React from 'react';
import { Loader2, CheckCircle2, XCircle, Circle } from 'lucide-react';

export interface ProgressStep {
  step: number;
  totalSteps: number;
  message: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
}

interface ProgressBarProps {
  progress: ProgressStep;
  className?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, className = '' }) => {
  const { step, totalSteps, message, status } = progress;
  const percentage = (step / totalSteps) * 100;

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'in-progress':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <Circle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'in-progress':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Progress Bar Container */}
      <div className="relative w-full h-3 bg-slate-700 rounded-full overflow-hidden">
        {/* Progress Fill */}
        <div
          className={`h-full transition-all duration-500 ease-out ${getStatusColor()} ${
            status === 'in-progress' ? 'progress-shimmer' : ''
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Status Message */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="text-sm text-slate-300">{message}</span>
        </div>
        <span className="text-xs text-slate-400">
          Step {step} of {totalSteps}
        </span>
      </div>

      {/* Step Indicators */}
      <div className="mt-4 flex justify-between">
        {Array.from({ length: totalSteps }, (_, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < step && status !== 'error';
          const isCurrent = stepNumber === step && status !== 'error';
          const isError = status === 'error';

          return (
            <div
              key={stepNumber}
              className="flex flex-col items-center gap-1"
              style={{ width: `${100 / totalSteps}%` }}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
                  isError
                    ? 'bg-red-500 text-white'
                    : isCompleted
                    ? 'bg-green-500 text-white'
                    : isCurrent
                    ? 'bg-blue-500 text-white animate-pulse'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                {isError ? (
                  <XCircle className="w-4 h-4" />
                ) : isCompleted ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  stepNumber
                )}
              </div>
              <span className="text-xs text-slate-400 text-center">
                {getStepLabel(stepNumber)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Helper function to get step labels
const getStepLabel = (step: number): string => {
  const labels: Record<number, string> = {
    1: 'Initialize',
    2: 'Connect',
    3: 'Authenticate',
    4: 'Validate',
    5: 'Complete',
  };
  return labels[step] || `Step ${step}`;
};

export default ProgressBar;

// Made with Bob
