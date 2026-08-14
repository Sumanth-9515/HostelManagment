const TRANSFORM_MARKERS = /^(?:a|ar|b|bo|c|co|d|dpr|e|f|fl|g|h|l|o|q|r|t|u|w|x|y|z)_/i;

export const CLOUDINARY_IMAGE_WIDTHS = {
  avatar: 160,
  card: 320,
  passport: 640,
  documentThumb: 360,
  documentFull: 1000,
  receipt: 1000,
};

function isPdfPath(pathname) {
  return /\.pdf$/i.test(pathname.split("?")[0].split("#")[0]);
}

function stripLeadingTransformations(segments) {
  const next = [...segments];
  while (next.length > 1) {
    const first = next[0];
    if (/^v\d+$/i.test(first)) break;
    if (!first.includes(",") && !TRANSFORM_MARKERS.test(first)) break;
    next.shift();
  }
  return next;
}

export function optimizeCloudinaryImageUrl(value, options = {}) {
  if (value == null || value === "") return value;
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (!trimmed) return value;

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return value;
  }

  if (url.hostname !== "res.cloudinary.com") return value;

  const parts = url.pathname.split("/").filter(Boolean);
  const uploadIndex = parts.findIndex((part, index) => index >= 2 && part === "upload");
  if (parts[1] !== "image" || uploadIndex === -1 || isPdfPath(url.pathname)) return value;

  const afterUpload = stripLeadingTransformations(parts.slice(uploadIndex + 1));
  if (afterUpload.length === 0) return value;

  const transform = [
    "f_auto",
    "q_auto",
    options.width ? `w_${Number(options.width)}` : null,
    options.height ? `h_${Number(options.height)}` : null,
    options.crop ? `c_${options.crop}` : null,
  ].filter(Boolean).join(",");

  url.pathname = `/${parts.slice(0, uploadIndex + 1).join("/")}/${transform}/${afterUpload.join("/")}`;
  return url.toString();
}

export function optimizeTenantDocuments(documents, options = {}) {
  if (!documents || typeof documents !== "object") return documents;

  const passportWidth = options.passportWidth || CLOUDINARY_IMAGE_WIDTHS.passport;
  const documentWidth = options.documentWidth || CLOUDINARY_IMAGE_WIDTHS.documentFull;

  return {
    ...documents,
    aadharFront: optimizeCloudinaryImageUrl(documents.aadharFront, { width: documentWidth }),
    aadharBack: optimizeCloudinaryImageUrl(documents.aadharBack, { width: documentWidth }),
    passportPhoto: optimizeCloudinaryImageUrl(documents.passportPhoto, {
      width: passportWidth,
      height: options.passportHeight,
      crop: options.passportCrop,
    }),
  };
}

export function withOptimizedTenantDocuments(tenant, options = {}) {
  if (!tenant) return tenant;
  const plain = tenant.toObject ? tenant.toObject() : tenant;
  const documents = plain.documents;
  return {
    ...plain,
    documents: optimizeTenantDocuments(documents, options),
    originalDocuments: documents ? { ...documents } : documents,
  };
}

export function withOptimizedPaymentRequestReceipt(request, options = {}) {
  if (!request) return request;
  const plain = request.toObject ? request.toObject() : request;
  const receiptUrl = plain.receiptUrl;
  return {
    ...plain,
    receiptUrl: optimizeCloudinaryImageUrl(receiptUrl, {
      width: options.width || CLOUDINARY_IMAGE_WIDTHS.receipt,
    }),
    originalReceiptUrl: receiptUrl || null,
  };
}
