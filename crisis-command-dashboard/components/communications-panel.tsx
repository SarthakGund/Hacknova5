"use client"

import { Send, Loader2, MessageSquare } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { useWebSocket } from "@/hooks/use-websocket"

export default function CommunicationsPanel() {
    const [messages, setMessages] = useState<any[]>([])
    const [pendingMessage, setPendingMessage] = useState("")
    const [isSending, setIsSending] = useState(false)
    const [currentUser, setCurrentUser] = useState<any>(null)
    const scrollRef = useRef<HTMLDivElement>(null)

    const { on, off, emit, isConnected } = useWebSocket({
        autoConnect: true,
        onConnect: () => {
            console.log('Communications Panel connected to WebSocket')
        },
    })

    // Load current user from localStorage
    useEffect(() => {
        const userStr = localStorage.getItem('currentUser')
        if (userStr) {
            const user = JSON.parse(userStr)
            setCurrentUser(user)
            console.log('Current user:', user)
        } else {
            // Default command center user if not logged in
            setCurrentUser({
                id: 0,
                name: 'Command Center',
                role: 'user'
            })
        }
    }, [])

    useEffect(() => {
        // Show welcome message
        setMessages([
            {
                id: 'welcome',
                sender_id: null,
                sender_name: 'System',
                message: 'Command Center communications active. All messages are broadcast to field responders.',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                type: 'system',
                status: 'read'
            }
        ])
    }, [])

    useEffect(() => {
        if (!isConnected || !currentUser) return

        const handleBroadcastMessage = (data: any) => {
            console.log("Broadcast message received:", data)

            // Prevent duplicate messages by checking if message already exists
            setMessages(prev => {
                const exists = prev.some(msg => msg.id === data.comm_id)
                if (exists) {
                    console.log("Message already exists, skipping duplicate")
                    return prev
                }

                const newMsg = {
                    id: data.comm_id,
                    sender_id: data.sender_id,
                    sender_name: data.sender_name,
                    message: data.message,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    type: data.sender_id === currentUser.id ? 'sent' : 'received',
                    status: 'delivered'
                }
                return [...prev, newMsg]
            })
        }

        // Register listener once when socket connects
        on('broadcast_received', handleBroadcastMessage)

        // Cleanup when socket disconnects or component unmounts
        return () => {
            off('broadcast_received', handleBroadcastMessage)
        }
    }, [isConnected, currentUser, on, off])

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages])

    const handleSendMessage = async () => {
        if (!pendingMessage.trim() || isSending || !currentUser) return

        try {
            setIsSending(true)

            emit('broadcast_message', {
                message: pendingMessage,
                sender_name: currentUser.name,
                sender_id: currentUser.id,
                timestamp: new Date().toISOString(),
            })

            setPendingMessage("")
        } catch (error) {
            console.error("Error sending message:", error)
        } finally {
            setIsSending(false)
        }
    }

    const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage()
        }
    }

    return (
        <div className="flex flex-col h-full bg-[#F8F9FA]">
            {/* Header */}
            <div className="p-4 border-b border-[#E9ECEF] bg-white flex justify-between items-center shrink-0">
                <h2 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                   <MessageSquare className="w-5 h-5 text-[#007BFF]" />
                   Broadcast Channel
                </h2>
                <div className="flex items-center gap-2">
                   <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                   <span className="text-xs font-bold uppercase tracking-wider text-gray-500">{isConnected ? 'LIVE' : 'OFFLINE'}</span>
                </div>
            </div>

            {/* Messages Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                    <div className="text-center py-20 bg-white border border-[#E9ECEF] rounded-xl">
                        <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500 font-medium">No messages yet.</p>
                        <p className="text-xs text-gray-400 mt-1">Start the conversation by typing below.</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMine = msg.sender_id === currentUser?.id;
                        return (
                            <div key={msg.id} className={`flex flex-col max-w-[85%] ${isMine ? "ml-auto items-end" : "mr-auto items-start"}`}>
                                <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-1 ml-1">
                                    {isMine ? "You" : msg.sender_name}
                                </span>
                                <div className={`p-3 rounded-2xl shadow-sm text-sm ${isMine ? "bg-[#007BFF] text-white rounded-tr-sm" : "bg-white border border-[#E9ECEF] text-gray-800 rounded-tl-sm"}`}>
                                    {msg.message}
                                </div>
                                <span className="text-[9px] font-medium text-gray-400 mt-1 mr-1">
                                    {msg.time ?? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-[#E9ECEF] bg-white shrink-0">
                <div className="flex relative items-end">
                    <textarea
                        value={pendingMessage}
                        onChange={(e) => setPendingMessage(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Type a broadcast message..."
                        className="w-full bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-[#007BFF] focus:ring-1 focus:ring-[#007BFF] resize-none h-12 min-h-[48px] max-h-32 shadow-inner"
                        disabled={!currentUser || isSending}
                        rows={1}
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!pendingMessage.trim() || isSending || !currentUser}
                        className="absolute right-2 bottom-2 p-1.5 bg-[#007BFF] text-white rounded-lg hover:bg-[#0056b3] disabled:opacity-50 disabled:hover:bg-[#007BFF] transition-colors shadow-sm"
                    >
                        {isSending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                    </button>
                </div>
                {!currentUser && (
                    <p className="text-[10px] text-[#DC3545] font-bold uppercase tracking-wider mt-2">System offline: Cannot send messages.</p>
                )}
            </div>
        </div>
    )
}
