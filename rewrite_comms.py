import sys

with open('c:/ResQnet-main/ResQnet-prasham-new/crisis-command-dashboard/components/communications-panel.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

start_idx = text.find('    return (')

if start_idx != -1:
    before = text[:start_idx]
    
    new_jsx = '''    return (
        <div className=\"flex flex-col h-full bg-[#F8F9FA]\">
            {/* Header */}
            <div className=\"p-4 border-b border-[#E9ECEF] bg-white flex justify-between items-center shrink-0\">
                <h2 className=\"font-bold text-gray-800 text-lg flex items-center gap-2\">
                   <MessageSquare className=\"w-5 h-5 text-[#007BFF]\" />
                   Broadcast Channel
                </h2>
                <div className=\"flex items-center gap-2\">
                   <div className={\w-2 h-2 rounded-full \\}></div>
                   <span className=\"text-xs font-bold uppercase tracking-wider text-gray-500\">{isConnected ? 'LIVE' : 'OFFLINE'}</span>
                </div>
            </div>

            {/* Messages Area */}
            <div ref={scrollRef} className=\"flex-1 overflow-y-auto p-4 space-y-4\">
                {messages.length === 0 ? (
                    <div className=\"text-center py-20 bg-white border border-[#E9ECEF] rounded-xl\">
                        <MessageSquare className=\"w-8 h-8 text-gray-300 mx-auto mb-3\" />
                        <p className=\"text-sm text-gray-500 font-medium\">No messages yet.</p>
                        <p className=\"text-xs text-gray-400 mt-1\">Start the conversation by typing below.</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMine = msg.sender_id === currentUser?.id;
                        return (
                            <div key={msg.id} className={\lex flex-col max-w-[85%] \\}>
                                <span className=\"text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-1 ml-1\">
                                    {isMine ? \"You\" : msg.sender_name}
                                </span>
                                <div className={\p-3 rounded-2xl shadow-sm text-sm \\}>
                                    {msg.message}
                                </div>
                                <span className=\"text-[9px] font-medium text-gray-400 mt-1 mr-1\">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Input Area */}
            <div className=\"p-4 border-t border-[#E9ECEF] bg-white shrink-0\">
                <div className=\"flex relative items-end\">
                    <textarea
                        value={pendingMessage}
                        onChange={(e) => setPendingMessage(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder=\"Type a broadcast message...\"
                        className=\"w-full bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-[#007BFF] focus:ring-1 focus:ring-[#007BFF] resize-none h-12 min-h-[48px] max-h-32 shadow-inner\"
                        disabled={!currentUser || isSending}
                        rows={1}
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!pendingMessage.trim() || isSending || !currentUser}
                        className=\"absolute right-2 bottom-2 p-1.5 bg-[#007BFF] text-white rounded-lg hover:bg-[#0056b3] disabled:opacity-50 disabled:hover:bg-[#007BFF] transition-colors shadow-sm\"
                    >
                        {isSending ? (
                            <Loader2 className=\"w-4 h-4 animate-spin\" />
                        ) : (
                            <Send className=\"w-4 h-4\" />
                        )}
                    </button>
                </div>
                {!currentUser && (
                    <p className=\"text-[10px] text-[#DC3545] font-bold uppercase tracking-wider mt-2\">System offline: Cannot send messages.</p>
                )}
            </div>
        </div>
    )
}
'''
    with open('c:/ResQnet-main/ResQnet-prasham-new/crisis-command-dashboard/components/communications-panel.tsx', 'w', encoding='utf-8') as f:
        f.write(before + new_jsx)

