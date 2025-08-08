import React from 'react'

interface AiSuggestionButtonProps {
  name: string
  confidence?: number
  onClick: () => void
  showConfidence?: boolean
}

export function AiSuggestionButton({ name, confidence = 0.75, onClick, showConfidence = true }: AiSuggestionButtonProps) {
  return (
    <button
      onClick={onClick}
      className="bg-gradient-to-r from-purple-500 to-purple-600 text-white font-medium rounded-lg shadow-lg px-4 py-2 flex items-center gap-2 hover:scale-105 transition-transform text-sm"
    >
      + {name}
      {showConfidence && (
        <span className="bg-white/20 text-white text-xs rounded-full px-2 py-0.5">
          ⚡ {Math.round((confidence ?? 0.75) * 100)}% confident
        </span>
      )}
    </button>
  )
}

export default AiSuggestionButton 