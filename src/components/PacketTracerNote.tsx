import React, { useState } from 'react';
import { CanvasNote } from '../types/network';
import { X, Check } from 'lucide-react';

interface PacketTracerNoteProps {
  note: CanvasNote;
  onUpdate: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}

export const PacketTracerNote: React.FC<PacketTracerNoteProps> = ({
  note,
  onUpdate,
  onDelete,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(note.text);

  const handleSave = () => {
    onUpdate(note.id, text.trim() || 'Note');
    setIsEditing(false);
  };

  return (
    <div
      style={{ left: note.x, top: note.y }}
      className="absolute z-20 min-w-[140px] max-w-[240px] bg-[#fef08a] border border-[#ca8a04] rounded-xs shadow-md p-2 text-xs text-yellow-950 font-sans group select-none pointer-events-auto"
    >
      <div className="flex items-center justify-between mb-1 opacity-70 group-hover:opacity-100 transition-opacity">
        <span className="text-[9px] font-bold uppercase tracking-wider text-yellow-800">
          Note
        </span>
        <button
          type="button"
          onClick={() => onDelete(note.id)}
          className="text-yellow-700 hover:text-rose-600 p-0.5"
          title="Delete Note"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {isEditing ? (
        <div className="space-y-1.5">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full bg-white/80 border border-yellow-500 rounded-xs p-1 text-xs outline-hidden resize-none font-mono"
            rows={2}
            autoFocus
          />
          <button
            type="button"
            onClick={handleSave}
            className="px-2 py-0.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-xs text-[10px] font-bold"
          >
            Save
          </button>
        </div>
      ) : (
        <div
          onClick={() => setIsEditing(true)}
          className="font-mono text-[11px] whitespace-pre-wrap cursor-text"
          title="Click to edit note"
        >
          {note.text}
        </div>
      )}
    </div>
  );
};
