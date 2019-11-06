/**
 * Forum:  https://forum.sinusbot.com/resources/simple-custom-commands.226/
 * GitHub: https://github.com/irgendwr/sinusbot-scripts
 */

registerPlugin({
    name: 'Custom commands - NOT FUNCTIONAL, WORK IN PROGRESS', //TODO: remove when finished
    version: '1.3.0',
    description: 'Create your own custom commands.',
    author: 'Jonas Bögle (irgendwr)',
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
                            title: 'Placeholders (some are TS3 only):\n username, mention, uid, dbid, description, ping, total_connections, packetloss, bytes_sent, bytes_received, ip, first_join, os, version, clients_count, clients, channels_count',
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
                {
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
                },
                { //TODO: change this
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
    const engine = require('engine');
    const backend = require('backend');
    const media = require('media');

    engine.log(`Loaded ${meta.name} v${meta.version} by ${meta.author}.`);

    //TODO: move old placeholders here
    const placeholders = {
        foo: () => "bar",
    };

    /**
     * @typedef Context
     * @type {object}
     * @property {Client} client
     * @property {object} args
     * @property {(msg: string) => void} reply
     * @property {Message} ev
     * @property {DiscordMessage} message
     */

    event.on('load', () => {
        const command = require('command');
        if (!command) {
            engine.log('command.js library not found! Please download command.js and enable it to be able use this script!');
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
                    //TODO: check servergroup as configured
                })

                if (cfg.cooldown) {
                    //TODO: add cooldown as configured
                    //cmd.addThrottle(...)
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
                            let text = action.response_test;
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
                    if (cfg.restrict) {
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
                    }

                    /** @implements {Context} */
                    let ctx = {
                        client: client,
                        args: args,
                        reply: reply,
                        ev: ev,
                        message: ev.message,
                    }

                    funcs.forEach(func => {
                        func(ctx);
                    });
                })
            }
        });
    });

    /**
     * Formats a string with placeholders.
     * @param {string} str
     * @param {Context} ctx
     * @param {object} placeholders
     */
    function format(str, ctx, placeholders) {
        //TODO: implement formatter
        return str;
    }

    /**
     * Loggs a message, requires engine
     * 
     * @param {string} str Message
     * @param {Client} client Client
     * @return {string}
     */
    function replacePlaceholders(str, client) {
        var clients = backend.getClients()
        var channels = backend.getChannels()
        var discord = engine.getBackend() === 'discord'

        str = str.replace(/%(username|user|name|nick)%/gi, client.name())
        .replace(/%uid%/gi, client.uid())
        .replace(/%dbid%/gi, discord ? client.uid().split('/')[1] : client.databaseID())
        .replace(/%description%/gi, client.description())
        .replace(/%ping%/gi, client.getPing().toString())
        .replace(/%total_connections%/gi, client.getTotalConnections().toString())
        .replace(/%packetloss%/gi, client.getPacketLoss().toString())
        .replace(/%bytes_sent%/gi, client.getBytesSent().toString())
        .replace(/%bytes_received%/gi, client.getBytesReceived().toString())
        .replace(/%ip%/gi, client.getIPAddress())
        .replace(/%first_join%/gi, client.getCreationTime() > 0 ? new Date(client.getCreationTime()).toLocaleDateString() : 'unknown')
        .replace(/%os%/gi, client.getPlatform())
        .replace(/%version%/gi, client.getVersion())
        .replace(/%mention%/gi, discord ? '<@'+client.uid().split('/')[1]+'>' : client.getURL())
        .replace(/%clients_count%/gi, clients.length.toString())
        .replace(/%clients%/gi, clients.reduce(function (clstr, client) {
            return clstr += (clstr ? ', ' : '') + client.name()
        }, ''))
        .replace(/%channels_count%/gi, channels.length.toString())

        return str
    }

    /**
     * Checks if a client is blacklisted
     * 
     * @param {Client} client
     * @return {boolean}
     */
    function isBlacklisted(client) {
        var isBlacklist = (config.blackOrWhite == 0)

        if (!config.sgList || config.sgList.length == 0) {
            // returns false if (blacklist and empty) or true if (whitelist and empty)
            return !isBlacklist
        }

        // returns true if (blacklist and included) or (whitelist and not included)
        return isBlacklist == client.getServerGroups().some(function (servergroup) {
            return config.sgList.some(function (item) {
                return servergroup.id() == item.servergroup
            })
        })
    }
})