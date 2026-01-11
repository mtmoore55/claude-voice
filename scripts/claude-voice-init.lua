-- Hammerspoon Configuration
-- Includes Claude Voice push-to-talk hotkey

-- Claude Voice - Push-to-Talk Configuration
-- Press Cmd+. to start recording, press again to stop and transcribe

local VOICE_DAEMON_PORT = 17394
local VOICE_DAEMON_URL = "http://127.0.0.1:" .. VOICE_DAEMON_PORT

-- Track PTT state
local pttActive = false

-- Send HTTP request to voice daemon
local function sendToVoiceDaemon(endpoint)
    local url = VOICE_DAEMON_URL .. endpoint
    hs.http.asyncPost(url, "", nil, function(status, body, headers)
        -- Silently handle response
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

-- Cmd+. hotkey for toggle mode
hs.hotkey.bind({"cmd"}, ".", pttToggle)

-- Notify that voice hotkey is ready
hs.alert.show("Claude Voice hotkey ready (Cmd+.)", 2)

-- Reload config shortcut (Cmd+Ctrl+R)
hs.hotkey.bind({"cmd", "ctrl"}, "r", function()
    hs.reload()
end)

print("Claude Voice: Hammerspoon configuration loaded")
print("Claude Voice: Press Cmd+. to toggle recording")
