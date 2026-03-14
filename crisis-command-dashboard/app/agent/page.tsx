import AgentChat from "@/components/AgentChat"

export const metadata = {
    title: "FloodShield — AI Agent Console",
    description: "Autonomous LangChain disaster response agent with live tool call tracing",
}

export default function AgentPage() {
    return (
        <div style={{ height: "100dvh", display: "flex", flexDirection: "column" }}>
            <AgentChat />
        </div>
    )
}
