import React, { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Share2, Loader2, Sparkles } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const Editor = () => {
  const [expiry, setExpiry] = useState('60'); // Default to 60 minutes (1 hour)
  const [customExpiry, setCustomExpiry] = useState('60');
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [hasContent, setHasContent] = useState(false);
  const [, setEditorVersion] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
    ],
    content: '',
    onUpdate: ({ editor }) => {
      setHasContent(!editor.isEmpty);
      setEditorVersion((version) => version + 1);
    },
    onSelectionUpdate: ({ editor }) => {
      setEditorVersion((version) => version + 1);
    },
    editorProps: {
      attributes: {
        class: 'p-6 focus:outline-none min-h-[300px] text-xl',
      },
    },
  });

  const handleShare = async () => {
    if (!editor || editor.isEmpty) return;

    let minutes = parseInt(expiry === 'custom' ? customExpiry : expiry);
    
    // Clamp to 24 hours max
    if (minutes > 1440) {
      alert('Maximum expiry is 24 hours!');
      return;
    }

    setSharing(true);
    try {
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: editor.getHTML(),
          expiryMinutes: minutes,
        }),
      });

      const data = await response.json();
      if (data.id) {
        setShareUrl(`${window.location.origin}/p/${data.id}`);
      } else if (data.error) {
        alert(data.error);
      }
    } catch (error) {
      console.error('Sharing failed:', error);
    } finally {
      setSharing(false);
    }
  };

  if (!editor) return null;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#00F0FF] p-6 neo-brutal">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter flex items-center gap-2">
            BoldShare <Sparkles className="w-8 h-8 text-[#FF00E4]" />
          </h1>
          <p className="font-bold opacity-80">Share your thoughts, boldly.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white p-3 neo-brutal">
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

      <div className="bg-white neo-brutal overflow-hidden">
        <div className="border-b-4 border-black p-2 flex flex-wrap gap-2 bg-[#FFFD82]">
          <MenuButton 
            onClick={() => editor.chain().focus().toggleBold().run()} 
            active={editor.isActive('bold')}
          >
            <Bold size={20} />
          </MenuButton>
          <MenuButton 
            onClick={() => editor.chain().focus().toggleItalic().run()} 
            active={editor.isActive('italic')}
          >
            <Italic size={20} />
          </MenuButton>
          <MenuButton 
            onClick={() => editor.chain().focus().toggleUnderline().run()} 
            active={editor.isActive('underline')}
          >
            <UnderlineIcon size={20} />
          </MenuButton>
          <div className="w-1 h-10 bg-black mx-1 hidden sm:block" />
          <MenuButton 
            onClick={() => editor.chain().focus().toggleBulletList().run()} 
            active={editor.isActive('bulletList')}
          >
            <List size={20} />
          </MenuButton>
          <MenuButton 
            onClick={() => editor.chain().focus().toggleOrderedList().run()} 
            active={editor.isActive('orderedList')}
          >
            <ListOrdered size={20} />
          </MenuButton>
        </div>
        <EditorContent editor={editor} />
      </div>

      <div className="flex justify-center">
        <button
          onClick={handleShare}
          disabled={sharing || !hasContent}
          className="bg-[#FF00E4] text-white text-2xl font-black px-12 py-6 neo-brutal flex items-center gap-4 hover:bg-[#D100BB] disabled:opacity-50 disabled:cursor-not-allowed group transition-all"
        >
          {sharing ? (
            <Loader2 className="animate-spin w-8 h-8" />
          ) : (
            <>
              GENERATE LINK <Share2 className="w-8 h-8 group-hover:rotate-12 transition-transform" />
            </>
          )}
        </button>
      </div>

      {shareUrl && (
        <div className="bg-white p-8 neo-brutal text-center space-y-6 animate-in fade-in zoom-in duration-300">
          <h2 className="text-3xl font-black uppercase">Success! Your link is ready.</h2>
          <div className="flex items-center gap-2 bg-[#F0F0F0] p-4 border-2 border-black font-mono break-all text-lg">
            {shareUrl}
          </div>
          <div className="flex flex-col items-center gap-6">
            <div className="bg-white p-4 border-4 border-black inline-block shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
               <QRCodeSVG value={shareUrl} size={160} />
            </div>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(shareUrl);
                alert('Copied to clipboard!');
              }}
              className="bg-[#00F0FF] font-black px-8 py-4 neo-brutal uppercase text-xl hover:bg-[#00D8E6]"
            >
              Copy Link
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const MenuButton = ({ onClick, active, children }: { onClick: () => void, active?: boolean, children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`p-3 neo-brutal transition-all duration-150 border-2 border-black ${
      active 
        ? 'bg-[#FF00E4] text-white shadow-[0_8px_0_rgba(0,0,0,1)] translate-x-[2px] translate-y-[2px]' 
        : 'bg-white hover:bg-[#F0F0F0] hover:shadow-[0_4px_0_rgba(0,0,0,1)]'
    }`}
  >
    {children}
  </button>
);

export default Editor;
