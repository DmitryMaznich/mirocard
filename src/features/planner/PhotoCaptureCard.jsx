import { useState, useRef } from 'react';
import { resizeToBlob } from './plannerPhotos.js';

export default function PhotoCaptureCard({ title, hint, maxDim, quality, onConfirm, onSkip, skipLabel }) {
  const [blob, setBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    const resized = await resizeToBlob(file, maxDim, quality);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setBlob(resized);
    setPreviewUrl(URL.createObjectURL(resized));
    setBusy(false);
  }

  function retake() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setBlob(null);
    setPreviewUrl(null);
  }

  function confirm() {
    if (blob) onConfirm(blob);
  }

  return (
    <div className="photo-capture">
      <div className="photo-capture__title">{title}</div>
      {previewUrl ? (
        <>
          <img src={previewUrl} className="photo-capture__preview" onClick={retake} alt="" />
          <div className="photo-capture__actions">
            <button type="button" className="photo-capture__retake" onClick={retake}>Переснять</button>
            <button type="button" className="photo-capture__confirm" onClick={confirm}>Готово</button>
          </div>
        </>
      ) : (
        <>
          <div className="photo-capture__btns">
            <button type="button" className="photo-capture__btn" onClick={() => cameraRef.current?.click()} disabled={busy}>
              {busy ? '…' : '📷 Камера'}
            </button>
            <button type="button" className="photo-capture__btn photo-capture__btn--alt" onClick={() => galleryRef.current?.click()} disabled={busy}>
              🖼 Галерея
            </button>
          </div>
          {hint && <div className="photo-capture__hint">{hint}</div>}
          {onSkip && (
            <button type="button" className="photo-capture__skip" onClick={onSkip}>
              {skipLabel ?? 'Пропустить'}
            </button>
          )}
        </>
      )}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} />
      <input ref={galleryRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  );
}
