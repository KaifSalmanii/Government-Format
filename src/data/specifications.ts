export interface RequirementSpec {
  widthPx: number;
  heightPx: number;
  widthCm: string;
  heightCm: string;
  maxSizeKB: number;
  minSizeKB: number;
  format: string;
  formatLabel: string;
  dpi: number;
  background: string;
  additionalNotes: string[];
  autoDetectContent?: boolean;
}

export interface DocumentRequirementSpec {
  format: string;
  formatLabel: string;
  maxSizeMB: number;
  maxSizePerPageKB: number;
  dpi: number;
  additionalNotes: string[];
  acceptMultiple: boolean;
}

export interface AgencySpec {
  id: string;
  name: string;
  fullName: string;
  color: string;
  bgColor: string;
  borderColor: string;
  requirements: {
    photo: RequirementSpec;
    signature: RequirementSpec;
    documents: DocumentRequirementSpec;
  };
}

export interface DocumentType {
  id: string;
  name: string;
  nameHi: string;
  description: string;
  icon: string;
  available: boolean;
  agencies: AgencySpec[];
}

export const documentTypes: DocumentType[] = [
  {
    id: 'pan-card',
    name: 'PAN Card',
    nameHi: 'पैन कार्ड',
    description: 'New PAN, Correction, Reprint — NSDL & UTIITSL',
    icon: '🪪',
    available: true,
    agencies: [
      {
        id: 'nsdl',
        name: 'NSDL',
        fullName: 'NSDL (Protean e-Gov)',
        color: 'text-blue-700',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        requirements: {
          photo: {
            widthPx: 276,
            heightPx: 197,
            widthCm: '2.5',
            heightCm: '3.5',
            maxSizeKB: 50,
            minSizeKB: 4,
            format: 'image/jpeg',
            formatLabel: 'JPEG / JPG',
            dpi: 200,
            background: 'White or very light',
            additionalNotes: [
              'Recent colour passport-size photo',
              'Face must cover 70-80% of the frame',
              'No sunglasses or tinted lenses',
              'Both ears should be visible',
              'No shadows on face',
            ],
          },
          signature: {
            widthPx: 354,
            heightPx: 157,
            widthCm: '4.5',
            heightCm: '2.0',
            maxSizeKB: 50,
            minSizeKB: 1,
            format: 'image/jpeg',
            formatLabel: 'JPEG / JPG',
            dpi: 200,
            background: 'White',
            additionalNotes: [
              'Black or dark blue ink on white paper',
              'Sign in running handwriting (not block letters)',
              'No smudges or overwriting',
              'Signature should be clear and sharp',
              'Auto-crop: signature boundary detected automatically',
            ],
            autoDetectContent: true,
          },
          documents: {
            format: 'application/pdf',
            formatLabel: 'PDF',
            maxSizeMB: 2,
            maxSizePerPageKB: 300,
            dpi: 200,
            additionalNotes: [
              'Upload Aadhaar, Voter ID, or other supporting docs',
              'Each page must be under 300 KB',
              'Scan at 200 DPI in colour',
              'Multiple pages combined into single PDF',
              'Accepted: Proof of Identity, Address, DOB',
            ],
            acceptMultiple: true,
          },
        },
      },
      {
        id: 'utiitsl',
        name: 'UTIITSL',
        fullName: 'UTIITSL (UTI Infrastructure)',
        color: 'text-violet-700',
        bgColor: 'bg-violet-50',
        borderColor: 'border-violet-200',
        requirements: {
          photo: {
            widthPx: 213,
            heightPx: 213,
            widthCm: '2.5',
            heightCm: '2.5',
            maxSizeKB: 30,
            minSizeKB: 2,
            format: 'image/jpeg',
            formatLabel: 'JPEG / JPG',
            dpi: 300,
            background: 'White',
            additionalNotes: [
              'Exact 213×213 pixels (square format)',
              'Scan at 300 DPI in colour',
              'Recent colour photo with white background',
              'Full face visible, no shadows',
              'No spectacles preferred',
            ],
          },
          signature: {
            widthPx: 400,
            heightPx: 200,
            widthCm: '4.5',
            heightCm: '2.0',
            maxSizeKB: 60,
            minSizeKB: 2,
            format: 'image/jpeg',
            formatLabel: 'JPEG / JPG',
            dpi: 600,
            background: 'White',
            additionalNotes: [
              'Scan at 600 DPI in black & white',
              'Black ink on white paper only',
              'No smudges, no overwriting',
              'Auto-crop: signature boundary detected automatically',
              'Keep signature within the frame',
            ],
            autoDetectContent: true,
          },
          documents: {
            format: 'application/pdf',
            formatLabel: 'PDF/A',
            maxSizeMB: 2,
            maxSizePerPageKB: 1024,
            dpi: 200,
            additionalNotes: [
              'All documents merged into single PDF/A',
              'Maximum combined size: 2 MB',
              'Scan application form front & back at 200 DPI',
              'Include Proof of Identity, Address, DOB',
              'Upload as a single combined file',
            ],
            acceptMultiple: true,
          },
        },
      },
    ],
  },
  {
    id: 'voter-id',
    name: 'Voter ID',
    nameHi: 'वोटर ID',
    description: 'EPIC Card — Form 6, Correction, Reprint',
    icon: '🗳️',
    available: false,
    agencies: [],
  },
  {
    id: 'passport',
    name: 'Passport',
    nameHi: 'पासपोर्ट',
    description: 'Fresh Passport, Renewal, Tatkal — Passport Seva',
    icon: '📕',
    available: false,
    agencies: [],
  },
  {
    id: 'aadhaar',
    name: 'Aadhaar Card',
    nameHi: 'आधार कार्ड',
    description: 'New Aadhaar, Update — UIDAI',
    icon: '🪪',
    available: false,
    agencies: [],
  },
  {
    id: 'driving-license',
    name: 'Driving License',
    nameHi: 'ड्राइविंग लाइसेंस',
    description: 'New DL, Renewal, International DL — Parivahan',
    icon: '🚗',
    available: false,
    agencies: [],
  },
];

export function getDocumentType(id: string): DocumentType | undefined {
  return documentTypes.find((d) => d.id === id);
}

export function getAgency(docTypeId: string, agencyId: string): AgencySpec | undefined {
  const doc = getDocumentType(docTypeId);
  return doc?.agencies.find((a) => a.id === agencyId);
}
