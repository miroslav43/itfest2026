"use client";

import { useState } from "react";
import { Button, Logo } from "@/components/ui";

const STEPS = [
  {
    icon: (
      <svg className="w-10 h-10 text-accent-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M12 2v20M8 6l4-4 4 4" />
      </svg>
    ),
    title: "Bun venit la Solemtrix",
    text: "Platformă pentru îngrijitori care permite urmărirea în timp real a bastonului inteligent al persoanei nevăzătoare.",
  },
  {
    icon: (
      <svg className="w-10 h-10 text-success-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
    title: "Urmărire în timp real",
    text: "Vizualizezi pe hartă poziția actuală a bastonului, împreună cu ora ultimei actualizări și starea conexiunii.",
  },
  {
    icon: (
      <svg className="w-10 h-10 text-warning-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v-2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
    title: "Gestionare utilizatori",
    text: "Adaugă utilizatori nevăzători și gestionează destinațiile lor. Bastonul se creează automat la înregistrare.",
  },
  {
    icon: (
      <svg className="w-10 h-10 text-accent-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    title: "Ești gata",
    text: "Totul este configurat. Poți adăuga primul tău utilizator nevăzător și începe urmărirea. Mult succes!",
  },
];

interface Props {
  onClose: () => void;
}

export default function OnboardingModal({ onClose }: Props) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function handleNext() {
    if (isLast) {
      localStorage.setItem("solemtrix_onboarding_done", "true");
      onClose();
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-surface-100 border border-white/[0.06] rounded-3xl p-10 w-full max-w-sm text-center shadow-2xl animate-slide-up">
        {step === 0 && (
          <div className="mb-6 flex justify-center">
            <Logo size="md" />
          </div>
        )}

        <div className="flex justify-center mb-6">{current.icon}</div>
        <h2 className="text-xl font-bold text-slate-100 mb-3">{current.title}</h2>
        <p className="text-slate-400 text-sm leading-relaxed mb-8">{current.text}</p>

        {/* Progress */}
        <div className="flex justify-center gap-2 mb-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === step ? "w-6 bg-accent-500" : "w-2 bg-surface-300"
              }`}
            />
          ))}
        </div>

        <Button onClick={handleNext} size="lg" className="w-full">
          {isLast ? "Începe" : "Continuă"}
        </Button>
      </div>
    </div>
  );
}
