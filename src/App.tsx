import { useState, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Sparkles,
  Shield,
  Zap,
  FileImage,
  Upload,
} from 'lucide-react';
import { documentTypes, type DocumentType, type AgencySpec } from './data/specifications';
import { ProcessorPage } from './components/ProcessorPage';

type Step = 'select-doc' | 'select-agency' | 'process';

export default function App() {
  const [step, setStep] = useState<Step>('select-doc');
  const [selectedDoc, setSelectedDoc] = useState<DocumentType | null>(null);
  const [selectedAgency, setSelectedAgency] = useState<AgencySpec | null>(null);

  const handleSelectDoc = useCallback((doc: DocumentType) => {
    if (!doc.available) return;
    setSelectedDoc(doc);
    setStep('select-agency');
  }, []);

  const handleSelectAgency = useCallback((agency: AgencySpec) => {
    setSelectedAgency(agency);
    setStep('process');
  }, []);

  const handleBack = useCallback(() => {
    if (step === 'process') {
      setStep('select-agency');
      setSelectedAgency(null);
    } else if (step === 'select-agency') {
      setStep('select-doc');
      setSelectedDoc(null);
    }
  }, [step]);

  const handleStartOver = useCallback(() => {
    setStep('select-doc');
    setSelectedDoc(null);
    setSelectedAgency(null);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster
        position="top-center"
        toastOptions={{
          className: 'custom-toast',
          duration: 3000,
          style: {
            borderRadius: '12px',
            fontSize: '14px',
            padding: '12px 16px',
          },
          success: {
            iconTheme: { primary: '#10B981', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: '#EF4444', secondary: '#fff' },
          },
        }}
      />

      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-slate-200/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {step !== 'select-doc' && (
              <button
                onClick={handleBack}
                className="p-2 -ml-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={handleStartOver}
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                <FileImage size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-800 leading-tight">
                  DocReady
                </h1>
                <p className="text-[10px] text-slate-400 leading-tight -mt-0.5">
                  Gov Document Formatter
                </p>
              </div>
            </div>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-1 sm:gap-2">
            <StepDot active={true} done={step !== 'select-doc'} label="Document" />
            <ChevronRight size={14} className="text-slate-300" />
            <StepDot
              active={step !== 'select-doc'}
              done={step === 'process'}
              label="Agency"
            />
            <ChevronRight size={14} className="text-slate-300" />
            <StepDot active={step === 'process'} done={false} label="Process" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        {step === 'select-doc' && (
          <LandingPage onSelectDoc={handleSelectDoc} />
        )}
        {step === 'select-agency' && selectedDoc && (
          <AgencyPage
            doc={selectedDoc}
            onSelectAgency={handleSelectAgency}
          />
        )}
        {step === 'process' && selectedDoc && selectedAgency && (
          <ProcessorPage
            doc={selectedDoc}
            agency={selectedAgency}
            onStartOver={handleStartOver}
          />
        )}
      </main>
    </div>
  );
}

// ─── Step Dot ───────────────────────────────────────────────────────────────

function StepDot({
  active,
  done,
  label,
}: {
  active: boolean;
  done: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300 ${
          done
            ? 'bg-emerald-500 text-white'
            : active
            ? 'bg-indigo-500 text-white'
            : 'bg-slate-200 text-slate-400'
        }`}
      >
        {done ? <Check size={12} /> : active ? '●' : '○'}
      </div>
      <span
        className={`text-xs font-medium hidden sm:block transition-colors ${
          active ? 'text-slate-700' : 'text-slate-400'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

// ─── Landing Page ───────────────────────────────────────────────────────────

function LandingPage({ onSelectDoc }: { onSelectDoc: (doc: DocumentType) => void }) {
  return (
    <div className="page-enter">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700">
        {/* Background decoration */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
          <div className="text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/90 text-sm mb-6">
              <Sparkles size={14} />
              <span>Auto-format • Auto-compress • Zero rejections</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-4 leading-tight">
              Gov documents,
              <br />
              <span className="text-indigo-200">exactly as required</span>
            </h2>
            <p className="text-base sm:text-lg text-indigo-100/80 mb-8 leading-relaxed">
              Upload any photo, signature, or document — we auto-resize, compress,
              and convert to the exact format, dimensions, and file size your
              government portal demands. No more rejections.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap justify-center gap-3">
              <FeaturePill icon={<Zap size={14} />} text="Auto-resize to exact pixels" />
              <FeaturePill icon={<Shield size={14} />} text="100% browser-based, private" />
              <FeaturePill icon={<Upload size={14} />} text="Drag & drop upload" />
            </div>
          </div>
        </div>
      </div>

      {/* Document Type Selection */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="text-center mb-8">
          <h3 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2">
            Select your document type
          </h3>
          <p className="text-slate-500">
            Choose which government document you're applying for
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 max-w-4xl mx-auto">
          {documentTypes.map((doc, index) => (
            <button
              key={doc.id}
              onClick={() => onSelectDoc(doc)}
              disabled={!doc.available}
              className={`animate-fade-in-up group relative p-5 rounded-2xl border-2 text-left transition-all duration-300 ${
                doc.available
                  ? 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-100/50 hover:-translate-y-1 cursor-pointer'
                  : 'border-slate-100 bg-slate-50/50 cursor-not-allowed opacity-60'
              }`}
              style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'both' }}
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-3xl">{doc.icon}</span>
                {doc.available ? (
                  <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-600 rounded-full">
                    Available
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-400 rounded-full">
                    Coming Soon
                  </span>
                )}
              </div>
              <h4 className="font-bold text-slate-800 mb-0.5">{doc.name}</h4>
              <p className="text-xs text-slate-400 mb-1">{doc.nameHi}</p>
              <p className="text-sm text-slate-500 leading-relaxed">{doc.description}</p>
              {doc.available && (
                <div className="mt-3 flex items-center text-sm font-medium text-indigo-500 group-hover:text-indigo-600 transition-colors">
                  Get started
                  <ArrowRight
                    size={14}
                    className="ml-1 group-hover:translate-x-1 transition-transform"
                  />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="bg-white border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <h3 className="text-xl font-bold text-slate-800 text-center mb-8">
            How it works
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <HowItWorksStep
              number="1"
              title="Select & Upload"
              description="Choose your document type & agency, then upload your files — any format works"
            />
            <HowItWorksStep
              number="2"
              title="Auto-Process"
              description="We resize, compress & convert to exact specs — pixels, DPI, format, file size"
            />
            <HowItWorksStep
              number="3"
              title="Download & Submit"
              description="Download perfectly formatted files ready for direct upload to the portal"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FeaturePill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-white/90 text-sm">
      {icon}
      <span>{text}</span>
    </div>
  );
}

function HowItWorksStep({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 font-bold text-lg flex items-center justify-center mx-auto mb-3">
        {number}
      </div>
      <h4 className="font-semibold text-slate-800 mb-1">{title}</h4>
      <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
    </div>
  );
}

// ─── Agency Selection Page ──────────────────────────────────────────────────

function AgencyPage({
  doc,
  onSelectAgency,
}: {
  doc: DocumentType;
  onSelectAgency: (agency: AgencySpec) => void;
}) {
  return (
    <div className="page-enter max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <div className="text-center mb-8">
        <span className="text-4xl mb-3 block">{doc.icon}</span>
        <h3 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2">
          {doc.name} — Select Agency
        </h3>
        <p className="text-slate-500">
          Which portal are you applying through? Each has different requirements.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl mx-auto">
        {doc.agencies.map((agency, index) => (
          <button
            key={agency.id}
            onClick={() => onSelectAgency(agency)}
            className={`animate-fade-in-up group p-6 rounded-2xl border-2 ${agency.borderColor} bg-white hover:shadow-lg hover:-translate-y-1 transition-all duration-300 text-left`}
            style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'both' }}
          >
            <div className={`inline-flex px-3 py-1 rounded-lg ${agency.bgColor} ${agency.color} font-bold text-lg mb-3`}>
              {agency.name}
            </div>
            <p className="text-sm text-slate-500 mb-4">{agency.fullName}</p>

            {/* Quick specs preview */}
            <div className="space-y-2 mb-4">
              <SpecPreview
                label="Photo"
                value={`${agency.requirements.photo.widthPx}×${agency.requirements.photo.heightPx}px · ${agency.requirements.photo.dpi} DPI · ≤${agency.requirements.photo.maxSizeKB}KB`}
              />
              <SpecPreview
                label="Signature"
                value={`${agency.requirements.signature.widthPx}×${agency.requirements.signature.heightPx}px · ${agency.requirements.signature.dpi} DPI · ≤${agency.requirements.signature.maxSizeKB}KB`}
              />
              <SpecPreview
                label="Documents"
                value={`${agency.requirements.documents.formatLabel} · ≤${agency.requirements.documents.maxSizeMB}MB`}
              />
            </div>

            <div className="flex items-center text-sm font-medium text-indigo-500 group-hover:text-indigo-600 transition-colors">
              Select {agency.name}
              <ArrowRight
                size={14}
                className="ml-1 group-hover:translate-x-1 transition-transform"
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function SpecPreview({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-slate-400 font-medium min-w-[72px]">{label}:</span>
      <span className="text-slate-600 text-xs leading-relaxed">{value}</span>
    </div>
  );
}
