/**
 * Forum:  https://forum.sinusbot.com/resources/simple-custom-commands.226/
 * GitHub: https://github.com/irgendwr/sinusbot-scripts
 */

registerPlugin({
    name: 'Simple custom commands',
    version: '1.2.0',
    description: 'Create your own custom commands.',
    author: 'Jonas Bögle (irgendwr)',
    backends: ['ts3', 'discord'],
    vars: [
        {
            name: 'cmdPrefix',
            title: 'Command prefix:',
            type: 'select',
            placeholder: '!',
            options: [
                '!',
                '.',
                ' (none)'
            ]
        },
        {
            name: 'commands',
            title: 'Commands:',
            type: 'array',
            vars: [
                {
                    name: 'command',
                    title: 'Command:',
                    type: 'string'
                },
                {
                    name: 'response',
                    title: 'Response: (placeholders: %username%, %uid%, %dbid%, %description%, %ping%, %total_connections%, %packetloss%, %bytes_sent%, %bytes_received%, %ip%, %first_join%, %os%, %version%, %clients_count%, %clients%, %channels_count%)',
                    type: 'multiline'
                }
            ]
        },
        {
            name: 'responseType',
            title: 'Where should the bot respond?',
            type: 'select',
            placeholder: 'In the same chat as the user wrote in',
            options: [
                'In the same chat as the user wrote in',
                'Always answer in private chat'
            ]
        },
        {
            name: 'serverChatEnabled',
            title: 'Listen in the serverchat',
            type: 'checkbox'
        },
        {
            name: 'channelChatEnabled',
            title: 'Listen in the channel chat',
            type: 'checkbox'
        },
        {
            name: 'privateChatEnabled',
            title: 'Listen in the private chat',
            type: 'checkbox'
        },
        {
            name: 'cooldown',
            title: 'Cooldown: only allow command every X seconds (enter 0 to disable)',
            placeholder: '0',
            type: 'number'
        },
        {
            name: 'blackOrWhite',
            title: 'Blacklist or whitelist?',
            type: 'select',
            placeholder: 'Blacklist',
            options: [
                'Blacklist',
                'Whitelist'
            ]
        },
        {
            name: 'sgList',
            title: 'Black-/Whitelist users with these servergroups:',
            type: 'array',
            vars: [{
                name: 'servergroup',
                title: 'Servergroup ID',
                type: 'number'
            }]
        }
    ]
}, function (sinusbot, config, info) {

    // include modules
    var event = require('event')
    var engine = require('engine')
    var backend = require('backend')

    // set default config values
    config.cmdPrefix = config.cmdPrefix || 0
    config.serverChatEnabled = config.serverChatEnabled || false
    config.channelChatEnabled = config.channelChatEnabled || false
    config.privateChatEnabled = config.privateChatEnabled || false
    config.responseType = config.responseType || 0
    config.cooldown = config.cooldown || 0
    config.blackOrWhite = config.blackOrWhite || 0
    engine.saveConfig(config)
    
    var prefix = ['!', '.', ''][config.cmdPrefix]
    var lastUsage = {}
    var log = new Logger()
    log.debug = false

    // log info on startup
    log.i('debug messages are ' + (log.debug ? 'en' : 'dis') + 'abled')
    log.i(info.name + ' v' + info.version + ' by ' + info.author + ' loaded successfully.')
    log.d('backend: ' + engine.getBackend())

    event.on('chat', function (ev) {
        log.d(ev)

        if (isBlacklisted(ev.client)) {
            log.d('ignoring command from ' + ev.client.name() + ' due to blacklist')
            return
        }

        // FIXME: workaround for discord
        if (ev.mode == 2 && ev.channel == undefined) {
            ev.mode = 1
            log.d('[workaround] detected message type: ' + ev.mode)
        }
        // TODO: add option to only listen in a specified channel

        if (ev.mode == 1 && config.privateChatEnabled ||
            ev.mode == 2 && config.channelChatEnabled ||
            ev.mode == 3 && config.serverChatEnabled) {

            config.commands.forEach(function (cmd) {
                if (ev.text == prefix + cmd.command) {
                    if (config.cooldown > 0 && lastUsage[ev.client.uid()] != undefined &&
                        (timestamp() - lastUsage[ev.client.uid()]) < config.cooldown) {

                            log.d('ignoring command from ' + ev.client.name() + ' due to cooldown')
                            ev.client.chat('You\'ve reached the cooldown, please stop spamming. (' + (timestamp() - lastUsage[ev.client.uid()]) + ')')
                            lastUsage[ev.client.uid()] = timestamp()
                            return
                    }

                    log.d('Received command "' + ev.text + '" from ' + ev.client.name())

                    var resp = replacePlaceholders(cmd.response, ev.client)

                    if (config.responseType == 1 || ev.mode == 1) {
                        ev.client.chat(resp)
                    } else if (ev.mode == 2) {
                        ev.channel.chat(resp)
                    } else if (ev.mode == 3) {
                        backend.chat(resp)
                    }

                    lastUsage[ev.client.uid()] = timestamp()
                }
            })
        }
    })

    /**
     * Loggs a message, requires engine
     * 
     * @param {String} str Message
     * @param {Client} client Client
     * @return {String}
     */
    function replacePlaceholders(str, client) {
        var clients = backend.getClients()
        var channels = backend.getChannels()

        str = str.replace(/%(username|user|name|nick)%/gi, client.name())
        .replace(/%uid%/gi, client.uid())
        .replace(/%dbid%/gi, client.databaseID())
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

    /**
     * Returns the current timestamp in seconds
     * @return {number} timestamp
     */
    function timestamp() {
        return Math.floor(Date.now() / 1000)
    }

    /**
     * Creates a logging interface
     * @requires engine
     */
    function Logger() {
        this.debug = false
        this.log = function (level, msg) {
            if (typeof msg == 'object') {
                msg = JSON.stringify(msg)
            }
            engine.log('[' + level + '] ' + msg)
        }
        this.e = function (msg) {
            this.log('ERROR', msg)
        }
        this.w = function (msg) {
            this.log('WARN', msg)
        }
        this.i = function (msg) {
            this.log('INFO', msg)
        }
        this.d = function (msg) {
            if (this.debug)
                this.log('DEBUG', msg)
        }
    }
})