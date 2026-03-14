import sys

with open('c:/ResQnet-main/ResQnet-prasham-new/crisis-command-dashboard/components/incident-detail-view.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

start_idx = text.find('  return (')

if start_idx != -1:
    before = text[:start_idx]
    
    new_jsx = '''  return (
    <div className=\"bg-[#F8F9FA] rounded-b-xl border-t border-[#E9ECEF] overflow-hidden p-4 space-y-4\">
      {/* Description */}
      <div className=\"bg-white rounded-lg p-3 border border-[#E9ECEF] shadow-sm\">
         <h4 className=\"text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5\">Description</h4>
         <p className=\"text-sm text-gray-700 leading-relaxed\">{incident.description}</p>
         {incident.ai_analysis && (
           <div className=\"mt-3 p-2 bg-blue-50/50 border border-blue-100 rounded text-xs text-blue-800 flex items-start gap-2 leading-relaxed\">
             <div className=\"mt-0.5\">🤖</div>
             <div><strong className=\"block mb-0.5\">AI Analysis</strong>{incident.ai_analysis}</div>
           </div>
         )}
      </div>

      {/* Source & Reporter */}
      <div className=\"grid grid-cols-2 gap-3\">
         <div className=\"bg-white rounded-lg p-3 border border-[#E9ECEF] shadow-sm flex flex-col justify-center\">
            <h4 className=\"text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1\">Source</h4>
            <div className=\"flex items-center gap-1.5 text-sm text-gray-800 font-medium\">
               {getReportSourceIcon(incident.reportSource)}
               {getReportSourceLabel(incident.reportSource)}
            </div>
         </div>
         {incident.reporterPhone && (
           <div className=\"bg-white rounded-lg p-3 border border-[#E9ECEF] shadow-sm flex flex-col justify-center\">
              <h4 className=\"text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 flex items-center gap-1\"><Smartphone className=\"w-3 h-3\"/> Reporter</h4>
              <div className=\"text-sm text-gray-800 font-mono font-bold tracking-tight\">
                 {incident.reporterPhone}
              </div>
           </div>
         )}
      </div>

      {/* Assigned Personnel */}
      <div className=\"bg-white rounded-lg p-3 border border-[#E9ECEF] shadow-sm\">
        <div className=\"flex justify-between items-center mb-2\">
            <h4 className=\"text-[10px] font-bold uppercase tracking-wider text-gray-400\">Assigned Units ({incident.responders?.length || 0})</h4>
            <div className=\"text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded\">{incident.arrivedUnits || 0} Assisting</div>
        </div>
        
        {incident.responders && incident.responders.length > 0 ? (
          <div className=\"space-y-1.5\">
            {incident.responders.map((resp, idx) => (
              <div key={idx} className=\"flex items-center justify-between text-xs py-1 border-b border-[#E9ECEF] last:border-0\">
                <div className=\"flex items-center gap-1.5 font-medium text-gray-700\">
                  <Users className=\"w-3 h-3 text-[#007BFF]\" />
                  {typeof resp === 'string' ? resp : resp.name}
                </div>
                <span className={\	ext-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded \\}>
                   {idx % 2 === 0 ? 'En Route' : 'Assisting'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className=\"text-xs text-gray-500 italic py-1\">No personnel assigned yet.</p>
        )}
      </div>

      <div className=\"grid gap-2 pt-2\">
        <button
          onClick={() => onConfirmResolution(incident.id)}
          className=\"w-full flex items-center justify-center gap-2 bg-[#DC3545] hover:bg-[#c82333] text-white py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm\"
        >
          <CheckCircle className=\"w-4 h-4\" />
          Mark as Resolved
        </button>
      </div>
    </div>
  )
}
'''
    
    with open('c:/ResQnet-main/ResQnet-prasham-new/crisis-command-dashboard/components/incident-detail-view.tsx', 'w', encoding='utf-8') as f:
        f.write(before + new_jsx)

