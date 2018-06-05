/**
 * Forum:  https://forum.sinusbot.com/resources/simple-custom-commands.226/
 * GitHub: https://github.com/irgendwr/sinusbot-scripts
 */

registerPlugin({
    name: 'Simple custom commands',
    version: '1.2.0',
    description: 'A simple script that responds to custom commands.',
    author: 'Jonas Bögle <dev@sandstorm-projects.de>',
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
                    title: 'Response: (placeholders: %username%, %uid%, %dbid%, %description%, %ping%, %total_connections%, %packetloss%, %bytes_sent%, %bytes_received%, %ip%, %first_join%)',
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
            name: 'sgBlacklist',
            title: 'Ignore users with these servergroups:',
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
    engine.saveConfig(config)
    
    var prefix = ['!', '.', ''][config.cmdPrefix]
    var lastUsage = {}
    var log = new Logger()
    log.debug = false

    // log info on startup
    log.i('debug messages are ' + (log.debug ? 'en' : 'dis') + 'abled')
    log.i(info.name + ' v' + info.version + ' by ' + info.author + ' loaded successfully.')

    event.on('chat', function (ev) {
        if (isBlacklisted(ev.client, config.sgBlacklist)) {
            log.d('ignoring command from ' + ev.client.name() + ' due to blacklist')
            return
        }

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
        .replace(/%clients%/gi, clients.join(', '))
        .replace(/%channels_count%/gi, channels.length.toString())

        return str
    }

    /**
     * Checks if a client has a servergroup that is blacklisted
     * 
     * @param {Client} client
     * @param {Array} blacklist blacklist config array
     * @return {boolean}
     */
    function isBlacklisted(client, blacklist) {
        return client.getServerGroups().some(function (servergroup) {
            return blacklist.some(function (blItem) {
                return servergroup.id() == blItem.servergroup
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