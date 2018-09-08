# sinusbot scripts

This repository contains a few scripts that I wrote for the [sinusbot](https://sinusbot.com).

## [Simple custom commands](custom_commands.js)

This is a simple script that allows you to create your own commands with custom responses.

See [forum thread](https://forum.sinusbot.com/resources/custom-commands.226/) for more information/discussion.

### Config

In the config the following placeholders can be used:

- %username%
- %uid%
- %dbid%
- %description%
- %ping%
- %total_connections%
- %packetloss%
- %bytes_sent%
- %bytes_received%
- %ip%
- %first_join%
- %os%
- %version%
- %clients_count%
- %clients%
- %channels_count%

## [AFK mover (Away/Mute/Deaf/Idle)](away_mover.js)

This script moves clients that are set as away, have their speakers/mic muted or are idle to a specified channel.

See [forum thread](https://forum.sinusbot.com/resources/away-mover.179/) for more information/discussion.

## [Uptimerobot - Server Status/Uptime Monitoring](uptimerobot.js)

Informs you about the status of a server configured on [uptimerobot.com](https://uptimerobot.com)

See [forum thread](https://forum.sinusbot.com/resources/uptimerobot.127/) for more information/discussion.

### Config

In the config the following placeholders can be used:

- %name%
- %uptime%
- %url%
- %port%
- %type%
- %status%
- %id%
- %created%
- %ssl.brand%
- %ssl.product%
- %ssl.expires%

## [Group List](group_list.js)

List the servers groups and their IDs with the `!groups` command.

See [forum thread](https://forum.sinusbot.com/resources/group-list.388/) for more information/discussion.