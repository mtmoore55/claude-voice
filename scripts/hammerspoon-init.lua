-- Claude Voice - Hammerspoon Configuration
-- Full voice-to-text flow: hold key → speak → release → text typed into Claude

require("hs.ipc")

local VOICE_DAEMON_PORT = 17394
local VOICE_DAEMON_URL = "http://127.0.0.1:" .. VOICE_DAEMON_PORT

-- Forward declarations
local startResponseMonitor

-- Track PTT state
local pttActive = false
local recordingAlert = nil

-- Auto-submit mode (set to true for full voice conversation)
local autoSubmitEnabled = true

-- Send HTTP request to voice daemon and get response
local function sendToVoiceDaemon(endpoint, callback)
    local url = VOICE_DAEMON_URL .. endpoint
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

            -- Auto-submit and start response monitor if requested
            if autoSubmit then
                hs.timer.doAfter(0.1, function()
                    hs.eventtap.keyStroke({}, "return")
                    -- Start monitoring for Claude's response
                    hs.timer.doAfter(0.5, function()
                        startResponseMonitor()
                    end)
                end)
            end
        end)
    end)
end

-- PTT Start (key down)
local function pttStart()
    if not pttActive then
        pttActive = true
        print("Claude Voice: Recording started")
        recordingAlert = hs.alert.show("🎤 Recording...", 999)
        sendToVoiceDaemon("/ptt/start")
    end
end

-- PTT Stop (key up) - this triggers transcription and typing
local function pttStop()
    if pttActive then
        pttActive = false
        print("Claude Voice: Recording stopped, waiting for transcription...")
        hs.alert.closeAll()
        hs.alert.show("Processing...", 2)

        -- Stop recording and wait for transcription
        sendToVoiceDaemon("/ptt/stop")

        -- Poll for transcription result
        hs.timer.doAfter(0.5, function()
            checkTranscription()
        end)
    end
end

-- Check for transcription result
local transcriptionAttempts = 0
function checkTranscription()
    hs.http.asyncGet(VOICE_DAEMON_URL .. "/transcription", nil, function(status, body, headers)
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

-- Ctrl+Option+Space - Toggle mode
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

    hs.http.asyncPost(VOICE_DAEMON_URL .. "/speak", text, nil, function(status, body, headers)
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
• Ctrl+Option+Space - Toggle recording
• Hold Right Cmd - Talk
• Hold F5 - Talk
• Ctrl+Option+S - Speak last response
• Cmd+Ctrl+R - Reload config
]], 5)
end)

-- Notify ready
hs.alert.show("Claude Voice ready! Hold Right Cmd or F5 to talk", 3)

print("Claude Voice: Configuration loaded")
print("Claude Voice: Hold Right Command or F5 to talk")
