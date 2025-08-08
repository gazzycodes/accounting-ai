import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface ChatMessage {
  id: string
  type: 'user' | 'ai'
  content: string
  timestamp: Date
}

interface ChatDrawerProps {
  isOpen: boolean
  onToggle: (open: boolean) => void
}

const ChatDrawer = ({ isOpen, onToggle }: ChatDrawerProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [ws, setWs] = useState<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Initialize WebSocket connection
  useEffect(() => {
    if (isOpen && !ws) {
      const websocket = new WebSocket('ws://localhost:4000')
      
      websocket.onopen = () => {
        console.log('WebSocket connected')
        setWs(websocket)
      }

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          if (data.type === 'chat_response') {
            // Add AI response
            const aiMessage: ChatMessage = {
              id: Date.now().toString(),
              type: 'ai',
              content: data.message,
              timestamp: new Date()
            }
            
            setMessages(prev => [...prev, aiMessage])
            setIsTyping(false)

            // Handle actions if any
            if (data.action) {
              handleAIAction(data.action)
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      websocket.onclose = () => {
        console.log('WebSocket disconnected')
        setWs(null)
      }

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      return () => {
        websocket.close()
      }
    }
  }, [isOpen])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleAIAction = (action: { type: string; parameters: string }) => {
    // Handle AI actions like creating expenses
    console.log('AI Action:', action)
    // In a real app, you'd execute the action here
  }

  const sendMessage = () => {
    if (!inputValue.trim() || !ws) return

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setIsTyping(true)

    // Send to WebSocket
    ws.send(JSON.stringify({
      type: 'chat',
      message: inputValue,
      context: {
        // Add relevant context
        timestamp: new Date().toISOString()
      }
    }))

    setInputValue('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <>
      {/* Chat Button */}
      <motion.div
        className="fixed bottom-4 right-4 z-50"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1, type: "spring", stiffness: 200 }}
      >
        <div className="relative group">
          <motion.button
            onClick={() => onToggle(!isOpen)}
            className="relative w-16 h-16 bg-electric-gradient rounded-full shadow-lg flex items-center justify-center text-2xl hover:shadow-xl transition-shadow"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            animate={!isOpen ? { 
              boxShadow: [
                "0 0 0 0 rgba(124, 58, 237, 0.4)",
                "0 0 0 20px rgba(124, 58, 237, 0)",
              ]
            } : {}}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatType: "loop"
            }}
          >
            {!isOpen && <div className="pulse-ring" />}
            <span>{isOpen ? '✕' : '💬'}</span>
          </motion.button>
          
          {/* Always Visible Tooltip with Pulse Animation */}
          <motion.div
            className="absolute bottom-full right-0 mb-3 px-3 py-2 bg-electric-600 text-white text-xs font-medium rounded-lg shadow-lg whitespace-nowrap pointer-events-none"
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ 
              opacity: isOpen ? 0 : 1, 
              y: isOpen ? 10 : 0, 
              scale: isOpen ? 0.9 : 1,
            }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              animate={{
                scale: [1, 1.05, 1],
                opacity: [1, 0.8, 1]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatDelay: 6, // Pulse every 8 seconds (6s delay + 2s animation)
                ease: "easeInOut"
              }}
            >
              ⚡ AI ASSIST
            </motion.div>
            <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-electric-600"></div>
          </motion.div>
        </div>
      </motion.div>

      {/* Drawer Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.div
              className="drawer-overlay fixed inset-0"
              onClick={() => onToggle(false)}
            />

            {/* Drawer */}
            <motion.div
              className="fixed right-0 top-0 h-full w-96 glass border-l border-white/10 flex flex-col"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
            >
              {/* Header */}
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-electric-gradient rounded-full flex items-center justify-center">
                      <span className="text-white text-lg">🤖</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-white">AI Assistant</h2>
                      <p className="text-gray-400 text-sm">
                        {ws ? 'Connected' : 'Connecting...'}
                      </p>
                    </div>
                  </div>
                  <motion.button
                    onClick={() => onToggle(false)}
                    className="text-gray-400 hover:text-white transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    ✕
                  </motion.button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-electric">
                {messages.length === 0 && (
                  <motion.div
                    className="text-center text-gray-400 py-8"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="text-4xl mb-4">👋</div>
                    <h3 className="text-lg font-medium mb-2">Welcome to EZE Assistant!</h3>
                    <p className="text-sm">
                      Ask me about your finances or tell me to create transactions.
                    </p>
                    <div className="mt-4 space-y-2 text-xs">
                      <div className="bg-white/5 rounded-lg p-2">
                        "Add a $200 software expense for Adobe"
                      </div>
                      <div className="bg-white/5 rounded-lg p-2">
                        "What's my profit this month?"
                      </div>
                    </div>
                  </motion.div>
                )}

                {messages.map((message, index) => (
                  <motion.div
                    key={message.id}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-3 rounded-xl ${
                        message.type === 'user'
                          ? 'bg-electric-gradient text-white'
                          : 'glass text-gray-100'
                      }`}
                    >
                      <p className="text-sm leading-relaxed">{message.content}</p>
                      <p className={`text-xs mt-1 ${
                        message.type === 'user' ? 'text-purple-100' : 'text-gray-400'
                      }`}>
                        {formatTime(message.timestamp)}
                      </p>
                    </div>
                  </motion.div>
                ))}

                {isTyping && (
                  <motion.div
                    className="flex justify-start"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <div className="glass px-4 py-3 rounded-xl">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-electric-400 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-electric-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                        <div className="w-2 h-2 bg-electric-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                      </div>
                    </div>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-6 border-t border-white/10">
                <div className="flex space-x-3">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask me anything about your finances..."
                    className="flex-1 input-glass text-sm"
                    disabled={!ws}
                  />
                  <motion.button
                    onClick={sendMessage}
                    disabled={!inputValue.trim() || !ws}
                    className="btn-electric px-4 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    whileHover={{ scale: inputValue.trim() && ws ? 1.05 : 1 }}
                    whileTap={{ scale: inputValue.trim() && ws ? 0.95 : 1 }}
                  >
                    <span className="text-lg">📤</span>
                  </motion.button>
                </div>
                
                <div className="mt-3 flex items-center justify-center text-xs text-gray-500">
                  <span className="mr-2">🎤</span>
                  Voice mode coming soon
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default ChatDrawer 