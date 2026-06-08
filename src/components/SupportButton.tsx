import React, { useState } from 'react';
import { Heart, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const SupportButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  // Replace this with your actual UPI ID
  const upiId = "7534062390@ptaxis"; 
  const upiLink = `upi://pay?pa=${upiId}&pn=BoldShare%20Support&cu=INR`;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="hidden sm:flex items-center gap-2 bg-[#FF00E4] text-white px-4 py-2 neo-brutal text-sm font-black uppercase hover:bg-[#D100BB] transition-colors"
      >
        Support <Heart size={16} fill="currentColor" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md neo-brutal relative animate-in zoom-in duration-300">
            <button 
              onClick={() => setIsOpen(false)}
              className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 bg-[#FF00E4] text-white p-2 neo-brutal hover:rotate-90 transition-transform z-10"
            >
              <X size={24} />
            </button>

            <div className="p-8 space-y-6 text-center">
              <div className="space-y-2">
                <h2 className="text-3xl font-black uppercase tracking-tighter">Support BoldShare</h2>
                <p className="font-bold opacity-70">
                  If you find this project useful, consider supporting the developer to keep it running!
                </p>
              </div>

              <div className="flex justify-center">
                <div className="bg-white p-4 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                  <QRCodeSVG value={upiLink} size={200} />
                </div>
              </div>

              <div className="space-y-4">
                {/* <div className="bg-[#FFFD82] p-3 border-2 border-black font-mono text-sm font-black break-all">
                  {upiId}
                </div> */}
                <p className="text-xs font-black uppercase opacity-50">
                  Scan with any UPI app (GPay, PhonePe, Paytm)
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SupportButton;