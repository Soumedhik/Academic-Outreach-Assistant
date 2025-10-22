import React from 'react';
import { Step } from '../types';
import { UploadIcon } from './icons/UploadIcon';
import { AcademicCapIcon } from './icons/AcademicCapIcon';
import { MailIcon } from './icons/MailIcon';

interface StepIndicatorProps {
  currentStep: Step;
}

const StepItem: React.FC<{ step: number; title: string; currentStep: number; icon: React.ReactNode }> = ({ step, title, currentStep, icon }) => {
  const isActive = currentStep === step;
  const isCompleted = currentStep > step;
  
  const circleClasses = isCompleted 
    ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg' 
    : isActive 
    ? 'border-2 border-indigo-500 bg-indigo-50 text-indigo-600 ring-4 ring-indigo-500/20 dark:border-indigo-400 dark:bg-slate-800 dark:text-indigo-400 dark:ring-indigo-400/20' 
    : 'border-2 border-slate-300 bg-white text-slate-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300';
    
  const textClasses = isCompleted || isActive ? 'text-indigo-600 font-semibold dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400';

  return (
    <div className="relative flex flex-col items-center">
      <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${circleClasses}`}>
        {isCompleted ? (
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
        ) : (
          <span>{icon}</span>
        )}
      </div>
      <p className={`mt-3 text-sm transition-colors duration-300 ${textClasses}`}>{title}</p>
    </div>
  );
};

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  const steps = [
    { number: 1, title: 'Details', icon: <UploadIcon /> },
    { number: 2, title: 'Select Contacts', icon: <AcademicCapIcon /> },
    { number: 3, title: 'Review & Send', icon: <MailIcon /> },
  ];

  return (
    <nav aria-label="Progress">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <React.Fragment key={step.number}>
            <StepItem step={step.number} title={step.title} currentStep={currentStep} icon={step.icon} />
            {index < steps.length - 1 && (
              <div className={`flex-1 h-1 mx-4 rounded-full ${currentStep > step.number ? 'bg-gradient-to-r from-indigo-600 to-purple-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
            )}
          </React.Fragment>
        ))}
      </div>
    </nav>
  );
};

export default StepIndicator;