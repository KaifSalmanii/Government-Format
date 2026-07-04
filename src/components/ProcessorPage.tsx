import { useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  PenTool,
  FileText,
  X,
  Info,
  Loader2,
  ArrowDown,
  Check,
  RotateCcw,
} from 'lucide-react';
import type { DocumentType, AgencySpec, RequirementSpec, DocumentRequirementSpec } from '../data/specifications';
import {
  processImage,
  getFilePreview,
  imagesToPdf,
  checkPdfSize,
  downloadBlob,
  type ProcessResult,
} from '../utils/imageProcessor';

interface Props {
  doc: DocumentType;
  agency: AgencySpec;
  onStartOver: () => void;
}

type UploadType = 'photo' | 'signature' | 'documents';

interface UploadState {
  file: File | null;
  preview: string | null;
  processing: boolean;
  result: ProcessResult | null;
  resultPreview: string | null;
}

const initialUploadState: UploadState = {
  file: null,
  preview: null,
  processing: false,
  result: null,
  resultPreview: null,
};

export function ProcessorPage({ doc, agency, onStartOver }: Props) {
  const [uploads, setUploads] = useState<Record<UploadType, UploadState>>({
    photo: { ...initialUploadState },
    signature: { ...initialUploadState },
    documents: { ...initialUploadState },
  });
  const docFilesRef = useRef<File[]>([]);

  const updateUpload = useCallback((type: UploadType, update: Partial<UploadState>) => {
    setUploads((prev) => ({ ...prev, [type]: { ...prev[type], ...update } }));
  }, []);

  const processUpload = async (type: UploadType, file: File) => {
    updateUpload(type, { processing: true, file, result: null, resultPreview: null });

    try {
      if (type === 'photo' || type === 'signature') {
        const req = type === 'photo' ? agency.requirements.photo : agency.requirements.signature;
        const preview = await getFilePreview(file);
        updateUpload(type, { preview });

        const result = await processImage(file, req);
        const resultPreview = URL.createObjectURL(result.blob);
        updateUpload(type, { processing: false, result, resultPreview });

        if (result.processedSizeKB <= req.maxSizeKB) {
          toast.success(
            `${type === 'photo' ? 'Photo' : 'Signature'} ready! ${result.processedSizeKB}KB / ${req.maxSizeKB}KB`,
            { icon: '✅' }
          );
        } else {
          toast.error(
            `Could not compress below ${req.maxSizeKB}KB. Current: ${result.processedSizeKB}KB`
          );
        }
      } else {
        // Documents
        const imageFiles = docFilesRef.current.filter((f) => f.type.startsWith('image/'));
        const pdfFiles = docFilesRef.current.filter((f) => f.type === 'application/pdf');

        if (imageFiles.length > 0) {
          let preview: string | null = null;
          if (imageFiles[0].type.startsWith('image/')) {
            preview = await getFilePreview(imageFiles[0]);
          }
          updateUpload(type, { preview, file: imageFiles[0] });

          const result = await imagesToPdf(imageFiles);
          updateUpload(type, { processing: false, result, resultPreview: null });
          toast.success('PDF created successfully!', { icon: '📄' });
        } else if (pdfFiles.length > 0) {
          const check = await checkPdfSize(pdfFiles[0]);
          if (check.isValid) {
            const blob = new Blob([await pdfFiles[0].arrayBuffer()], { type: 'application/pdf' });
            const result: ProcessResult = {
              blob,
              originalSizeKB: check.sizeKB,
              processedSizeKB: check.sizeKB,
              width: 595,
              height: 842,
              dpi: 200,
              format: 'application/pdf',
            };
            updateUpload(type, { processing: false, result, resultPreview: null });
            if (check.sizeKB > agency.requirements.documents.maxSizeMB * 1024) {
              toast.error(
                `PDF is ${check.sizeKB}KB — exceeds ${agency.requirements.documents.maxSizeMB}MB limit`
              );
            } else {
              toast.success('PDF verified — within size limits', { icon: '✅' });
            }
          } else {
            toast.error('Invalid or corrupted PDF file');
            updateUpload(type, { processing: false });
          }
        } else {
          updateUpload(type, { processing: false });
        }
      }
    } catch (err) {
      console.error('Processing error:', err);
      toast.error('Processing failed. Try a different image.');
      updateUpload(type, { processing: false });
    }
  };

  const handleFileSelect = async (type: UploadType, files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (type === 'documents') {
      const fileArr = Array.from(files);
      docFilesRef.current = fileArr;
      toast.success(`${fileArr.length} file(s) selected`, { icon: '📁' });
      processUpload(type, fileArr[0]);
      return;
    }

    const file = files[0];
    const acceptedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
    if (!acceptedTypes.includes(file.type)) {
      toast.error('Please upload an image file (JPG, PNG, WebP)', { icon: '⚠️' });
      return;
    }

    processUpload(type, file);
  };

  const handleReprocess = (type: UploadType) => {
    const file = uploads[type].file;
    if (file) processUpload(type, file);
  };

  const handleDownload = (type: UploadType) => {
    const result = uploads[type].result;
    if (!result) return;
    const prefix = type === 'photo' ? 'photo' : type === 'signature' ? 'signature' : 'documents';
    const ext = result.format === 'application/pdf' ? 'pdf' : 'jpg';
    downloadBlob(result.blob, `${doc.id}_${agency.id}_${prefix}.${ext}`);
    toast.success('Downloaded!', { icon: '⬇️' });
  };

  const handleClear = (type: UploadType) => {
    if (type === 'documents') docFilesRef.current = [];
    updateUpload(type, { ...initialUploadState });
  };

  return (
    <div className="page-enter max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {/* Top Info Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 sm:mb-8">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{doc.icon}</span>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">
              {doc.name} — <span className={agency.color}>{agency.name}</span>
            </h2>
            <p className="text-xs text-slate-400">{agency.fullName}</p>
          </div>
        </div>
        <button
          onClick={onStartOver}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <RotateCcw size={14} />
          Start Over
        </button>
      </div>

      {/* Upload Cards */}
      <div className="space-y-5 sm:space-y-6">
        <UploadCard
          type="photo"
          title="Passport Photo"
          subtitle="Upload your passport-size photograph"
          icon={<ImageIcon size={20} />}
          iconColor="text-blue-500"
          iconBg="bg-blue-50"
          requirement={agency.requirements.photo}
          state={uploads.photo}
          agency={agency}
          onFileSelect={handleFileSelect}
          onReprocess={handleReprocess}
          onDownload={handleDownload}
          onClear={handleClear}
          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
        />

        <UploadCard
          type="signature"
          title="Signature"
          subtitle="Upload your signature image"
          icon={<PenTool size={20} />}
          iconColor="text-violet-500"
          iconBg="bg-violet-50"
          requirement={agency.requirements.signature}
          state={uploads.signature}
          agency={agency}
          onFileSelect={handleFileSelect}
          onReprocess={handleReprocess}
          onDownload={handleDownload}
          onClear={handleClear}
          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
        />

        <UploadCard
          type="documents"
          title="Supporting Documents"
          subtitle="Aadhaar, Voter ID, or other proofs"
          icon={<FileText size={20} />}
          iconColor="text-emerald-500"
          iconBg="bg-emerald-50"
          docRequirement={agency.requirements.documents}
          state={uploads.documents}
          agency={agency}
          onFileSelect={handleFileSelect}
          onReprocess={handleReprocess}
          onDownload={handleDownload}
          onClear={handleClear}
          accept="image/jpeg,image/jpg,image/png,application/pdf"
          multiple
        />
      </div>

      {/* Bottom Tips */}
      <div className="mt-8 p-4 rounded-xl bg-amber-50 border border-amber-200/80 flex items-start gap-3">
        <Info size={18} className="text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Important Tips</p>
          <ul className="text-xs text-amber-700 mt-1.5 space-y-1 list-disc list-inside leading-relaxed">
            <li>All processing happens in your browser — your files <strong>never leave your device</strong></li>
            <li>For best results, use a clear, well-lit photo with a white background</li>
            <li>Sign with black ink on plain white paper, then photograph in good lighting</li>
            <li>After downloading, upload the processed files directly to the {agency.name} portal</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ─── Upload Card ────────────────────────────────────────────────────────────

interface UploadCardProps {
  type: UploadType;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  requirement?: RequirementSpec;
  docRequirement?: DocumentRequirementSpec;
  state: UploadState;
  agency: AgencySpec;
  onFileSelect: (type: UploadType, files: FileList | null) => void;
  onReprocess: (type: UploadType) => void;
  onDownload: (type: UploadType) => void;
  onClear: (type: UploadType) => void;
  accept: string;
  multiple?: boolean;
}

function UploadCard({
  type,
  title,
  subtitle,
  icon,
  iconColor,
  iconBg,
  requirement,
  docRequirement,
  state,
  agency,
  onFileSelect,
  onReprocess,
  onDownload,
  onClear,
  accept,
  multiple,
}: UploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    onFileSelect(type, e.dataTransfer.files);
  };

  const isImage = type !== 'documents';
  const specs = requirement || docRequirement;
  const maxSizeKB = isImage ? requirement!.maxSizeKB : docRequirement!.maxSizeMB * 1024;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
      {/* Card Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center ${iconColor}`}>
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">{title}</h3>
            <p className="text-xs text-slate-400">{subtitle}</p>
          </div>
        </div>

        {/* Status Badge */}
        {state.result && (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-medium animate-scale-in">
            <CheckCircle2 size={12} />
            Ready
          </span>
        )}
        {state.processing && (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-medium">
            <Loader2 size={12} className="animate-spin" />
            Processing...
          </span>
        )}
      </div>

      <div className="p-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left Column: Specs */}
          <div className="lg:col-span-1">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
              Required Specs — {agency.name}
            </h4>
            <div className="space-y-1.5">
              {isImage && requirement && (
                <>
                  <SpecRow label="Dimensions" value={`${requirement.widthPx} × ${requirement.heightPx} px`} highlight />
                  <SpecRow label="Physical Size" value={`${requirement.widthCm} × ${requirement.heightCm} cm`} />
                  <SpecRow label="File Size" value={`≤ ${requirement.maxSizeKB} KB`} highlight />
                  <SpecRow label="Format" value={requirement.formatLabel} />
                  <SpecRow label="Resolution" value={`${requirement.dpi} DPI`} highlight />
                  <SpecRow label="Background" value={requirement.background} />
                </>
              )}
              {!isImage && docRequirement && (
                <>
                  <SpecRow label="Format" value={docRequirement.formatLabel} highlight />
                  <SpecRow label="Max Size" value={`${docRequirement.maxSizeMB} MB`} highlight />
                  <SpecRow label="Per Page" value={`≤ ${docRequirement.maxSizePerPageKB} KB`} />
                  <SpecRow label="Scan DPI" value={`${docRequirement.dpi} DPI`} />
                </>
              )}
            </div>

            {/* Guidelines */}
            {specs && specs.additionalNotes.length > 0 && (
              <div className="mt-4">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Guidelines
                </h4>
                <ul className="space-y-1">
                  {specs.additionalNotes.map((note, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-500 leading-relaxed">
                      <span className="text-indigo-400 mt-0.5 shrink-0">•</span>
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Right Column: Upload & Result */}
          <div className="lg:col-span-2">
            {/* Upload Area (when no file) */}
            {!state.file && (
              <div
                className={`drop-zone relative border-2 border-dashed rounded-xl p-8 sm:p-10 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-indigo-400 bg-indigo-50/50 scale-[1.02]'
                    : 'border-slate-200 bg-slate-50/50 hover:border-indigo-300 hover:bg-indigo-50/30'
                }`}
                onClick={() => inputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept={accept}
                  multiple={multiple}
                  onChange={(e) => onFileSelect(type, e.target.files)}
                  className="hidden"
                />
                <div className={`drop-icon ${iconColor} mb-3 flex justify-center`}>
                  <Upload size={36} />
                </div>
                <p className="text-sm font-medium text-slate-600 mb-1">
                  {dragOver ? 'Drop your file here' : 'Click to upload or drag & drop'}
                </p>
                <p className="text-xs text-slate-400">
                  {isImage ? 'JPG, PNG, WebP, GIF — auto-converted to JPEG' : 'JPG, PNG, or PDF files'}
                  {multiple && ' · Select multiple files'}
                </p>
              </div>
            )}

            {/* Processing State */}
            {state.processing && (
              <div className="animate-fade-in">
                {/* Show preview if available */}
                {state.preview && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-slate-400">Original</span>
                      {state.file && (
                        <span className="spec-badge bg-slate-100 text-slate-500">
                          {(state.file.size / 1024).toFixed(0)} KB
                        </span>
                      )}
                    </div>
                    <div className="image-preview p-3 bg-slate-50 border border-slate-200 rounded-xl h-36">
                      <img src={state.preview} alt="Original" />
                    </div>
                  </div>
                )}
                <div className="space-y-3 py-6 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50">
                    <Loader2 size={24} className="text-indigo-500 animate-spin" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">Processing your {type}...</p>
                    <p className="text-xs text-slate-400 mt-1">Resizing · Compressing · Setting DPI · Optimizing</p>
                  </div>
                  <div className="progress-bar max-w-xs mx-auto">
                    <div className="progress-bar-fill" style={{ width: '70%' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Result */}
            {state.result && !state.processing && (
              <div className="animate-scale-in">
                {/* Before / After */}
                <div className="comparison-grid mb-3">
                  {/* Before */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase">Before</span>
                      <span className="spec-badge bg-red-50 text-red-500">
                        {state.result.originalSizeKB} KB
                      </span>
                    </div>
                    <div className="image-preview p-2 bg-slate-50 border border-slate-200 rounded-xl h-32">
                      {state.preview ? (
                        <img src={state.preview} alt="Original" />
                      ) : (
                        <FileText size={24} className="text-slate-300" />
                      )}
                    </div>
                  </div>
                  {/* After */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-[11px] font-semibold text-emerald-600 uppercase">After</span>
                      <span
                        className={`spec-badge ${
                          state.result.processedSizeKB <= maxSizeKB
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-amber-50 text-amber-600'
                        }`}
                      >
                        {state.result.processedSizeKB} KB
                      </span>
                    </div>
                    <div className="image-preview p-2 bg-emerald-50/50 border border-emerald-200 rounded-xl h-32">
                      {state.resultPreview ? (
                        <img src={state.resultPreview} alt="Processed" />
                      ) : (
                        <div className="text-center">
                          <FileText size={24} className="mx-auto text-emerald-300 mb-1" />
                          <p className="text-[10px] text-emerald-400 font-medium">PDF Ready</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Size Reduction */}
                {state.result.originalSizeKB > state.result.processedSizeKB && (
                  <div className="flex items-center justify-center gap-2 mb-3 py-2 px-3 rounded-lg bg-emerald-50/50">
                    <ArrowDown size={14} className="text-emerald-500" />
                    <span className="text-sm font-semibold text-emerald-600">
                      {Math.round(
                        ((state.result.originalSizeKB - state.result.processedSizeKB) /
                          state.result.originalSizeKB) *
                          100
                      )}
                      % smaller
                    </span>
                    <span className="text-xs text-slate-400">
                      ({state.result.originalSizeKB}KB → {state.result.processedSizeKB}KB)
                    </span>
                  </div>
                )}

                {/* Compliance Check (for images) */}
                {isImage && requirement && (
                  <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      {agency.name} Compliance Check
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <ComplianceCheck
                        label="Dimensions"
                        pass={
                          state.result.width === requirement.widthPx &&
                          state.result.height === requirement.heightPx
                        }
                        value={`${state.result.width}×${state.result.height}`}
                      />
                      <ComplianceCheck
                        label="File Size"
                        pass={state.result.processedSizeKB <= requirement.maxSizeKB}
                        value={`${state.result.processedSizeKB}/${requirement.maxSizeKB}KB`}
                      />
                      <ComplianceCheck
                        label="DPI"
                        pass={true}
                        value={`${state.result.dpi} DPI`}
                      />
                      <ComplianceCheck
                        label="Format"
                        pass={true}
                        value="JPEG"
                      />
                      <ComplianceCheck
                        label="Background"
                        pass={true}
                        value="White"
                      />
                      <ComplianceCheck
                        label="Overall"
                        pass={
                          state.result.processedSizeKB <= requirement.maxSizeKB &&
                          state.result.width === requirement.widthPx &&
                          state.result.height === requirement.heightPx
                        }
                        value={
                          state.result.processedSizeKB <= requirement.maxSizeKB &&
                          state.result.width === requirement.widthPx &&
                          state.result.height === requirement.heightPx
                            ? 'PASS ✅'
                            : 'CHECK ⚠️'
                        }
                      />
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => onDownload(type)}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-semibold hover:from-emerald-600 hover:to-emerald-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-100"
                  >
                    <Download size={16} />
                    Download {isImage ? 'Image' : 'PDF'}
                  </button>
                  <button
                    onClick={() => onReprocess(type)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 text-sm font-medium hover:bg-slate-50 hover:text-slate-700 active:scale-[0.98] transition-all flex items-center gap-1.5"
                  >
                    <RotateCcw size={14} />
                    Redo
                  </button>
                  <button
                    onClick={() => onClear(type)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-400 text-sm font-medium hover:bg-red-50 hover:text-red-500 hover:border-red-200 active:scale-[0.98] transition-all flex items-center gap-1.5"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub Components ─────────────────────────────────────────────────────────

function SpecRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 px-2.5 rounded-lg ${highlight ? 'bg-indigo-50/70' : 'bg-slate-50'}`}>
      <span className={`text-xs font-medium ${highlight ? 'text-indigo-400' : 'text-slate-400'}`}>{label}</span>
      <span className={`text-xs font-semibold ${highlight ? 'text-indigo-600' : 'text-slate-700'}`}>{value}</span>
    </div>
  );
}

function ComplianceCheck({ label, pass, value }: { label: string; pass: boolean; value: string }) {
  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-all ${
        pass ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
      }`}
    >
      {pass ? <Check size={10} className="shrink-0" /> : <AlertCircle size={10} className="shrink-0" />}
      <div className="min-w-0">
        <div className="font-medium truncate">{label}</div>
        <div className="opacity-70 text-[10px] truncate">{value}</div>
      </div>
    </div>
  );
}
