
import React, { useState, useCallback } from 'react';
import { Upload, File as FileIcon, X, Share2, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import ShareOverlay from './ShareOverlay';

const FileUploader = () => {
  const [file, setFile] = useState<File | null>(null);
  const [expiry, setExpiry] = useState('60');
  const [customExpiry, setCustomExpiry] = useState('60');
  const [uploading, setUploading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 1024 * 1024 * 1024) {
        setError('File size exceeds 1GB limit!');
        return;
      }
      setFile(selectedFile);
      setError(null);
      setShareUrl(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    let minutes = parseInt(expiry === 'custom' ? customExpiry : expiry);
    if (minutes > 1440) {
      setError('Maximum expiry is 24 hours!');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // 1. Get signed upload URL
      const urlResponse = await fetch('/api/get-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name }),
      });

      const urlData = await urlResponse.json();
      if (!urlResponse.ok) throw new Error(urlData.error || 'Failed to get upload URL');

      const { signedUrl, path, id } = urlData;

      // 2. Upload file directly to Supabase via the signed URL
      const uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
      });

      if (!uploadResponse.ok) {
        let errorMsg = 'Direct upload failed';
        try {
          const errorData = await uploadResponse.json();
          errorMsg = `Supabase Error: ${errorData.message || errorData.error}`;
        } catch (e) {
          errorMsg = `Upload failed with status ${uploadResponse.status}`;
        }
        throw new Error(errorMsg);
      }

      // 3. Finalize upload metadata in the database
      const finalizeResponse = await fetch('/api/finalize-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          fileName: file.name,
          fileType: file.type || 'application/octet-stream',
          fileSize: file.size,
          filePath: path,
          expiryMinutes: minutes,
        }),
      });

      const finalizeData = await finalizeResponse.json();
      if (!finalizeResponse.ok) throw new Error(finalizeData.error || 'Failed to finalize upload');

      setShareUrl(`${window.location.origin}/f/${id}`);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'A network error occurred');
    } finally {
      setUploading(false);
    }
  };

  const getExpiryMessage = () => {
    let minutes = parseInt(expiry === 'custom' ? customExpiry : expiry);
    if (minutes < 60) return `This content will expire in ${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `This content will expire in ${hours}h ${mins > 0 ? `${mins}m` : ''}`;
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#FF00E4] p-6 neo-brutal">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white text-black p-3 neo-brutal w-full">
          <div className="flex items-center gap-2">
            <label className="font-black text-sm uppercase whitespace-nowrap">Expires in:</label>
            <select
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="font-bold bg-transparent focus:outline-none cursor-pointer border-b-2 border-black"
            >
              <option value="15">15 Minutes</option>
              <option value="30">30 Minutes</option>
              <option value="60">1 Hour</option>
              <option value="1440">24 Hours</option>
              <option value="custom">Custom...</option>
            </select>
          </div>

          {expiry === 'custom' && (
            <div className="flex items-center gap-2 animate-in slide-in-from-left-2 duration-200">
              <input
                type="number"
                value={customExpiry}
                onChange={(e) => setCustomExpiry(e.target.value)}
                min="1"
                max="1440"
                className="w-20 font-bold border-b-2 border-black focus:outline-none px-1"
              />
              <span className="font-black text-xs uppercase">Mins</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white neo-brutal p-12 text-center space-y-8 relative">
        {!file ? (
          <label className="border-4 border-dashed border-black p-16 block cursor-pointer hover:bg-[#F0F0F0] transition-colors group">
            <input type="file" className="hidden" onChange={onFileChange} />
            <div className="flex flex-col items-center gap-4">
              <div className="bg-[#00F0FF] p-6 neo-brutal group-hover:-rotate-12 transition-transform">
                <Upload className="w-12 h-12" />
              </div>
              <div>
                <p className="text-2xl font-black uppercase">Click to Select File</p>
                <p className="font-bold opacity-60">Maximum file size: 1GB</p>
              </div>
            </div>
          </label>
        ) : (
          <div className="border-4 border-black p-8 flex flex-col items-center gap-6 animate-in zoom-in duration-200">
            <div className="bg-[#FFFD82] p-6 neo-brutal">
              <FileIcon className="w-16 h-16" />
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-black break-all">{file.name}</p>
              <p className="font-bold opacity-60">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
            </div>
            <button
              onClick={() => setFile(null)}
              className="bg-black text-white p-2 neo-brutal hover:bg-red-500 transition-colors"
            >
              <X />
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border-4 border-red-500 p-4 text-red-500 font-black uppercase flex items-center justify-center gap-3">
            <AlertCircle /> {error}
          </div>
        )}

        <div className="flex justify-center pt-4">
          <button
            onClick={handleUpload}
            disabled={uploading || !file}
            className="bg-[#00F0FF] text-black text-2xl font-black px-12 py-6 neo-brutal flex items-center gap-4 hover:bg-[#00D8E6] disabled:opacity-50 disabled:cursor-not-allowed group transition-all"
          >
            {uploading ? (
              <Loader2 className="animate-spin w-8 h-8" />
            ) : (
              <>
                UPLOAD & SHARE <Share2 className="w-8 h-8 group-hover:rotate-12 transition-transform" />
              </>
            )}
          </button>
        </div>
      </div>

      {shareUrl && (
        <ShareOverlay
          url={shareUrl}
          expiryMessage={getExpiryMessage()}
          onClose={() => setShareUrl(null)}
        />
      )}
    </div>
  );
};

export default FileUploader;
