"use client";

import { useState } from "react";

const STEPS = [
  {
    icon: "🦯",
    title: "Bun venit la Solemtrix",
    text: "Solemtrix este o aplicație pentru îngrijitori care le permite să urmărească în timp real locația bastonului inteligent al persoanei nevăzătoare.",
  },
  {
    icon: "📍",
    title: "Urmărire în timp real",
    text: "De fiecare dată când deschizi aplicația, vei vedea pe hartă poziția actuală a bastonului, împreună cu ora ultimei actualizări.",
  },
  {
    icon: "🔗",
    title: "Asociere prin cod QR",
    text: "Pentru a lega un baston nou la contul tău, scanează codul QR de pe baston sau introdu manual codul de înrolare din panoul lateral.",
  },
  {
    icon: "✅",
    title: "Ești gata",
    text: "Totul este configurat. Poți adăuga primul tău baston apăsând butonul + din bara laterală. Mult succes!",
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm text-center shadow-2xl">
        <div className="text-5xl mb-4">{current.icon}</div>
        <h2 className="text-xl font-bold text-blue-800 mb-3">{current.title}</h2>
        <p className="text-gray-500 text-sm leading-relaxed mb-6">{current.text}</p>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-6">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === step ? "bg-blue-600" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors text-sm"
        >
          {isLast ? "Începe" : "Continuă"}
        </button>
      </div>
    </div>
  );
}
