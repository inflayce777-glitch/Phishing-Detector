'use client';

import { motion } from 'framer-motion';

interface GlassBoxHighlighterProps {
  text: string;
  vectors: any[];
}

export default function GlassBoxHighlighter({
  text,
  vectors,
}: GlassBoxHighlighterProps) {
  if (!text) {
    return (
      <div className="border-obsidian-light bg-obsidian/50 flex h-full min-h-[250px] w-full items-center justify-center rounded-xl border p-6 text-sm text-gray-600">
        Awaiting input sequence for semantic extraction...
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="border-obsidian-light bg-obsidian/80 flex min-h-[250px] w-full flex-col justify-between rounded-xl border p-6 shadow-lg backdrop-blur-sm"
    >
      <div>
        <h3 className="text-neon-cyan mb-4 text-xs font-semibold tracking-widest ">
          XAI Semantic Analysis
        </h3>
        <div className="space-y-4">
          <p className="text-foreground text-sm leading-relaxed">{text}</p>
        </div>
      </div>

      <div className="border-obsidian-light mt-8 border-t pt-4">
        <h4 className="mb-3 text-[10px] tracking-wider text-gray-500 ">
          Identified Threat Vectors
        </h4>
        <div className="flex flex-wrap gap-2">
          {vectors.map((vec) => (
            <span
              key={vec.id}
              className="text-obsidian rounded-full px-3 py-1 text-xs font-bold shadow-[0_0_10px_currentColor]"
              style={{ backgroundColor: vec.color, color: '#0b0c10' }}
            >
              {vec.trigger.toUpperCase()}: {(vec.score * 100).toFixed(1)}%
            </span>
          ))}
          {vectors.length === 0 && (
            <span className="text-xs text-gray-500">
              No malicious intent detected.
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
