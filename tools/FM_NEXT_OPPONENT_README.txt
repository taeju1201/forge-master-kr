Forge Master 2.9.0 - Next Opponent Assignment Watcher

Purpose
-------
This is NOT a clan-name prediction model.
Forge Master does not expose the next week's candidate pool in its client config.
The watcher reads GuildWarManager from the live game and records the opponent
as soon as the server assigns a new guild-war division/opponent.

Files
-----
FM_NEXT_OPPONENT_WATCH.js   Plain Frida JavaScript. No frida-il2cpp-bridge required.
FM_NEXT_OPPONENT_WATCH.py   USB attach/spawn + JSONL writer.
FM_NEXT_OPPONENT_WATCH.bat  Windows double-click launcher.
FM_NEXT_OPPONENT_RESULT.jsonl is created automatically.

Requirements
------------
1. ADB/USB connection to the phone.
2. Frida server/environment already used by the Forge Master collector.
3. Python package:
   py -m pip install frida frida-tools

How to use
----------
1. Start Frida server on the phone as usual.
2. Connect the phone by USB.
3. Double-click FM_NEXT_OPPONENT_WATCH.bat.
4. You can leave Forge Master running. If it is closed, the watcher starts it.
5. When the server assigns/changes the war opponent, the console prints:
   Name / Tag / Tier / Server / current war day
   and appends the same data to FM_NEXT_OPPONENT_RESULT.jsonl.

Reverse-engineering notes
-------------------------
Verified from Forge Master 2.9.0 APK metadata:
GuildWarManager has:
  get_OwnState
  get_OpponentState
  get_Participants
  get_CurrentParticipantIndex
  get_OpponentName
  get_OpponentTag
  get_OpponentTier
  get_OpponentServer

Important correction:
Metaplay IDivisionModel.NextParticipantIdx is NOT "next opponent".
It is the next numeric participant index to allocate when a participant is added.
So it must not be used for opponent prediction.

Guild search also cannot enumerate every guild:
Metaplay GuildSearchParamsBase requires a non-empty SearchString and has no
pagination token in this SDK generation. GuildDiscovery can return suggestions,
but it is not guaranteed to be the guild-war matchmaking pool.

Therefore exact pre-assignment name prediction would require server-side
matchmaking logic plus the active global guild pool, neither of which the APK
client config exposes. This watcher instead gives the earliest exact result the
client receives from the server.
