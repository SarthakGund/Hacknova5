import sys

with open('c:/ResQnet-main/ResQnet-prasham-new/crisis-command-dashboard/components/communications-panel.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

start_idx = text.find('    return (')

if start_idx != -1:
    before = text[:start_idx]
    after = text[text.rfind('    </div>\n    )\n}')+18:] if text.rfind('    </div>\n    )\n}') != -1 else ''
    
    new_jsx = """    return (
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
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
"""
    with open('c:/ResQnet-main/ResQnet-prasham-new/crisis-command-dashboard/components/communications-panel.tsx', 'w', encoding='utf-8') as f:
        f.write(before + new_jsx)
        
with open('c:/ResQnet-main/ResQnet-prasham-new/crisis-command-dashboard/components/right-sidebar.tsx', 'r', encoding='utf-8') as f:
    text2 = f.read()

start_idx = text2.find('  return (')

if start_idx != -1:
    before = text2[:start_idx]
    
    new_jsx = """  return (
    <div className="flex flex-col h-full bg-[#F8F9FA] overflow-y-auto hidden-scrollbar p-5 space-y-6">
      
      {/* Analytics Overview */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 border-b border-[#E9ECEF] pb-2">
          <TrendingUp className="w-4 h-4 text-[#007BFF]" />
          Situation Overview
        </h3>
        
        {loading ? (
          <div className="flex items-center justify-center p-6">
            <div className="w-6 h-6 border-2 border-[#007BFF] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-3 rounded-lg border border-[#E9ECEF] shadow-sm">
              <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">Avg Response</div>
              <div className="text-lg font-bold text-gray-800">
                {analyticsData?.performance?.average_response_time_minutes ? `${Math.round(analyticsData.performance.average_response_time_minutes)}m` : '--'}
              </div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-[#E9ECEF] shadow-sm">
              <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">Resolution Rate</div>
              <div className="text-lg font-bold text-green-600">
                {analyticsData?.performance?.resolution_rate_percent !== undefined ? `${Math.round(analyticsData.performance.resolution_rate_percent)}%` : '--'}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Incidents Over Time Chart */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 border-b border-[#E9ECEF] pb-2">
          <TrendingUp className="w-4 h-4 text-gray-400" />
          Incident Trend (8h)
        </h3>
        <div className="bg-white p-4 rounded-lg border border-[#E9ECEF] shadow-sm h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={incidentsOverTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E9ECEF" vertical={false} />
              <XAxis dataKey="time" fontSize={10} tickLine={false} axisLine={false} tick={{fill: '#9CA3AF'}} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #E9ECEF', fontSize: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
                itemStyle={{ color: '#007BFF', fontWeight: 'bold' }}
              />
              <Line type="monotone" dataKey="count" stroke="#DC3545" strokeWidth={2} dot={{ r: 3, fill: '#DC3545', strokeWidth: 0 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Resource Allocation Chart */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 border-b border-[#E9ECEF] pb-2">
          <PieChart className="w-4 h-4 text-gray-400" />
          Resource Allocation
        </h3>
        <div className="bg-white p-4 rounded-lg border border-[#E9ECEF] shadow-sm h-48">
          {resourceAllocation.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={resourceAllocation} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E9ECEF" horizontal={true} vertical={false} />
                <XAxis type="number" fontSize={10} hide />
                <YAxis dataKey="name" type="category" fontSize={10} width={80} tickLine={false} axisLine={false} tick={{fill: '#6B7280'}} />
                <Tooltip 
                  cursor={{fill: '#F8F9FA'}}
                  contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #E9ECEF', fontSize: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }} 
                />
                <Bar dataKey="value" fill="#007BFF" radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-gray-400 italic">
              No resources deployed
            </div>
          )}
        </div>
      </section>

      {/* System Status */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 border-b border-[#E9ECEF] pb-2">
          <AlertCircle className="w-4 h-4 text-gray-400" />
          Ingestion Systems
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-[#E9ECEF] shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-md ${systemStatus.voiceCall.online ? 'bg-green-100' : 'bg-red-100'}`}>
                <Radio className={`w-4 h-4 ${systemStatus.voiceCall.online ? 'text-green-600' : 'text-red-600'}`} />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-800">Voice AI</div>
                <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{systemStatus.voiceCall.devices} Lines Active</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${systemStatus.voiceCall.online ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className={`text-xs font-bold uppercase tracking-wider ${systemStatus.voiceCall.online ? 'text-green-600' : 'text-red-600'}`}>
                {systemStatus.voiceCall.online ? "OK" : "FAIL"}
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-[#E9ECEF] shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-md ${systemStatus.sms.online ? 'bg-green-100' : 'bg-red-100'}`}>
                <MessageSquare className={`w-4 h-4 ${systemStatus.sms.online ? 'text-green-600' : 'text-red-600'}`} />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-800">SMS Gateway</div>
                <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Twilio Sync</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${systemStatus.sms.online ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className={`text-xs font-bold uppercase tracking-wider ${systemStatus.sms.online ? 'text-green-600' : 'text-red-600'}`}>
                {systemStatus.sms.online ? "OK" : "FAIL"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-[#E9ECEF] shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-md ${systemStatus.bluetoothMesh.online ? 'bg-green-100' : 'bg-red-100'}`}>
                <Wifi className={`w-4 h-4 ${systemStatus.bluetoothMesh.online ? 'text-green-600' : 'text-red-600'}`} />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-800">LoRaWAN Mesh</div>
                <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{systemStatus.bluetoothMesh.devices} Nodes Found</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${systemStatus.bluetoothMesh.online ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className={`text-xs font-bold uppercase tracking-wider ${systemStatus.bluetoothMesh.online ? 'text-green-600' : 'text-red-600'}`}>
                {systemStatus.bluetoothMesh.online ? "SYNCED" : "DOWN"}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
"""
    with open('c:/ResQnet-main/ResQnet-prasham-new/crisis-command-dashboard/components/right-sidebar.tsx', 'w', encoding='utf-8') as f:
        f.write(before + new_jsx)

