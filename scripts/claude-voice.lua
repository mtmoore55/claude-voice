-- Claude Voice - Hammerspoon Module
-- This enables push-to-talk for Claude Code voice mode
-- Hold Right Option to speak, release to stop and transcribe

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

-- PTT Start (key down)
local function pttStart()
    if not pttActive then
        pttActive = true
        sendToVoiceDaemon("/ptt/start")
        hs.alert.show("Recording...", 0.5)
    end
end

-- PTT Stop (key up)
local function pttStop()
    if pttActive then
        pttActive = false
        sendToVoiceDaemon("/ptt/stop")
    end
end

-- Initialize the hotkey listener
function M.init()
    if rightOptionTap then
        rightOptionTap:stop()
    end

    rightOptionTap = hs.eventtap.new({hs.eventtap.event.types.flagsChanged}, function(event)
        local flags = event:getFlags()
        local keyCode = event:getKeyCode()

        -- Right Option key code is 61
        if keyCode == 61 then
            if flags.alt then
                pttStart()
            else
                pttStop()
            end
        end

        return false
    end)

    rightOptionTap:start()
    print("Claude Voice: Hotkey listener started (Right Option)")
end

-- Stop the hotkey listener
function M.stop()
    if rightOptionTap then
        rightOptionTap:stop()
        rightOptionTap = nil
    end
end

-- Auto-initialize when loaded
M.init()

return M
