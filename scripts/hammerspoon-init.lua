-- Claude Voice - Hammerspoon Configuration
-- Full voice-to-text flow: press Cmd+. to start, press again to stop and send
-- Per-session daemon support: each terminal has its own daemon

require("hs.ipc")

-- Forward declarations
local ensureDaemonRunning
local getVoiceDaemonUrl

-- Track PTT state
local pttActive = false
local recordingAlert = nil
local daemonStarting = false
local currentDaemonPort = nil

-- Countdown state
local countdownTimer = nil
local countdownSeconds = 3
local pendingText = nil

-- Auto-submit mode (false = show countdown, true = send immediately)
local autoSubmitEnabled = false

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

-- Find any running voice daemon (checks all port files)
local function findAnyDaemonPort()
    -- Look for any claude-voice port file
    local handle = io.popen('ls /tmp/claude-voice-*.port 2>/dev/null')
    if handle then
        local files = handle:read("*a")
        handle:close()

        -- Try each port file
        for portFile in files:gmatch("[^\n]+") do
            local fh = io.open(portFile, "r")
            if fh then
                local port = fh:read("*a")
                fh:close()
                port = port:gsub("%s+", "")
                local portNum = tonumber(port)
                if portNum then
                    -- Verify daemon is actually responding on this port
                    local checkHandle = io.popen('curl -s -o /dev/null -w "%{http_code}" --connect-timeout 0.5 http://127.0.0.1:' .. portNum .. '/status 2>/dev/null')
                    if checkHandle then
                        local result = checkHandle:read("*a")
                        checkHandle:close()
                        if result == "200" then
                            print("Claude Voice: Found running daemon on port " .. portNum)
                            return portNum
                        end
                    end
                end
            end
        end
    end
    return nil
end

-- Get the voice daemon URL for the focused terminal
getVoiceDaemonUrl = function()
    -- First try to find port for focused terminal's TTY
    local tty = getFocusedTerminalTTY()
    local port = getPortForTTY(tty)

    if port then
        currentDaemonPort = port
        return "http://127.0.0.1:" .. port
    end

    -- Fallback: find ANY running daemon
    local anyPort = findAnyDaemonPort()
    if anyPort then
        currentDaemonPort = anyPort
        return "http://127.0.0.1:" .. anyPort
    end

    -- Ultimate fallback to default port
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
        hs.alert.show("Voice not enabled.\nRun /voice-mode-start in Claude Code", 3)
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

            -- Auto-submit if requested
            if autoSubmit then
                hs.timer.doAfter(0.1, function()
                    hs.eventtap.keyStroke({}, "return")
                end)
            end
        end)
    end)
end

-- PTT Start
local function pttStart()
    if pttActive then return end

    -- Ensure daemon is running before starting PTT
    ensureDaemonRunning(function(success)
        if success then
            pttActive = true
            print("Claude Voice: Recording started (port " .. tostring(currentDaemonPort) .. ")")
            sendToVoiceDaemon("/ptt/start")

            -- Show recording in terminal title
            setTerminalTitle("Recording...")
        else
            hs.alert.show("Voice daemon not available", 2)
        end
    end)
end

-- PTT Stop - this triggers transcription and typing
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

-- Cancel any pending countdown
local function cancelCountdown()
    if countdownTimer then
        countdownTimer:stop()
        countdownTimer = nil
    end
    pendingText = nil
end

-- Start countdown before sending
local function startCountdown(text)
    pendingText = text
    local remaining = countdownSeconds

    -- Type text first (without submitting)
    typeText(text, false)

    -- Show initial countdown
    hs.alert.show("Sending in " .. remaining .. "... (Cmd+. to cancel)", 1)

    countdownTimer = hs.timer.doEvery(1, function()
        remaining = remaining - 1
        if remaining > 0 then
            hs.alert.show("Sending in " .. remaining .. "... (Cmd+. to cancel)", 1)
        else
            -- Countdown finished, submit
            countdownTimer:stop()
            countdownTimer = nil
            pendingText = nil
            hs.alert.show("Sent!", 0.5)
            hs.eventtap.keyStroke({}, "return")
        end
    end)
end

-- Check for transcription result
local transcriptionAttempts = 0
function checkTranscription()
    hs.http.asyncGet(getVoiceDaemonUrl() .. "/transcription", nil, function(status, body, headers)
        if status == 200 and body and body ~= "" then
            local text = body:gsub("^%s*(.-)%s*$", "%1") -- trim whitespace
            if text ~= "" then
                print("Claude Voice: Got transcription: " .. text)

                if autoSubmitEnabled then
                    -- Immediate send
                    hs.alert.show("Typing: " .. text:sub(1, 50) .. "...", 1)
                    typeText(text, true)
                else
                    -- Countdown before send
                    startCountdown(text)
                end
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
-- TOGGLE MODE HOTKEY
-- ============================================

-- Cmd+. - Toggle recording (primary hotkey)
-- Also cancels countdown if one is active
hs.hotkey.bind({"cmd"}, ".", function()
    -- If countdown is active, cancel it and clear the text
    if countdownTimer then
        cancelCountdown()
        -- Select all and delete to clear the typed text
        hs.eventtap.keyStroke({"cmd"}, "a")
        hs.timer.doAfter(0.05, function()
            hs.eventtap.keyStroke({}, "delete")
        end)
        hs.alert.show("Cancelled - edit your message or press Cmd+. to record again", 2)
        return
    end

    if pttActive then
        pttStop()
    else
        pttStart()
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
- Cmd+. - Start/stop recording
- Cmd+. during countdown - Cancel and edit
- Cmd+Ctrl+R - Reload config

Flow: Record → Text appears → 3s countdown → Auto-send
Press Cmd+. during countdown to cancel and edit manually.
]], 7)
end)

-- Notify ready
hs.alert.show("Claude Voice ready! Press Cmd+. to talk", 3)

print("Claude Voice: Configuration loaded")
print("Claude Voice: Press Cmd+. to talk")
