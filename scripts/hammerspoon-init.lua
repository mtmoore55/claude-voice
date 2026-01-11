-- Claude Voice - Hammerspoon Configuration
-- Full voice-to-text flow: hold key → speak → release → text typed into Claude
-- Per-session daemon support: each terminal has its own daemon

require("hs.ipc")

-- Forward declarations
local startResponseMonitor
local ensureDaemonRunning
local getVoiceDaemonUrl

-- Track PTT state
local pttActive = false
local recordingAlert = nil
local daemonStarting = false
local currentDaemonPort = nil

-- Auto-submit mode (set to true for full voice conversation)
local autoSubmitEnabled = true

-- Set terminal title to show recording status
local function setTerminalTitle(title)
    local app = hs.application.frontmostApplication()
    if not app then return end

    local appName = app:name()
    if appName == "Terminal" or appName == "iTerm2" or appName == "iTerm" then
        -- Use ANSI escape sequence to set terminal title
        -- Write directly via osascript
        local script
        if appName == "Terminal" then
            script = string.format([[
                tell application "Terminal"
                    set custom title of front window to "%s"
                end tell
            ]], title)
        else
            script = string.format([[
                tell application "iTerm2"
                    tell current session of current window
                        set name to "%s"
                    end tell
                end tell
            ]], title)
        end
        hs.osascript.applescript(script)
    end
end

-- Restore terminal title
local function restoreTerminalTitle()
    local app = hs.application.frontmostApplication()
    if not app then return end

    local appName = app:name()
    if appName == "Terminal" then
        hs.osascript.applescript([[
            tell application "Terminal"
                set custom title of front window to ""
            end tell
        ]])
    elseif appName == "iTerm2" or appName == "iTerm" then
        hs.osascript.applescript([[
            tell application "iTerm2"
                tell current session of current window
                    set name to ""
                end tell
            end tell
        ]])
    end
end

-- Get TTY for the focused terminal window
-- Uses Hammerspoon's window detection + System Events for accuracy
local function getFocusedTerminalTTY()
    local focusedApp = hs.application.frontmostApplication()
    if not focusedApp then
        print("Claude Voice: No focused app")
        return nil
    end

    local appName = focusedApp:name()
    print("Claude Voice: Focused app is " .. appName)

    -- Handle Terminal.app
    if appName == "Terminal" then
        -- Get the focused window from Hammerspoon (more reliable than AppleScript)
        local focusedWindow = focusedApp:focusedWindow()
        if focusedWindow then
            local windowId = focusedWindow:id()
            local windowTitle = focusedWindow:title() or ""
            local windowFrame = focusedWindow:frame()
            print("Claude Voice: Hammerspoon focused window ID: " .. tostring(windowId))
            print("Claude Voice: Hammerspoon focused window title: " .. windowTitle)
            print("Claude Voice: Window position: x=" .. tostring(windowFrame.x) .. " y=" .. tostring(windowFrame.y))

            -- Use System Events to find which Terminal window has keyboard focus
            -- Then match by position since System Events and Terminal share coordinates
            local script = string.format([[
                tell application "System Events"
                    tell process "Terminal"
                        set focusedWinName to ""
                        try
                            -- Get the focused window (the one with keyboard focus)
                            repeat with w in windows
                                if focused of w is true then
                                    set focusedWinName to name of w
                                    exit repeat
                                end if
                            end repeat
                        end try
                        if focusedWinName is "" then
                            -- Fallback: use window 1
                            if (count of windows) > 0 then
                                set focusedWinName to name of window 1
                            end if
                        end if
                        return focusedWinName
                    end tell
                end tell
            ]])
            local ok, focusedWinName = hs.osascript.applescript(script)

            if ok and focusedWinName and focusedWinName ~= "" then
                print("Claude Voice: System Events focused window: " .. focusedWinName)

                -- Now get the TTY for this window from Terminal.app
                local ttyScript = string.format([[
                    tell application "Terminal"
                        repeat with w in windows
                            if name of w is "%s" then
                                return tty of selected tab of w
                            end if
                        end repeat
                        -- Fallback
                        if (count of windows) > 0 then
                            return tty of selected tab of window 1
                        end if
                    end tell
                ]], focusedWinName:gsub('"', '\\"'))
                local ok2, ttyPath = hs.osascript.applescript(ttyScript)
                if ok2 and ttyPath then
                    print("Claude Voice: Got TTY via System Events: " .. ttyPath)
                    return ttyPath
                end
            end
        end

        -- Ultimate fallback: just use Terminal's front window
        print("Claude Voice: Falling back to Terminal front window")
        local fallbackScript = [[
            tell application "Terminal"
                if (count of windows) > 0 then
                    return tty of selected tab of front window
                end if
            end tell
        ]]
        local ok3, result3 = hs.osascript.applescript(fallbackScript)
        if ok3 and result3 then
            print("Claude Voice: Fallback TTY: " .. result3)
            return result3
        end
    end

    -- Handle iTerm2
    if appName == "iTerm2" or appName == "iTerm" then
        local script = [[
            tell application "iTerm2"
                if (count of windows) > 0 then
                    tell current session of current window
                        return tty
                    end tell
                end if
            end tell
        ]]
        local ok, result = hs.osascript.applescript(script)
        if ok and result then
            print("Claude Voice: iTerm TTY: " .. result)
            return result
        end
    end

    print("Claude Voice: Could not detect TTY")
    return nil
