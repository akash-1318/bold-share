import React from 'react';
import { X, Copy, Share2, Clock, CheckCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface ShareOverlayProps {
  url: string;
  expiryMessage: string;
  onClose: () => void;
}

const ShareOverlay: React.FC<ShareOverlayProps> = ({ url, expiryMessage, onClose }) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'BoldShare',
          text: 'Check out this shared content on BoldShare',
          url: url,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      alert('Sharing not supported on this browser. Copy the link instead!');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg neo-brutal relative animate-in zoom-in duration-300 max-h-[90vh] flex flex-col">
        <button 
          onClick={onClose}
          className="absolute top-2 right-2 sm:-top-6 sm:-right-6 bg-[#FF00E4] text-white p-2 neo-brutal hover:rotate-90 transition-transform z-10"
        >
          <X size={24} className="sm:w-8 sm:h-8" />
        </button>

        <div className="p-6 sm:p-8 space-y-6 sm:space-y-8 overflow-y-auto custom-scrollbar">
          <div className="text-center space-y-2">
            <div className="bg-[#00F0FF] w-16 h-16 rounded-full flex items-center justify-center mx-auto neo-brutal mb-4">
              <CheckCircle size={32} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight">Link Created!</h2>
          </div>

          <div className="space-y-4">
            <div className="bg-[#F0F0F0] p-4 border-4 border-black font-mono break-all text-center text-sm sm:text-base">
              {url}
            </div>
            <button 
              onClick={handleCopy}
              className="w-full bg-[#FFFD82] font-black py-3 neo-brutal flex items-center justify-center gap-2 hover:bg-[#EEEB6D]"
            >
              <Copy size={20} /> COPY LINK
            </button>
          </div>

          <button 
            onClick={handleNativeShare}
            className="w-full bg-black text-white py-4 sm:py-5 neo-brutal text-lg sm:text-xl font-black flex items-center justify-center gap-3 hover:bg-[#FF00E4] transition-colors"
          >
            SHARE YOUR CONTENT <Share2 />
          </button>

          <div className="bg-[#00F0FF] p-4 neo-brutal flex items-center justify-center gap-2 font-bold uppercase text-xs sm:text-sm">
            <Clock size={18} /> {expiryMessage}
          </div>

          <div className="flex justify-center pt-2">
            <div className="bg-white p-4 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <QRCodeSVG value={url} size={140} className="sm:w-[160px] sm:h-[160px]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareOverlay;
