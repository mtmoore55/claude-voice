-- Hammerspoon Configuration
-- Includes Claude Voice push-to-talk hotkey

-- Claude Voice - Push-to-Talk Configuration
-- Hold Right Option to speak, release to stop and transcribe

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

-- Create an eventtap to capture Right Option key events
local rightOptionTap = hs.eventtap.new({hs.eventtap.event.types.flagsChanged}, function(event)
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

-- Notify that voice hotkey is ready
hs.alert.show("Claude Voice hotkey ready", 2)

-- Reload config shortcut (Cmd+Ctrl+R)
hs.hotkey.bind({"cmd", "ctrl"}, "r", function()
    hs.reload()
end)

print("Claude Voice: Hammerspoon configuration loaded")
print("Claude Voice: Hold Right Option to speak")