end

-- Get the voice daemon port for a given TTY
local function getPortForTTY(ttyPath)
    if not ttyPath then return nil end

    -- Extract TTY name (e.g., /dev/ttys002 -> ttys002)
    local ttyName = ttyPath:gsub("/dev/", "")

    -- Check for port file
    local portFile = "/tmp/claude-voice-" .. ttyName .. ".port"
    local handle = io.open(portFile, "r")
    if handle then
        local port = handle:read("*a")
        handle:close()
        port = port:gsub("%s+", "")
        local portNum = tonumber(port)
        if portNum then
            return portNum
        end
    end

    return nil
end

-- Get the voice daemon URL for the focused terminal
getVoiceDaemonUrl = function()
    local tty = getFocusedTerminalTTY()
    local port = getPortForTTY(tty)

    if port then
        currentDaemonPort = port
        return "http://127.0.0.1:" .. port
    end

    -- Fallback to default port
    currentDaemonPort = 17394
    return "http://127.0.0.1:17394"
end

-- Check if daemon is running for focused terminal
local function isDaemonRunning()
    local url = getVoiceDaemonUrl()
    local handle = io.popen('curl -s -o /dev/null -w "%{http_code}" --connect-timeout 1 ' .. url .. '/status 2>/dev/null')
    if handle then
        local result = handle:read("*a")
        handle:close()
        return result == "200"
    end
    return false
end

-- Start the daemon in background (no longer auto-starts - daemon should be started per-session)
ensureDaemonRunning = function(callback)
    if isDaemonRunning() then
        if callback then callback(true) end
        return
    end

    -- Per-session mode: daemon should already be running in the terminal
    -- Show a helpful message instead of auto-starting
    local tty = getFocusedTerminalTTY()
    if tty then
        print("Claude Voice: No daemon found for TTY " .. tty)
        hs.alert.show("Voice not enabled in this terminal.\nRun: claude-voice on", 3)
    else
        print("Claude Voice: No terminal focused or TTY not found")
        hs.alert.show("Focus a terminal with voice enabled", 2)
    end

    if callback then callback(false) end
end

-- Send HTTP request to voice daemon and get response
local function sendToVoiceDaemon(endpoint, callback)
    local url = getVoiceDaemonUrl() .. endpoint
    hs.http.asyncPost(url, "", nil, function(status, body, headers)
        if callback then
            callback(status, body)
        end
    end)
end

-- Type text into the current application and optionally submit
local function typeText(text, autoSubmit)
    if not text or text == "" then return end


    -- Use clipboard + paste for reliability
    local oldClipboard = hs.pasteboard.getContents()
    hs.pasteboard.setContents(text)

    -- Small delay then paste
    hs.timer.doAfter(0.05, function()
        hs.eventtap.keyStroke({"cmd"}, "v")

        -- Restore clipboard after paste
        hs.timer.doAfter(0.2, function()
            if oldClipboard then
                hs.pasteboard.setContents(oldClipboard)
            end

            -- Auto-submit if requested (TTS disabled)
            if autoSubmit then
                hs.timer.doAfter(0.1, function()
                    hs.eventtap.keyStroke({}, "return")
                end)
            end
        end)
    end)
end

-- Find the TTY that Claude is running on
local function findClaudeTTY()
    -- Look for 'claude' process with a real TTY (not ??)
    local handle = io.popen("ps aux | grep 'claude' | grep -v grep | grep -v '??' | awk '{print $7}' | grep -E '^s[0-9]+|^ttys[0-9]+' | head -1")
    if handle then
        local result = handle:read("*a")
        handle:close()
        local tty = result:gsub("%s+", "")
        if tty ~= "" then
            -- Add /dev/ prefix and normalize (s002 -> ttys002)
            if tty:match("^s%d") then
                return "/dev/tty" .. tty
            elseif tty:match("^ttys%d") then
                return "/dev/" .. tty
            end
        end
    end
    return nil
