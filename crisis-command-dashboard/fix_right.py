import re

with open('c:/ResQnet-main/ResQnet-prasham-new/crisis-command-dashboard/components/right-sidebar.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('  return (')
if idx != -1:
    before = text[:idx]
    
    new_jsx = '''  return (
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
                {analyticsData?.performance?.average_response_time_minutes ? ${Math.round(analyticsData.performance.average_response_time_minutes)}m : '--'}
              </div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-[#E9ECEF] shadow-sm">
              <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">Resolution Rate</div>
              <div className="text-lg font-bold text-green-600">
                {analyticsData?.performance?.resolution_rate_percent !== undefined ? ${Math.round(analyticsData.performance.resolution_rate_percent)}% : '--'}
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
              <div className={p-1.5 rounded-md }>
                <Radio className={w-4 h-4 } />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-800">Voice AI</div>
                <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{systemStatus.voiceCall.devices} Lines Active</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={w-2 h-2 rounded-full } />
              <span className={	ext-xs font-bold uppercase tracking-wider }>
                {systemStatus.voiceCall.online ? "OK" : "FAIL"}
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-[#E9ECEF] shadow-sm">
            <div className="flex items-center gap-3">
              <div className={p-1.5 rounded-md }>
                <MessageSquare className={w-4 h-4 } />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-800">SMS Gateway</div>
                <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Twilio Sync</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={w-2 h-2 rounded-full } />
              <span className={	ext-xs font-bold uppercase tracking-wider }>
                {systemStatus.sms.online ? "OK" : "FAIL"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-[#E9ECEF] shadow-sm">
            <div className="flex items-center gap-3">
              <div className={p-1.5 rounded-md }>
                <Wifi className={w-4 h-4 } />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-800">LoRaWAN Mesh</div>
                <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{systemStatus.bluetoothMesh.devices} Nodes Found</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={w-2 h-2 rounded-full } />
              <span className={	ext-xs font-bold uppercase tracking-wider }>
                {systemStatus.bluetoothMesh.online ? "SYNCED" : "DOWN"}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
'''
    
    with open('c:/ResQnet-main/ResQnet-prasham-new/crisis-command-dashboard/components/right-sidebar.tsx', 'w', encoding='utf-8') as f:
        f.write(before + new_jsx)
        print('Right sidebar replaced successfully')
else:
    print('Failed to find return in right-sidebar.tsx')
