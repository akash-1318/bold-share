import React, { useState } from 'react';
import { Trash2, File as FileIcon } from 'lucide-react';

interface FileRow {
  id: string;
  name: string;
  size: number;
  expiresAt: string | null;
}

interface Props {
  files: FileRow[];
  usageBytes: number;
  limitBytes: number;
}

const formatMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

const FileManager = ({ files: initialFiles, usageBytes: initialUsage, limitBytes }: Props) => {
  const [files, setFiles] = useState(initialFiles);
  const [usageBytes, setUsageBytes] = useState(initialUsage);

  const handleDelete = async (id: string, size: number) => {
    const res = await fetch(`/api/files/${id}`, { method: 'DELETE' });
    if (!res.ok) return;
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setUsageBytes((prev) => prev - size);
  };

  const percentUsed = Math.min(100, (usageBytes / limitBytes) * 100);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8 py-12">
      <div className="bg-white neo-brutal p-6 space-y-3">
        <p className="font-black uppercase">
          {formatMB(usageBytes)}MB / {formatMB(limitBytes)}MB used
        </p>
        <div className="w-full h-4 border-2 border-black bg-[#F0F0F0]">
          <div className="h-full bg-[#00F0FF]" style={{ width: `${percentUsed}%` }} />
        </div>
      </div>

      <div className="space-y-4">
        {files.length === 0 && <p className="font-bold opacity-60">No active files.</p>}
        {files.map((file) => (
          <div key={file.id} className="bg-white neo-brutal p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <FileIcon className="shrink-0" />
              <div className="min-w-0">
                <p className="font-black truncate">{file.name}</p>
                <p className="font-bold opacity-60 text-sm">
                  {formatMB(file.size)}MB{file.expiresAt ? ` • expires ${new Date(file.expiresAt).toLocaleString()}` : ''}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleDelete(file.id, file.size)}
              className="bg-black text-white p-2 neo-brutal hover:bg-red-500 transition-colors shrink-0"
            >
              <Trash2 size={20} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FileManager;
