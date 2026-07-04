import { useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import Cropper, { ReactCropperElement } from 'react-cropper';
import 'cropperjs/dist/cropper.css';
import {
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  PenTool,
  FileText,
  X,
  Loader2,
  ArrowDown,
  Check,
  RotateCcw,
  Crop as CropIcon,
  ZoomIn,
  ZoomOut,
  RotateCw
} from 'lucide-react';
import type { DocumentType, AgencySpec, RequirementSpec, DocumentRequirementSpec } from '../data/specifications';
import { processImage, getFilePreview, imagesToPdf, checkPdfSize, downloadBlob, type ProcessResult } from '../utils/imageProcessor';

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
  
  // Crop Modal State
  const [cropData, setCropData] = useState<{ isOpen: boolean; type: UploadType | null; file: File | null; preview: string | null; ratio: number }>({
    isOpen: false,
    type: null,
    file: null,
    preview: null,
    ratio: 1,
  });
  const cropperRef = useRef<ReactCropperElement>(null);

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
          toast.success(`${type === 'photo' ? 'Photo' : 'Signature'} ready! ${result.processedSizeKB}KB / ${req.maxSizeKB}KB`, { icon: '✅' });
        } else {
          toast.error(`Could not compress below ${req.maxSizeKB}KB. Current: ${result.processedSizeKB}KB`);
        }
      } else {
        const imageFiles = docFilesRef.current.filter((f) => f.type.startsWith('image/'));
        const pdfFiles = docFilesRef.current.filter((f) => f.type === 'application/pdf');

        if (imageFiles.length > 0) {
          let preview = null;
          if (imageFiles[0].type.startsWith('image/')) preview = await getFilePreview(imageFiles[0]);
          updateUpload(type, { preview, file: imageFiles[0] });
          const result = await imagesToPdf(imageFiles);
          updateUpload(type, { processing: false, result, resultPreview: null });
          toast.success('PDF created successfully!', { icon: '📄' });
        } else if (pdfFiles.length > 0) {
          const check = await checkPdfSize(pdfFiles[0]);
          if (check.isValid) {
            const blob = new Blob([await pdfFiles[0].arrayBuffer()], { type: 'application/pdf' });
            const result: ProcessResult = {
              blob, originalSizeKB: check.sizeKB, processedSizeKB: check.sizeKB,
              width: 595, height: 842, dpi: 200, format: 'application/pdf',
            };
            updateUpload(type, { processing: false, result, resultPreview: null });
            if (check.sizeKB > agency.requirements.documents.maxSizeMB * 1024) {
              toast.error(`PDF exceeds ${agency.requirements.documents.maxSizeMB}MB limit`);
            } else {
              toast.success('PDF verified — within size limits', { icon: '✅' });
            }
          }
        }
      }
    } catch (err) {
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
    const acceptedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!acceptedTypes.includes(file.type)) {
      toast.error('Please upload an image file (JPG, PNG, WebP)', { icon: '⚠️' });
      return;
    }

    // Trigger Crop Modal for images
    const preview = await getFilePreview(file);
    const req = type === 'photo' ? agency.requirements.photo : agency.requirements.signature;
    const ratio = req.widthPx / req.heightPx;
    
    setCropData({ isOpen: true, type, file, preview, ratio });
  };

  const handleCropConfirm = () => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper || !cropData.type || !cropData.file) return;

    cropper.getCroppedCanvas({
        imageSmoothingQuality: 'high',
        fillColor: '#fff',
    }).toBlob((blob) => {
      if (blob) {
        const croppedFile = new File([blob], cropData.file!.name, { type: 'image/jpeg' });
        const currentType = cropData.type;
        setCropData({ isOpen: false, type: null, file: null, preview: null, ratio: 1 });
        processUpload(currentType!, croppedFile);
      }
    }, 'image/jpeg', 1);
  };

  const handleReprocess = (type: UploadType) => {
    const file = uploads[type].file;
    if (file) {
        if(type !== 'documents'){
            getFilePreview(file).then(preview => {
                const req = type === 'photo' ? agency.requirements.photo : agency.requirements.signature;
                setCropData({ isOpen: true, type, file, preview, ratio: req.widthPx / req.heightPx });
            })
        } else {
            processUpload(type, file);
        }
    }
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

  // Image manipulation functions for the fixed crop box
  const handleZoom = (ratio: number) => {
    cropperRef.current?.cropper.zoom(ratio);
  };

  const handleRotate = (degree: number) => {
    cropperRef.current?.cropper.rotate(degree);
  };

  return (
    <div className="page-enter max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 relative">
      {/* Crop Modal Overlay */}
      {cropData.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm animate-fade-in touch-none">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[95vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <CropIcon size={18} className="text-indigo-500" />
                Adjust {cropData.type === 'photo' ? 'Photo' : 'Signature'}
              </h3>
              <button onClick={() => setCropData({ ...cropData, isOpen: false })} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            {/* Cropper Container */}
            <div className="bg-slate-900 w-full h-[350px] sm:h-[400px] relative">
              <Cropper
                ref={cropperRef}
                src={cropData.preview!}
                style={{ height: '100%', width: '100%' }}
                aspectRatio={cropData.ratio}
                guides={true}
                viewMode={1}
                dragMode="move"
                cropBoxMovable={false} // Fixed Crop Box (can't move the box)
                cropBoxResizable={false} // Fixed Crop Box (can't resize the box)
                toggleDragModeOnDblclick={false}
                background={false}
                responsive={true}
                autoCropArea={0.8}
              />
            </div>
            
            {/* Image Controls (Zoom & Rotate) */}
            <div className="bg-slate-800 p-3 flex justify-center gap-4">
              <button onClick={() => handleRotate(-15)} className="p-2.5 rounded-full bg-slate-700 text-white hover:bg-slate-600 active:scale-95 transition-all" title="Rotate Left">
                <RotateCcw size={18} />
              </button>
              <button onClick={() => handleRotate(15)} className="p-2.5 rounded-full bg-slate-700 text-white hover:bg-slate-600 active:scale-95 transition-all" title="Rotate Right">
                <RotateCw size={18} />
              </button>
              <div className="w-px h-8 bg-slate-600 mx-1 align-middle my-auto"></div>
              <button onClick={() => handleZoom(-0.1)} className="p-2.5 rounded-full bg-slate-700 text-white hover:bg-slate-600 active:scale-95 transition-all" title="Zoom Out">
                <ZoomOut size={18} />
              </button>
              <button onClick={() => handleZoom(0.1)} className="p-2.5 rounded-full bg-slate-700 text-white hover:bg-slate-600 active:scale-95 transition-all" title="Zoom In">
                <ZoomIn size={18} />
              </button>
            </div>

            <div className="p-4 flex gap-3 bg-slate-50">
                <button onClick={() => setCropData({ ...cropData, isOpen: false })} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-white active:bg-slate-100 transition-colors">Cancel</button>
                <button onClick={handleCropConfirm} className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 active:bg-indigo-800 transition-colors">Crop & Save</button>
            </div>
          </div>
        </div>
      )}

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
        <button onClick={onStartOver} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
          <RotateCcw size={14} /> Start Over
        </button>
      </div>

      <div className="space-y-5 sm:space-y-6">
        <UploadCard type="photo" title="Passport Photo" subtitle="Upload your photograph" icon={<ImageIcon size={20} />} iconColor="text-blue-500" iconBg="bg-blue-50" requirement={agency.requirements.photo} state={uploads.photo} agency={agency} onFileSelect={handleFileSelect} onReprocess={handleReprocess} onDownload={handleDownload} onClear={handleClear} accept="image/jpeg,image/jpg,image/png,image/webp" />
        <UploadCard type="signature" title="Signature" subtitle="Upload your signature" icon={<PenTool size={20} />} iconColor="text-violet-500" iconBg="bg-violet-50" requirement={agency.requirements.signature} state={uploads.signature} agency={agency} onFileSelect={handleFileSelect} onReprocess={handleReprocess} onDownload={handleDownload} onClear={handleClear} accept="image/jpeg,image/jpg,image/png,image/webp" />
        <UploadCard type="documents" title="Supporting Documents" subtitle="Aadhaar, Voter ID, etc." icon={<FileText size={20} />} iconColor="text-emerald-500" iconBg="bg-emerald-50" docRequirement={agency.requirements.documents} state={uploads.documents} agency={agency} onFileSelect={handleFileSelect} onReprocess={handleReprocess} onDownload={handleDownload} onClear={handleClear} accept="image/jpeg,image/jpg,image/png,application/pdf" multiple />
      </div>
    </div>
  );
}

