"use client"

import { User, Bell, Shield, MapPin, Clock, Award, Settings, LogOut, ChevronRight, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

export default function ProfileView() {
    const router = useRouter()
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)
    const [currentUser, setCurrentUser] = useState<any>(null)

    // Load current user
    useEffect(() => {
        setMounted(true)
        const userStr = localStorage.getItem('currentUser')
        if (userStr) {
            setCurrentUser(JSON.parse(userStr))
        }
    }, [])

    const handleLogout = () => {
        localStorage.removeItem('authToken')
        localStorage.removeItem('currentUser')
        router.push('/')
    }

    const stats = [
        { label: "Missions Completed", value: "127", icon: Award },
        { label: "Hours on Duty", value: "1,240", icon: Clock },
        { label: "Response Time Avg", value: "4.2 min", icon: MapPin },
    ]

    const menuItems = [
        { icon: Bell, label: "Notifications", badge: "3", action: () => { } },
        { icon: Shield, label: "Safety Protocols", action: () => { } },
        { icon: Settings, label: "Settings", action: () => { } },
        { icon: LogOut, label: "Sign Out", danger: true, action: handleLogout },
    ]

    return (
        <div className="flex flex-col h-full bg-background pb-20 overflow-y-auto">
            {/* Header */}
            <div className="gradient-header border-b border-border">
                <div className="px-4 py-6">
                    <div className="flex items-center gap-4 mb-4">
                        {/* Avatar */}
                        <div className="w-20 h-20 rounded-full bg-primary/20 text-primary ring-4 ring-primary/30 flex items-center justify-center font-bold text-2xl flex-shrink-0 shadow-apple">
                            {currentUser?.name?.substring(0, 2).toUpperCase() || "??"}
                        </div>

                        {/* Info */}
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold mb-1">{currentUser?.name || "Loading..."}</h1>
                            <p className="text-sm text-muted-foreground mb-1">{currentUser?.role === 'responder' ? 'Field Responder' : 'User'}</p>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-success/20 text-success text-xs font-semibold rounded-full">
                                    {currentUser?.status || 'Active'}
                                </span>
                                <span className="text-xs text-muted-foreground font-mono">ID-{currentUser?.id}</span>
                            </div>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2">
                        {stats.map((stat) => {
                            const Icon = stat.icon
                            return (
                                <div key={stat.label} className="card-elevated rounded-2xl p-3 text-center shadow-apple">
                                    <Icon className="w-4 h-4 mx-auto mb-1 text-primary" />
                                    <div className="text-lg font-bold">{stat.value}</div>
                                    <div className="text-[10px] text-muted-foreground leading-tight">{stat.label}</div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="px-4 py-4 space-y-4">
                {/* Theme Toggle */}
                <div className="card-elevated rounded-2xl p-4 shadow-apple">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            {mounted && theme === "dark" ? (
                                <Moon className="w-5 h-5 text-primary" />
                            ) : (
                                <Sun className="w-5 h-5 text-primary" />
                            )}
                            <div>
                                <div className="font-semibold">Appearance</div>
                                <div className="text-xs text-muted-foreground">
                                    {mounted ? (theme === "dark" ? "Dark Mode" : "Light Mode") : "Loading..."}
                                </div>
                            </div>
                        </div>
                    </div>
                    {mounted && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => setTheme("light")}
                                className={cn(
                                    "flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold transition-apple ios-press flex items-center justify-center gap-2",
                                    theme === "light"
                                        ? "bg-primary text-primary-foreground shadow-apple"
                                        : "bg-muted/50 hover:bg-muted"
                                )}
                            >
                                <Sun className="w-4 h-4" />
                                Light
                            </button>
                            <button
                                onClick={() => setTheme("dark")}
                                className={cn(
                                    "flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold transition-apple ios-press flex items-center justify-center gap-2",
                                    theme === "dark"
                                        ? "bg-primary text-primary-foreground shadow-apple"
                                        : "bg-muted/50 hover:bg-muted"
                                )}
                            >
                                <Moon className="w-4 h-4" />
                                Dark
                            </button>
                        </div>
                    )}
                </div>

                {/* Menu Items */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    {menuItems.map((item, index) => {
                        const Icon = item.icon
                        return (
                            <button
                                key={item.label}
                                onClick={item.action}
                                className={cn(
                                    "w-full flex items-center justify-between px-4 py-3.5 hover:bg-muted/50 transition-all active:scale-[0.99]",
                                    index !== menuItems.length - 1 && "border-b border-border",
                                    item.danger && "text-accent"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <Icon className="w-5 h-5" />
                                    <span className="font-medium">{item.label}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {item.badge && (
                                        <span className="px-2 py-0.5 bg-accent text-accent-foreground text-xs font-semibold rounded-full">
                                            {item.badge}
                                        </span>
                                    )}
                                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                </div>
                            </button>
                        )
                    })}
                </div>

                {/* Recent Activity */}
                <div className="bg-card border border-border rounded-2xl p-4">
                    <h3 className="font-semibold mb-3">Recent Activity</h3>
                    <div className="space-y-3">
                        {[
                            { action: "Completed mission", detail: "FR-2845 - Traffic Accident", time: "2 hours ago" },
                            { action: "Responded to", detail: "FR-2846 - Medical Emergency", time: "5 hours ago" },
                            { action: "Training completed", detail: "Fire Safety Protocol", time: "1 day ago" },
                        ].map((activity, index) => (
                            <div key={index} className="flex items-start gap-3 pb-3 border-b border-border last:border-0 last:pb-0">
                                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium">{activity.action}</div>
                                    <div className="text-xs text-muted-foreground">{activity.detail}</div>
                                </div>
                                <div className="text-xs text-muted-foreground whitespace-nowrap">{activity.time}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Version Info */}
                <div className="text-center text-xs text-muted-foreground py-4">
                    Crisis Management System v2.1.0
                    <br />
                    © 2026 Crisis Management System
                    {currentUser && (
                        <>
                            <br />
                            <span className="font-mono">Logged in as: {currentUser.username}</span>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
