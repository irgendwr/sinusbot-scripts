/**
 * Forum:  https://forum.sinusbot.com/resources/simple-custom-commands.226/
 * GitHub: https://github.com/irgendwr/sinusbot-scripts
 * 
 * @author Jonas Bögle
 * @license MIT
 * 
 * MIT License
 * 
 * Copyright (c) 2019 Jonas Bögle
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * @ignore
 */
registerPlugin({
    name: 'Custom commands',
    version: '1.4.0',
    description: 'Create your own custom commands.',
    author: 'Jonas Bögle (@irgendwr)',
    backends: ['ts3', 'discord'],
    vars: [
        {
            name: 'commands',
            title: 'Commands',
            type: 'array',
            vars: [
                {
                    name: 'name',
                    title: 'Command Name',
                    placeholder: 'example: "info"',
                    type: 'string',
                },
                {
                    name: 'description',
                    title: 'Description',
                    placeholder: 'example: "Responds with the users uid."',
                    type: 'string',
                },
                {
                    name: 'prefix_change',
                    title: 'Change Command Prefix (default is in Instance Settings)',
                    type: 'checkbox',
                    default: false,
                },
                {
                    name: 'prefix',
                    title: 'Command Prefix',
                    placeholder: 'example: "!"',
                    type: 'string',
                    indent: 2,
                    conditions: [{ field: 'prefix_change', value: true }],
                },
                {
                    name: 'actions',
                    title: 'Actions',
                    type: 'array',
                    vars: [
                        {
                            name: 'action_type',
                            title: 'What should happen?',
                            type: 'select',
                            options: [
                                'Respond with a message',
                                'Play a Track',
                            ],
                            default: '0',
                        },
                        {
                            name: 'response_type',
                            title: 'Where should the bot respond?',
                            type: 'select',
                            options: [
                                'In the same chat as the user wrote in',
                                'Always answer in private chat'
                            ],
                            default: '0',
                            conditions: [{ field: 'action_type', value: '0' }],
                        },
                        {
                            name: 'response_text',
                            title: 'Response',
                            type: 'multiline',
                            placeholder: 'example: "Hi {mention}, your uid is: {uid}',
                            conditions: [{ field: 'action_type', value: '0' }],
                        },
                        {
                            title: 'Placeholders (some are TS3 only):\n username, mention, uid, dbid, description, ping, total_connections, packetloss, bytes_sent, bytes_received, ip, first_join, os, version, clients_count, clients, channels_count, channels, client_groups_count, client_groups, server_groups_count, server_groups, playing, random(<min>, <max>), randomString(option one, option two, ...), channel_name, channel_id, channel_url, client_channel_name, client_channel_id, client_channel_url',
                            conditions: [{ field: 'action_type', value: '0' }],
                        },
                        {
                            name: 'track',
                            title: 'Track',
                            type: 'track',
                            conditions: [{ field: 'action_type', value: '1' }],
                        },
                    ]
                },
                {
                    name: 'restrict',
                    title: 'Restrict usage?',
                    type: 'checkbox',
                    default: false,
                },
                /*{
                    name: 'disable_serverchat',
                    title: 'Disable in serverchat',
                    type: 'checkbox',
                    indent: 2,
                    default: false,
                    conditions: [{ field: 'restrict', value: true }],
                },
                {
                    name: 'disable_channelchat',
                    title: 'Disable in channel chat',
                    type: 'checkbox',
                    indent: 2,
                    default: false,
                    conditions: [{ field: 'restrict', value: true }],
                },
                {
                    name: 'disable_privatechat',
                    title: 'Disable in private chat',
                    type: 'checkbox',
                    indent: 2,
                    default: false,
                    conditions: [{ field: 'restrict', value: true }],
                },*/
                {
                    name: 'servergroups_type',
                    title: 'Servergroups: Blacklist or whitelist?',
                    type: 'select',
                    options: [
                        'Blacklist',
                        'Whitelist'
                    ],
                    default: '0',
                    indent: 2,
                    conditions: [{ field: 'restrict', value: true }],
                },
                {
                    name: 'servergroups_list',
                    title: 'Servergroup IDs (Black-/Whitelist)',
                    type: 'strings',
                    indent: 2,
                    conditions: [{ field: 'restrict', value: true }],
                },
                {
                    name: 'cooldown',
                    title: 'Cooldown: Only allow command every X seconds (enter 0 to disable)',
                    placeholder: '0',
                    type: 'number',
                    default: 0,
                    indent: 2,
                    conditions: [{ field: 'restrict', value: true }],
                },
            ]
        }
    ]
}, function (_, config, meta) {
    const event = require('event');
    const audio = require('audio');
    const media = require('media');
    const engine = require('engine');
    const backend = require('backend');

    engine.log(`Loaded ${meta.name} v${meta.version} by ${meta.author}.`);

    /**
     * @typedef Context
     * @type {object}
     * @property {Client} client
     * @property {object} args
     * @property {(msg: string) => void} reply
     * @property {Message} ev
     * @property {DiscordMessage} message
     */

    const placeholders = {
        username: ctx => ctx.client.name(),
        uid: ctx => ctx.client.uid(),
        dbid: ctx => ctx.client.databaseID(),
        description: ctx => ctx.client.description(),
        ping: ctx => ctx.client.getPing(),
        total_connections: ctx => ctx.client.getTotalConnections(),
        packetloss: ctx => ctx.client.getPacketLoss(),
        bytes_sent: ctx => ctx.client.getBytesSent(),
        bytes_received: ctx => ctx.client.getBytesReceived(),
        ip: ctx => ctx.client.getIPAddress(),
        first_join: ctx => ctx.client.getCreationTime() > 0 ? new Date(ctx.client.getCreationTime()).toLocaleDateString() : 'unknown',
        os: ctx => ctx.client.getPlatform(),
        version: ctx => ctx.client.getVersion(),
        mention: ctx => ctx.client.getURL(),
        clients_count: ctx => backend.getClients().length,
        clients: ctx => backend.getClients().map(client => client.name()).join(', '),
        channels_count: ctx => backend.getChannels().length,
        channels: ctx => backend.getChannels().map(channel => channel.name()).join(', '),
        client_groups_count: ctx => ctx.client.getServerGroups().length,
        client_groups: ctx => ctx.client.getServerGroups().map(group => group.name()).join(', '),
        server_groups_count: ctx => backend.getServerGroups().length,
        server_groups: ctx => backend.getServerGroups().map(group => group.name()).join(', '),
        playing: ctx => {
            let track = media.getCurrentTrack();
            return track && audio.isPlaying() ? formatTrack(track) : 'none';
        },
        random: (ctx, ...args) => {
            let min = parseInt(args[0], 10);
            let max = parseInt(args[1], 10);
            return getRandomIntInclusive(min, max);
        },
        randomString: (ctx, ...args) => {
            if (args.length === 0) return "";
            return args[Math.floor(Math.random() * args.length)];
        },
        channel_name: ctx => {
            let channel = ctx.channel;
            return channel ? channel.name() : 'none';
        },
        channel_id: ctx => {
            let channel = ctx.channel;
            return channel ? channel.id() : 'none';
        },
        channel_url: ctx => {
            let channel = ctx.channel;
            if (!channel) return 'none';
            return engine.getBackend() === 'discord' ? `https://www.discordapp.com/channels/${channel.id()}` : channel.getURL();
        },
        client_channel_name: ctx => {
            let channels = ctx.client.getChannels();
            return channels && channels.lenght !== 0 ? channels[0].name() : 'none';
        },
        client_channel_id: ctx => {
            let channels = ctx.client.getChannels();
            return channels && channels.lenght !== 0 ? channels[0].id() : 'none';
        },
        client_channel_url: ctx => {
            let channels = ctx.client.getChannels();
            if (!channels || channels.lenght == 0) return 'none';
            return engine.getBackend() === 'discord' ? `https://www.discordapp.com/channels/${channels[0].id()}` : channels[0].getURL();
        },
    };

    event.on('load', () => {
        const command = require('command');
        if (!command) {
            engine.log('command.js library not found! Please download command.js to your scripts folder and restart the SinusBot, otherwise this script will not work.');
            engine.log('command.js can be found here: https://github.com/Multivit4min/Sinusbot-Command/blob/master/command.js');
            return;
        }

        if (!config.commands || config.commands.length == 0) {
            engine.log("No commands configured.");
            return;
        }

        config.commands.forEach((cfg, i) => {
            let name = cfg.name;

            if (!name || name.length < 1) {
                engine.log(`Skipping ${i+1}. command: Name is not set.`);
            }

            let cmd;
            try {
                cmd = command.createCommand(name);
                engine.log(`Added command: ${name}`);
            } catch(ex) {
                engine.log(`Skipping ${i+1}. command due to error: ${ex}`);
                return;
            }
            
            let description = cfg.description;
            if (description) {
                cmd.help(description);
                cmd.manual(description);
            }

            if (cfg.prefix_change) {
                let prefix = cfg.prefix;
                if (!prefix || prefix.length < 1) {
                    engine.log(`Warning in ${i+1}. command: Prefix not set, using default instead.`);
                } else {
                    cmd.forcePrefix(prefix);
                }
            }

            if (cfg.restrict) {
                cmd.checkPermission(client => {
                    const BLACKLIST = 0;
                    let sglist = cfg.servergroups_list;
                    let isBlacklist = (cfg.servergroups_type == BLACKLIST);

                    if (!sglist || sglist.length == 0) {
                        // returns true if (blacklist and empty) or false if (whitelist and empty)
                        return isBlacklist
                    }

                    // returns true if (blacklist and not included) or (whitelist and included)
                    return isBlacklist != client.getServerGroups().some(servergroup => 
                        sglist.some(sgid => 
                            servergroup.id() == sgid
                        )
                    )
                })

                if (cfg.cooldown) {
                    const throttle = command.createThrottle()
                    .initialPoints(1)
                    .restorePerTick(1)
                    .tickRate(cfg.cooldown * 1000); //ms

                    cmd.addThrottle(throttle);
                }
            }

            let actions = cfg.actions;
            if (!actions || actions.length < 1) {
                engine.log(`Warning in ${i+1}. command: No actions set.`);
                return;
            } else {
                let funcs = [];
                actions.forEach((action, j) => {
                    switch (action.action_type) {
                        case 0:
                        case '0': // Respond with a message
                            let text = action.response_text;
                            if (!text || text.length < 1) {
                                engine.log(`Warning in ${i+1}. command: No message text set in ${j+1}. action.`);
                                return;
                            }

                            let type = action.response_type || '0';
                            if (type == '1') { // private chat
                                funcs.push(ctx => {
                                    ctx.client.chat(format(text, ctx, placeholders));
                                });
                            } else { // same chat
                                funcs.push(ctx => {
                                    ctx.reply(format(text, ctx, placeholders));
                                });
                            }
                            break;
                        case 1:
                        case '1': // Play a Track
                            let track = action.track;
                            if (!track) {
                                engine.log(`Warning in ${i+1}. command: No track set in ${j+1}. action.`);
                                return;
                            }
                            funcs.push(() => {
                                media.playURL(track);
                            });
                            break;
                        default:
                            engine.log(`Warning in ${i+1}. command: ${j+1}. action is unknown.`);
                    }
                });
                cmd.exec((client, args, reply, ev) => {
                    /*if (cfg.restrict) {
                        if (ev.mode == 3 && cfg.disable_serverchat) {
                            engine.log('Ignoring command since serverchat is disabled.');
                            return;
                        }
                        if (ev.mode == 2 && cfg.disable_channelchat) {
                            engine.log('Ignoring command since channelchat is disabled.');
                            return;
                        }
                        if (ev.mode == 1 && cfg.disable_privatechat) {
                            engine.log('Ignoring command since privatechat is disabled.');
                            return;
                        }
                    }*/

                    /** @implements {Context} */
                    let ctx = {
                        client: client,
                        args: args,
                        reply: reply,
                        ev: ev,
                        channel: ev.channel,
                        message: ev.message,
                    }

                    funcs.forEach(func => {
                        try {
                            func(ctx);
                        } catch(ex) {
                            engine.log(ex);
                        }
                    });
                })
            }
        });
    });

    /**
     * Formats a string with placeholders.
     * @param {string} str Format String
     * @param {Context} ctx Context
     * @param {object} placeholders Placeholders
     */
    function format(str, ctx, placeholders) {
        return str.replace(/((?:[^{}]|(?:\{\{)|(?:\}\}))+)|(?:\{([0-9_\-a-zA-Z]+)(?:\((.+)\))?\})/g, (m, str, placeholder, argsStr) => {
            if (str) {
                return str.replace(/(?:{{)|(?:}})/g, m => m[0]);
            } else {
                if (!placeholders.hasOwnProperty(placeholder) || typeof placeholders[placeholder] !== 'function') {
                    engine.log(`Unknown placeholder: ${placeholder}`);
                    return `{${placeholder}: unknown placeholder}`;
                }
                let args = [];
                if (argsStr && argsStr.length > 0) {
                    args = argsStr.split(/\s*(?<!\\)(?:,|$)\s*/);
                    args.map(arg => arg.replace('\\,', ','));
                }

                let result = `{${placeholder}: empty}`;
                try {
                    result = placeholders[placeholder](ctx, ...args);
                } catch(ex) {
                    result = `{${placeholder}: error}`;
                    engine.log(`placeholder "${placeholder}" caused an error: ${ex}`);
                }

                return result;
            }
        });
    }
    
    /**
     * @returns a random integer between two values, inclusive
     * @param {number} min 
     * @param {number} max
     */
    function getRandomIntInclusive(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Returns a formatted string from a track.
     *
     * @param {Track} track
     * @returns {string} formatted string
     */
    function formatTrack(track) {
        let title = track.tempTitle() || track.title();
        let artist = track.tempArtist() || track.artist();
        return artist ? `${artist} - ${title}` : title;
    }
})