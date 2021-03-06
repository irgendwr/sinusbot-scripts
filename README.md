# sinusbot scripts

**THIS IS NO LONGER MAINTAINED** and might be archived soon.
Feel free to fork and work on these scripts on your own (as long as you follow the [MIT license](https://github.com/irgendwr/sinusbot-scripts/blob/master/LICENSE) and mention me).

This repository contains a few scripts that I wrote for the [SinusBot](https://sinusbot.com).

## Installation

1. Download the script and put it in the scripts folder where the SinusBot is installed
2. Restart the SinusBot
3. Go to your web-interface: Settings -> Scrips and enable the script by checking the box next to it
4. Configure the script as you like (by clicking on the arrow to show the options and pressing 'save' at the end)
5. Click on Save changes at the bottom of the page

## Scripts

### [Custom commands](custom_commands.js)

This is a simple script that allows you to create your own commands with custom responses.

See [forum thread](https://forum.sinusbot.com/resources/custom-commands.226/) for more information/discussion.

**Config:**

The the following placeholders can be used in the config:

- username
- mention
- uid
- dbid
- description
- ping
- total_connections
- packetloss
- bytes_sent
- bytes_received
- ip
- first_join
- os
- version
- clients_count
- clients
- channels_count
- channels
- client_groups_count
- client_groups
- server_groups_count
- server_groups
- playing
- random(<min>, <max>)
- randomString(option one, option two, ...)
- channel_name
- channel_id
- channel_url
- client_channel_name
- client_channel_id
- client_channel_url

Example:

```
Hi {mention}, your ID is: {uid} and you have the following {client_groups_count} groups: {client_groups}.
Random number between 0 and 100: {random(1, 100)}.
```

### [Join/Leave](join_leave.js)

This script adds the commands !join and !leave that make the bot join or leave your channel.

See [forum thread](https://forum.sinusbot.com/resources/join-leave-commands.423/) for more information/discussion.

### [AFK mover (Away/Mute/Deaf/Idle)](away_mover.js)

This script moves clients that are set as away, have their speakers/mic muted or are idle to a specified channel.

See [forum thread](https://forum.sinusbot.com/resources/away-mover.179/) for more information/discussion.

### [Uptimerobot - Server Status/Uptime Monitoring](uptimerobot.js)

Informs you about the status of a server configured on [uptimerobot.com](https://uptimerobot.com)

See [forum thread](https://forum.sinusbot.com/resources/uptimerobot.127/) for more information/discussion.

**Config:**

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

### [Group List](group_list.js)

List the servers groups and their IDs with the `!groups` command.

See [forum thread](https://forum.sinusbot.com/resources/group-list.388/) for more information/discussion.

## Troubleshooting

- make sure that you have the latest version of the SinusBot (some scripts require at least version 1.0.0)
- make sure that you have the latest version of this script
- read the instructions above carefully and check if you've missed anything
- If you've checked everything and it still doesn't work then you can ask for help in the discussion thread or open an issue on GitHub.
  But hold on for a second! Before you post: [read this first](https://forum.sinusbot.com/threads/read-me-before-you-post.342/) and include all of the required information.