end

-- Send TTY path to daemon (uses focused terminal detection)
-- Returns the TTY that was detected
local function sendTTYToDaemon()
    local tty = getFocusedTerminalTTY()
    if tty then
        print("Claude Voice: Sending TTY to daemon: " .. tty)
        -- Use synchronous call to ensure TTY is set before PTT starts
        local status, body = hs.http.post(getVoiceDaemonUrl() .. "/tty", tty, nil)
        if status == 200 then
            print("Claude Voice: TTY set successfully to " .. tty)
        else
            print("Claude Voice: Failed to set TTY, status: " .. tostring(status))
        end
        return tty
    else
        print("Claude Voice: Could not detect focused terminal TTY")
        return nil
    end
end

-- PTT Start (key down)
local function pttStart()
    if pttActive then return end

    -- Ensure daemon is running before starting PTT
    -- Note: We do NOT override the daemon's TTY - the daemon knows its own TTY
    -- from startup and should render to that terminal
    ensureDaemonRunning(function(success)
        if success then
            pttActive = true
            print("Claude Voice: Recording started (port " .. tostring(currentDaemonPort) .. ")")
            sendToVoiceDaemon("/ptt/start")

            -- Show recording in terminal title
            setTerminalTitle("🎤 RECORDING...")
        else
            hs.alert.show("Voice daemon not available", 2)
        end
    end)
end

-- PTT Stop (key up) - this triggers transcription and typing
local function pttStop()
    if pttActive then
        pttActive = false
        print("Claude Voice: Recording stopped, waiting for transcription...")

        -- Stop recording and wait for transcription
        sendToVoiceDaemon("/ptt/stop")

        -- Restore terminal title
        restoreTerminalTitle()

        -- Poll for transcription result
        hs.timer.doAfter(0.5, function()
            checkTranscription()
        end)
    end
end

-- Check for transcription result
local transcriptionAttempts = 0
function checkTranscription()
    hs.http.asyncGet(getVoiceDaemonUrl() .. "/transcription", nil, function(status, body, headers)
        if status == 200 and body and body ~= "" then
            local text = body:gsub("^%s*(.-)%s*$", "%1") -- trim whitespace
            if text ~= "" then
                print("Claude Voice: Got transcription: " .. text)
                hs.alert.show("Typing: " .. text:sub(1, 50) .. "...", 1)
                typeText(text, autoSubmitEnabled)
                transcriptionAttempts = 0
                return
            end
        end

        -- Retry a few times
        transcriptionAttempts = transcriptionAttempts + 1
        if transcriptionAttempts < 10 then
            hs.timer.doAfter(0.3, checkTranscription)
        else
            print("Claude Voice: No transcription received")
            transcriptionAttempts = 0
        end
    end)
end

-- ============================================
-- HOLD-TO-TALK HOTKEYS
-- ============================================

-- Right Command key (hold to talk)
local cmdTap = hs.eventtap.new({hs.eventtap.event.types.flagsChanged}, function(event)
    local flags = event:getFlags()
    local keyCode = event:getKeyCode()

    -- Right Command = keycode 54
    if keyCode == 54 then
        if flags.cmd then
            pttStart()
        else
            pttStop()
        end
    end

    return false
end)
cmdTap:start()

-- F5 key (hold to talk) - more reliable
local f5Hotkey = hs.hotkey.new({}, "F5", pttStart, pttStop)
f5Hotkey:enable()

-- ============================================
-- TOGGLE MODE
-- ============================================

-- Cmd+. - Toggle recording (primary hotkey)
hs.hotkey.bind({"cmd"}, ".", function()
    if pttActive then
        pttStop()
    else
        pttStart()
    end
end)

-- Ctrl+Option+Space - Toggle mode (legacy)
hs.hotkey.bind({"ctrl", "alt"}, "space", function()
    if pttActive then
        pttStop()
    else
        pttStart()
    end
end)

-- ============================================
-- TTS - Speak Claude's Responses
-- ============================================

-- Find the most recent transcript file
local function findLatestTranscript()
    local projectDir = os.getenv("HOME") .. "/.claude/projects/-Users-mattmoore-Code-CCV"
    local handle = io.popen('ls -t "' .. projectDir .. '"/*.jsonl 2>/dev/null | head -1')
    if handle then
        local result = handle:read("*a")
        handle:close()
        return result:gsub("%s+$", "")
    end
    return nil
end