// ─── Sub Components ─────────────────────────────────────────────────────────

interface UploadCardProps {
  type: UploadType; title: string; subtitle: string; icon: React.ReactNode; iconColor: string; iconBg: string; requirement?: RequirementSpec; docRequirement?: DocumentRequirementSpec; state: UploadState; agency: AgencySpec; onFileSelect: (type: UploadType, files: FileList | null) => void; onReprocess: (type: UploadType) => void; onDownload: (type: UploadType) => void; onClear: (type: UploadType) => void; accept: string; multiple?: boolean;
}

function UploadCard({ type, title, subtitle, icon, iconColor, iconBg, requirement, docRequirement, state, agency, onFileSelect, onReprocess, onDownload, onClear, accept, multiple }: UploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); onFileSelect(type, e.dataTransfer.files); };
  const isImage = type !== 'documents';
  const specs = requirement || docRequirement;
  const maxSizeKB = isImage ? requirement!.maxSizeKB : docRequirement!.maxSizeMB * 1024;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center ${iconColor}`}>{icon}</div>
          <div><h3 className="font-semibold text-slate-800">{title}</h3><p className="text-xs text-slate-400">{subtitle}</p></div>
        </div>
        {state.result && <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-medium animate-scale-in"><CheckCircle2 size={12} /> Ready</span>}
        {state.processing && <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-medium"><Loader2 size={12} className="animate-spin" /> Processing...</span>}
      </div>

      <div className="p-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-1">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Required Specs</h4>
            <div className="space-y-1.5">
              {isImage && requirement && (
                <>
                  <SpecRow label="Dimensions" value={`${requirement.widthPx} × ${requirement.heightPx} px`} highlight />
                  <SpecRow label="File Size" value={`≤ ${requirement.maxSizeKB} KB`} highlight />
                  <SpecRow label="Resolution" value={`${requirement.dpi} DPI`} highlight />
                  <SpecRow label="Background" value={requirement.background} />
                </>
              )}
              {!isImage && docRequirement && (
                <>
                  <SpecRow label="Max Size" value={`${docRequirement.maxSizeMB} MB`} highlight />
                  <SpecRow label="Scan DPI" value={`${docRequirement.dpi} DPI`} />
                </>
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
            {!state.file && (
              <div className={`drop-zone relative border-2 border-dashed rounded-xl p-8 sm:p-10 text-center cursor-pointer transition-all ${dragOver ? 'border-indigo-400 bg-indigo-50/50 scale-[1.02]' : 'border-slate-200 bg-slate-50/50 hover:border-indigo-300 hover:bg-indigo-50/30'}`} onClick={() => inputRef.current?.click()} onDrop={handleDrop} onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}>
                <input ref={inputRef} type="file" accept={accept} multiple={multiple} onChange={(e) => onFileSelect(type, e.target.files)} className="hidden" />
                <div className={`drop-icon ${iconColor} mb-3 flex justify-center`}><Upload size={36} /></div>
                <p className="text-sm font-medium text-slate-600 mb-1">{dragOver ? 'Drop file here' : 'Click to upload or drag & drop'}</p>
              </div>
            )}
            
            {state.processing && (
              <div className="animate-fade-in space-y-3 py-6 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50"><Loader2 size={24} className="text-indigo-500 animate-spin" /></div>
                  <p className="text-sm font-medium text-slate-700">Processing your {type}...</p>
              </div>
            )}

            {state.result && !state.processing && (
              <div className="animate-scale-in">
                <div className="comparison-grid mb-3">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5"><span className="text-[11px] font-semibold text-slate-400 uppercase">Original Upload</span></div>
                    <div className="image-preview p-2 bg-slate-50 border border-slate-200 rounded-xl h-32">{state.preview ? <img src={state.preview} alt="Original" /> : <FileText size={24} className="text-slate-300" />}</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5"><span className="text-[11px] font-semibold text-emerald-600 uppercase">Final Optimized</span><span className={`spec-badge ${state.result.processedSizeKB <= maxSizeKB ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{state.result.processedSizeKB} KB</span></div>
                    <div className="image-preview p-2 bg-emerald-50/50 border border-emerald-200 rounded-xl h-32">{state.resultPreview ? <img src={state.resultPreview} alt="Processed" /> : <FileText size={24} className="mx-auto text-emerald-300 mb-1" />}</div>
                  </div>
                </div>

                <div className="flex gap-3 mt-4">
                  <button onClick={() => onDownload(type)} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-semibold hover:from-emerald-600 transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-200"><Download size={16} /> Download {isImage ? 'Image' : 'PDF'}</button>
                  <button onClick={() => onReprocess(type)} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 text-sm font-medium hover:bg-slate-50 flex items-center gap-1.5 active:bg-slate-100"><CropIcon size={14} /> Adjust</button>
                  <button onClick={() => onClear(type)} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-400 text-sm hover:text-red-500 hover:bg-red-50 hover:border-red-200 flex items-center justify-center active:bg-red-100"><X size={14} /></button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SpecRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 px-2.5 rounded-lg ${highlight ? 'bg-indigo-50/70' : 'bg-slate-50'}`}>
      <span className={`text-xs font-medium ${highlight ? 'text-indigo-400' : 'text-slate-400'}`}>{label}</span>
      <span className={`text-xs font-semibold ${highlight ? 'text-indigo-600' : 'text-slate-700'}`}>{value}</span>
    </div>
  );
}
