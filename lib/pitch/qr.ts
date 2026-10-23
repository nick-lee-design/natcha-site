import QRCode from 'qrcode';

// A QR code as one SVG path, built synchronously so print renders it on the first pass
export function qrPath(text: string) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  let d = '';
  for (let y = 0; y < modules.size; y++) {
    for (let x = 0; x < modules.size; x++) if (modules.get(x, y)) d += `M${x} ${y}h1v1h-1z`;
  }
  return { d, size: modules.size };
}