-- Get the last assistant response from transcript
local function getLastAssistantResponse(transcriptPath)
    if not transcriptPath or transcriptPath == "" then return nil end

    local handle = io.popen('grep \'"role":"assistant"\' "' .. transcriptPath .. '" | grep \'"type":"text"\' | tail -1')
    if handle then
        local line = handle:read("*a")
        handle:close()

        if line and line ~= "" then
            -- Extract text content using jq
            local jqHandle = io.popen('echo \'' .. line:gsub("'", "'\\''") .. '\' | jq -r \'.message.content[] | select(.type=="text") | .text // empty\' 2>/dev/null')
            if jqHandle then
                local text = jqHandle:read("*a")
                jqHandle:close()
                return text:gsub("%s+$", "")
            end
        end
    end
    return nil
end

-- Send text to TTS daemon
local function speakText(text)
    if not text or text == "" then return end

    -- Limit length
    if #text > 500 then
        text = text:sub(1, 500) .. "..."
    end

    hs.http.asyncPost(getVoiceDaemonUrl() .. "/speak", text, nil, function(status, body, headers)
        if status ~= 200 then
            print("Claude Voice: TTS failed - " .. tostring(status))
        end
    end)
end

-- Track last known response to avoid repeating
local lastSpokenResponse = ""
local monitorTimer = nil

-- Start monitoring for Claude's response
startResponseMonitor = function()
    local transcript = findLatestTranscript()
    if not transcript then
        print("Claude Voice: No transcript file found")
        return
    end

    -- Capture the current response so we know to ignore it
    local initialResponse = getLastAssistantResponse(transcript) or ""

    -- Get initial line count
    local handle = io.popen('wc -l "' .. transcript .. '" | awk \'{print $1}\'')
    local initialLineCount = 0
    if handle then
        local result = handle:read("*a")
        handle:close()
        local cleaned = result:gsub("%s+", "")
        initialLineCount = tonumber(cleaned) or 0
    end

    print("Claude Voice: Waiting for response...")
    local checkCount = 0
    local lastLineCount = initialLineCount
    local sawGrowth = false
    local waitingForGrowth = true

    monitorTimer = hs.timer.doEvery(0.5, function()
        checkCount = checkCount + 1

        -- Get current line count
        local handle = io.popen('wc -l "' .. transcript .. '" | awk \'{print $1}\'')
        local lineCount = 0
        if handle then
            local result = handle:read("*a")
            handle:close()
            local cleaned = result:gsub("%s+", "")
            lineCount = tonumber(cleaned) or 0
        end

        -- If file is growing, we're getting a response
        if lineCount > lastLineCount then
            sawGrowth = true
            waitingForGrowth = false
            lastLineCount = lineCount
            checkCount = 0
            return
        end

        -- If we've been waiting too long without growth, Claude might already be done
        if waitingForGrowth and checkCount >= 60 then
            sawGrowth = true -- Force check
        end

        -- Only check for response if we saw growth and file stopped changing for 2 checks
        if sawGrowth and checkCount >= 2 then
            if monitorTimer then
                monitorTimer:stop()
                monitorTimer = nil
            end

            local response = getLastAssistantResponse(transcript)
            -- Only speak if it's different from the initial response we captured
            if response and response ~= "" and response ~= initialResponse then
                lastSpokenResponse = response
                print("Claude Voice: Speaking response")
                speakText(response)
            end
        end

        -- Timeout after 30 seconds
        if checkCount > 60 then
            if monitorTimer then
                monitorTimer:stop()
                monitorTimer = nil
            end
        end
    end)
end

-- Hotkey to manually speak last response: Ctrl+Option+S
hs.hotkey.bind({"ctrl", "alt"}, "s", function()
    local transcript = findLatestTranscript()
    if transcript then
        local response = getLastAssistantResponse(transcript)
        if response and response ~= "" then
            hs.alert.show("Speaking: " .. response:sub(1, 50) .. "...", 2)
            speakText(response)
        else
            hs.alert.show("No response to speak", 2)
        end
    else
        hs.alert.show("No transcript found", 2)
    end
end)

-- ============================================
-- UTILITY
-- ============================================

-- Reload config: Cmd+Ctrl+R
hs.hotkey.bind({"cmd", "ctrl"}, "r", function()
    hs.reload()
end)

-- Show available hotkeys: Cmd+Ctrl+H
hs.hotkey.bind({"cmd", "ctrl"}, "h", function()
    hs.alert.show([[
Claude Voice Hotkeys:
• Cmd+. - Toggle recording
• Hold F5 - Talk
• Cmd+Ctrl+R - Reload config
]], 5)
end)

-- Notify ready
hs.alert.show("Claude Voice ready! Press Cmd+. to talk", 3)

print("Claude Voice: Configuration loaded")
print("Claude Voice: Press Cmd+. to talk")
