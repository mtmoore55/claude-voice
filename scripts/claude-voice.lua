-- Claude Voice - Hammerspoon Module
-- This enables push-to-talk for Claude Code voice mode
-- Press Cmd+. to start recording, press again to stop and transcribe

local M = {}

local VOICE_DAEMON_PORT = 17394
local VOICE_DAEMON_URL = "http://127.0.0.1:" .. VOICE_DAEMON_PORT

-- Track PTT state
local pttActive = false
local rightOptionTap = nil

-- Send HTTP request to voice daemon
local function sendToVoiceDaemon(endpoint)
    local url = VOICE_DAEMON_URL .. endpoint
    hs.http.asyncPost(url, "", nil, function(status, body, headers)
        -- Silently handle response (daemon might not be running)
    end)
end

-- PTT Start
local function pttStart()
    if not pttActive then
        pttActive = true
        sendToVoiceDaemon("/ptt/start")
        hs.alert.show("Recording...", 0.5)
    end
end

-- PTT Stop
local function pttStop()
    if pttActive then
        pttActive = false
        sendToVoiceDaemon("/ptt/stop")
    end
end

-- Toggle PTT
local function pttToggle()
    if pttActive then
        pttStop()
    else
        pttStart()
    end
end

-- Initialize the hotkey listener
function M.init()
    -- Cmd+. hotkey for toggle mode
    hs.hotkey.bind({"cmd"}, ".", pttToggle)
    print("Claude Voice: Hotkey listener started (Cmd+.)")
end

-- Stop the hotkey listener
function M.stop()
    -- Nothing to stop for hs.hotkey
end

-- Auto-initialize when loaded
M.init()

return M
