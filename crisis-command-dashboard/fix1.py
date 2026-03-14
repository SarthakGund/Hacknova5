import sys

with open('c:/ResQnet-main/ResQnet-prasham-new/crisis-command-dashboard/components/communications-panel.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('{\\w-2 h-2 rounded-full \\}', '{`w-2 h-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`}')
text = text.replace('{\\flex flex-col max-w-[85%] \\}', '{`flex flex-col max-w-[85%] ${isMine ? "ml-auto items-end" : "mr-auto items-start"}`}')
text = text.replace('{\\p-3 rounded-2xl shadow-sm text-sm \\}', '{`p-3 rounded-2xl shadow-sm text-sm ${isMine ? "bg-[#007BFF] text-white rounded-tr-sm" : "bg-white border border-[#E9ECEF] text-gray-800 rounded-tl-sm"}`}')

with open('c:/ResQnet-main/ResQnet-prasham-new/crisis-command-dashboard/components/communications-panel.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
