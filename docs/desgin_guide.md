# AXON: Design Implementation Brief for Codex 5.3

## System Overview
**Name:** AXON
**Aesthetic:** Stealth Utility / ChatGPT-grade Minimalism
**Stack:** FastAPI + Jinja2 + Tailwind CSS

---

## 1. Design Tokens (Tailwind Configuration)
Initialize your Tailwind theme with these values to achieve the monochromatic high-contrast look:

```javascript
// tailwind.config.js
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#000000',
        foreground: '#FFFFFF',
        card: {
          DEFAULT: '#000000',
          foreground: '#FFFFFF',
        },
        popover: {
          DEFAULT: '#000000',
          foreground: '#FFFFFF',
        },
        primary: {
          DEFAULT: '#FFFFFF',
          foreground: '#000000',
        },
        secondary: {
          DEFAULT: '#111111',
          foreground: '#FFFFFF',
        },
        muted: {
          DEFAULT: '#111111',
          foreground: '#A1A1AA',
        },
        accent: {
          DEFAULT: '#111111',
          foreground: '#FFFFFF',
        },
        border: '#27272A',
        input: '#27272A',
        ring: '#D4D4D8',
      },
      borderRadius: {
        lg: '0.5rem',
        md: 'calc(0.5rem - 2px)',
        sm: 'calc(0.5rem - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular'],
      },
    },
  },
}
```

---

## 2. Base Template Structure (Jinja2)
Use this as `templates/base.html` to ensure consistency across all consoles.

```html
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{% block title %}AXON{% endblock %}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; }
        .mono { font-family: 'JetBrains+Mono', monospace; }
        /* Smooth transitions for high-end feel */
        .transition-all { transition: all 0.2s ease-in-out; }
    </style>
</head>
<body class="bg-background text-foreground min-h-screen flex flex-col">
    <header class="border-b border-border p-4 flex justify-between items-center sticky top-0 bg-background/80 backdrop-blur-md z-50">
        <div class="flex items-center gap-3">
            <div class="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
            <span class="font-bold tracking-tight text-lg">AXON</span>
        </div>
        <nav class="hidden md:flex gap-6 text-sm font-medium text-muted-foreground">
            <a href="/" class="hover:text-foreground transition-all">Dashboard</a>
            <a href="/remote" class="hover:text-foreground transition-all">Remote</a>
            <a href="/sensor-page" class="hover:text-foreground transition-all">Sensors</a>
            <a href="/agent-page" class="hover:text-foreground transition-all">Agent</a>
            <a href="/video-page" class="hover:text-foreground transition-all">Video AI</a>
        </nav>
        <div class="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            v2.4.0 // SYSTEM: ACTIVE
        </div>
    </header>

    <main class="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        {% block content %}{% endblock %}
    </main>

    <footer class="border-t border-border p-6 text-center text-xs text-muted-foreground font-mono">
        (C) 2026 AXON SYSTEMS // MACHINED EARTH OS
    </footer>
</body>
</html>
```

---

## 3. Core UI Philosophies for Codex
When prompting Codex to build specific pages, use these descriptors:

1. **Liquid Glass Cards**: Use `bg-card border border-border p-6 rounded-lg` for all containers.
2. **Typography Hierarchy**: Use bold, tracking-tight headers for titles and JetBrains Mono for data/logs.
3. **Interactive Elements**: Buttons should be either high-contrast `bg-primary text-primary-foreground` or subtle `variant-ghost` with a border.
4. **Data Visualization**: Logs and event streams should use a terminal-style layout with timestamping.
5. **Responsiveness**: Use a single-column layout on mobile that expands into a 2 or 3-column grid on desktop using Tailwind's `grid-cols-1 md:grid-cols-3` classes.

---

## 4. Key Implementation Prompt
*Copy/Paste this to Codex:*
"I am building a mission-critical rescue platform called AXON using FastAPI and Jinja2. The UI aesthetic is ultra-minimalist 'Stealth Utility' (Black and White, high-contrast, professional grade). Use Inter for sans-serif and JetBrains Mono for system logs. All cards should have 1px borders (#27272A). Implement a responsive layout where mobile views stack vertically and desktop views use a multi-column grid. Reference the provided HTML screens for exact component layouts: Dashboard, Remote Console, Sensor Page, and Video Pipeline."