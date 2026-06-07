import React, { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Share2, Loader2, Sparkles, Heading1, Heading2, Heading3, Code2, Quote, Strikethrough, AlignLeft, AlignCenter, AlignRight, Link as LinkIcon, Undo2, Redo2, Trash2 } from 'lucide-react';
import ShareOverlay from './ShareOverlay';

const Editor = () => {
  const [expiry, setExpiry] = useState('60'); // Default to 60 minutes (1 hour)
  const [customExpiry, setCustomExpiry] = useState('60');
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [hasContent, setHasContent] = useState(false);
  const [, setEditorVersion] = useState(0);
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Link.configure({
        openOnClick: false,
      }),
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

  const handleAddLink = () => {
    if (!linkUrl.trim()) return;
    
    editor?.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    setLinkUrl('');
    setShowLinkInput(false);
  };

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

  const getExpiryMessage = () => {
    let minutes = parseInt(expiry === 'custom' ? customExpiry : expiry);
    if (minutes < 60) return `This content will expire in ${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `This content will expire in ${hours}h ${mins > 0 ? `${mins}m` : ''}`;
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
        <div className="border-b-4 border-black p-2 flex flex-wrap gap-1 bg-[#FFFD82]">
          {/* Text Formatting Row */}
          <div className="flex flex-wrap gap-1">
            <MenuButton 
              onClick={() => editor.chain().focus().toggleBold().run()} 
              active={editor.isActive('bold')}
              title="Bold (Ctrl+B)"
            >
              <Bold size={18} />
            </MenuButton>
            <MenuButton 
              onClick={() => editor.chain().focus().toggleItalic().run()} 
              active={editor.isActive('italic')}
              title="Italic (Ctrl+I)"
            >
              <Italic size={18} />
            </MenuButton>
            <MenuButton 
              onClick={() => editor.chain().focus().toggleUnderline().run()} 
              active={editor.isActive('underline')}
              title="Underline"
            >
              <UnderlineIcon size={18} />
            </MenuButton>
            <MenuButton 
              onClick={() => editor.chain().focus().toggleStrike().run()} 
              active={editor.isActive('strike')}
              title="Strikethrough"
            >
              <Strikethrough size={18} />
            </MenuButton>
          </div>

          <div className="w-1 h-8 bg-black hidden sm:block" />

          {/* Headings Row */}
          <div className="flex flex-wrap gap-1">
            <MenuButton 
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} 
              active={editor.isActive('heading', { level: 1 })}
              title="Heading 1"
            >
              <Heading1 size={18} />
            </MenuButton>
            <MenuButton 
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} 
              active={editor.isActive('heading', { level: 2 })}
              title="Heading 2"
            >
              <Heading2 size={18} />
            </MenuButton>
            <MenuButton 
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} 
              active={editor.isActive('heading', { level: 3 })}
              title="Heading 3"
            >
              <Heading3 size={18} />
            </MenuButton>
          </div>

          <div className="w-1 h-8 bg-black hidden sm:block" />

          {/* Lists & Block Row */}
          <div className="flex flex-wrap gap-1">
            <MenuButton 
              onClick={() => editor.chain().focus().toggleBulletList().run()} 
              active={editor.isActive('bulletList')}
              title="Bullet List"
            >
              <List size={18} />
            </MenuButton>
            <MenuButton 
              onClick={() => editor.chain().focus().toggleOrderedList().run()} 
              active={editor.isActive('orderedList')}
              title="Ordered List"
            >
              <ListOrdered size={18} />
            </MenuButton>
            <MenuButton 
              onClick={() => editor.chain().focus().toggleCodeBlock().run()} 
              active={editor.isActive('codeBlock')}
              title="Code Block"
            >
              <Code2 size={18} />
            </MenuButton>
            <MenuButton 
              onClick={() => editor.chain().focus().toggleBlockquote().run()} 
              active={editor.isActive('blockquote')}
              title="Blockquote"
            >
              <Quote size={18} />
            </MenuButton>
          </div>

          <div className="w-1 h-8 bg-black hidden sm:block" />

          {/* Alignment Row */}
          <div className="flex flex-wrap gap-1">
            <MenuButton 
              onClick={() => editor.chain().focus().setTextAlign('left').run()} 
              active={editor.isActive({ textAlign: 'left' })}
              title="Align Left"
            >
              <AlignLeft size={18} />
            </MenuButton>
            <MenuButton 
              onClick={() => editor.chain().focus().setTextAlign('center').run()} 
              active={editor.isActive({ textAlign: 'center' })}
              title="Align Center"
            >
              <AlignCenter size={18} />
            </MenuButton>
            <MenuButton 
              onClick={() => editor.chain().focus().setTextAlign('right').run()} 
              active={editor.isActive({ textAlign: 'right' })}
              title="Align Right"
            >
              <AlignRight size={18} />
            </MenuButton>
          </div>

          <div className="w-1 h-8 bg-black hidden sm:block" />

          {/* Link Row */}
          <div className="flex flex-wrap gap-1 items-center">
            <div className="relative">
              <MenuButton 
                onClick={() => setShowLinkInput(!showLinkInput)}
                active={editor.isActive('link')}
                title="Add Link"
              >
                <LinkIcon size={18} />
              </MenuButton>
              {showLinkInput && (
                <div className="absolute top-full left-0 mt-1 bg-white border-2 border-black p-2 z-10 neo-brutal">
                  <input
                    type="url"
                    placeholder="https://example.com"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddLink();
                    }}
                    className="border-b-2 border-black focus:outline-none px-2 py-1 w-40"
                    autoFocus
                  />
                  <button
                    onClick={handleAddLink}
                    className="ml-2 px-2 py-1 bg-[#FF00E4] text-white font-bold text-sm rounded"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
            <MenuButton 
              onClick={() => editor.chain().focus().unsetLink().run()}
              disabled={!editor.isActive('link')}
              title="Remove Link"
            >
              <LinkIcon size={18} className="line-through" />
            </MenuButton>
          </div>

          <div className="w-1 h-8 bg-black hidden sm:block" />

          {/* Undo/Redo & Clear Row */}
          <div className="flex flex-wrap gap-1">
            <MenuButton 
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              title="Undo"
            >
              <Undo2 size={18} />
            </MenuButton>
            <MenuButton 
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              title="Redo"
            >
              <Redo2 size={18} />
            </MenuButton>
            <MenuButton 
              onClick={() => editor.chain().focus().clearNodes().run()}
              title="Clear Formatting"
            >
              <Trash2 size={18} />
            </MenuButton>
          </div>
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
        <ShareOverlay 
          url={shareUrl} 
          expiryMessage={getExpiryMessage()} 
          onClose={() => setShareUrl(null)} 
        />
      )}
    </div>
  );
};

const MenuButton = ({ onClick, active, children, title, disabled }: { onClick: () => void, active?: boolean, children: React.ReactNode, title?: string, disabled?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-pressed={active}
    title={title}
    className={`p-2 neo-brutal transition-all duration-150 border-2 border-black text-sm ${
      disabled
        ? 'opacity-40 cursor-not-allowed'
        : active 
        ? 'bg-[#FF00E4] text-white shadow-[0_8px_0_rgba(0,0,0,1)] translate-x-[2px] translate-y-[2px]' 
        : 'bg-white hover:bg-[#F0F0F0] hover:shadow-[0_4px_0_rgba(0,0,0,1)]'
    }`}
  >
    {children}
  </button>
);

export default Editor;
