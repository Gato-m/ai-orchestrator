Bash
#!/bin/bash

# --- KONFIGURĀCIJA ---
PROJECT_DIR="/Users/webdev/img-stylizer/style-workflow"
DASHBOARD_URL="http://127.0.0.1:3001"

echo "🚀 Palaižam AI Orchestrator..."

# 1. ComfyUI Desktop atvēršana (ja ports 8188 vēl nav aktīvs)
if ! lsof -i:8188 > /dev/null; then
    echo "🔄 Atveram ComfyUI Desktop..."
    open -a "ComfyUI"
else
    echo "✅ ComfyUI jau darbojas (ports 8188)."
fi

# 2. Node Backend & Vite Frontend startēšana
if ! lsof -i:3001 > /dev/null; then
    echo "🔄 Startējam Web aplikāciju..."
    cd "$PROJECT_DIR" && npm run dev &
else
    echo "✅ Web aplikācija jau darbojas."
fi

# 3. Pagaidām 4 sekundes, lai visi serveri paspēj nodibināt savienojumus
sleep 4

# 4. Atveram Dashboard noklusētajā pārlūkprogrammā
open "$DASHBOARD_URL"