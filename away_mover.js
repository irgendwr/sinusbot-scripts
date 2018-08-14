/**
 * Forum:  https://forum.sinusbot.com/resources/away-mover.179/
 * GitHub: https://github.com/irgendwr/sinusbot-scripts
 */

registerPlugin({
    name: 'AFK mover (Away/Mute/Deaf/Idle)',
    version: '2.2.0',
    description: 'Moves clients that are set as away, have their speakers/mic muted or are idle to a specified channel',
    author: 'irgendwer / Jonas <dev@sandstorm-projects.de>',
    vars: [
        /*** general ***/
        {
            name: 'afkChannel',
            title: 'AFK Channel',
            type: 'channel'
        },

        /*** away ***/
        {
            name: 'awayEnabled',
            title: '[AWAY] Move users who set themselves as away',
            type: 'checkbox'
        },
        {
            name: 'awayMoveBack',
            title: 'Move users back',
            type: 'checkbox',
            indent: 3,
            conditions: [{ field: 'awayEnabled', value: true }]
        },
        {
            name: 'awaySgBlacklist',
            title: 'Ignore users with these servergroups:',
            type: 'array',
            vars: [{
                name: 'servergroup',
                title: 'Servergroup',
                type: 'number'
            }],
            indent: 3,
            conditions: [{ field: 'awayEnabled', value: true }]
        },
        {
            name: 'awayChBlacklist',
            title: 'Ignore users within these channels:',
            type: 'array',
            vars: [{
                name: 'channel',
                title: 'Channel',
                type: 'channel'
            }],
            indent: 3,
            conditions: [{ field: 'awayEnabled', value: true }]
        },
        {
            name: 'awayDelay',
            title: 'Delay (in seconds)',
            type: 'number',
            indent: 3,
            conditions: [{ field: 'awayEnabled', value: true }]
        },

        /*** mute ***/
        {
            name: 'muteEnabled',
            title: '[MUTE] Move users who mute themselves',
            type: 'checkbox'
        },
        {
            name: 'muteMoveBack',
            title: 'Move users back',
            type: 'checkbox',
            indent: 3,
            conditions: [{ field: 'muteEnabled', value: true }]
        },
        {
            name: 'muteSgBlacklist',
            title: 'Ignore users with these servergroups:',
            type: 'array',
            vars: [{
                name: 'servergroup',
                title: 'Servergroup',
                type: 'number'
            }],
            indent: 3,
            conditions: [{ field: 'muteEnabled', value: true }]
        },
        {
            name: 'muteChBlacklist',
            title: 'Ignore users within these channels:',
            type: 'array',
            vars: [{
                name: 'channel',
                title: 'Channel',
                type: 'channel'
            }],
            indent: 3,
            conditions: [{ field: 'muteEnabled', value: true }]
        },
        {
            name: 'muteDelay',
            title: 'Delay (in seconds)',
            type: 'number',
            indent: 3,
            conditions: [{ field: 'muteEnabled', value: true }]
        },

        /*** deaf ***/
        {
            name: 'deafEnabled',
            title: '[DEAF] Move users who deactivate their speaker',
            type: 'checkbox'
        },
        {
            name: 'deafMoveBack',
            title: 'Move users back',
            type: 'checkbox',
            indent: 3,
            conditions: [{ field: 'deafEnabled', value: true }]
        },
        {
            name: 'deafSgBlacklist',
            title: 'Ignore users with these servergroups:',
            type: 'array',
            vars: [{
                name: 'servergroup',
                title: 'Servergroup',
                type: 'number'
            }],
            indent: 3,
            conditions: [{ field: 'deafEnabled', value: true }]
        },
        {
            name: 'deafChBlacklist',
            title: 'Ignore users within these channels:',
            type: 'array',
            vars: [{
                name: 'channel',
                title: 'Channel',
                type: 'channel'
            }],
            indent: 3,
            conditions: [{ field: 'deafEnabled', value: true }]
        },
        {
            name: 'deafDelay',
            title: 'Delay (in seconds)',
            type: 'number',
            indent: 3,
            conditions: [{ field: 'deafEnabled', value: true }]
        },

        /*** idle ***/
        {
            name: 'idleEnabled',
            title: '[IDLE] Move users who are idle for too long (use with care!)',
            type: 'checkbox'
        },
        {
            name: 'idleSgBlacklist',
            title: 'Ignore users with these servergroups:',
            type: 'array',
            vars: [{
                name: 'servergroup',
                title: 'Servergroup',
                type: 'number'
            }],
            indent: 3,
            conditions: [{ field: 'idleEnabled', value: true }]
        },
        {
            name: 'idleChBlacklist',
            title: 'Ignore users within these channels:',
            type: 'array',
            vars: [{
                name: 'channel',
                title: 'Channel',
                type: 'channel'
            }],
            indent: 3,
            conditions: [{ field: 'idleEnabled', value: true }]
        },
        {
            name: 'idleThreshold',
            title: 'How long are people allowed to be idle? (in minutes, don\'t use small values!)',
            type: 'number',
            indent: 3,
            conditions: [{ field: 'idleEnabled', value: true }]
        },

        /*** general - notify ***/
        {
            name: 'notifyEnabled',
            title: 'Notify users when they get moved',
            type: 'checkbox'
        },
        {
            name: 'notifyType',
            title: 'How should users be notified?',
            type: 'select',
            options: [ 'chat', 'poke' ],
            indent: 3,
            conditions: [{ field: 'notifyEnabled', value: true }]
        },
    ]
}, function (sinusbot, config, info) {

    // include modules
    var event = require('event')
    var engine = require('engine')
    var backend = require('backend')

    // set default config values
    config.awayMoveBack = config.awayMoveBack || false
    config.awayDelay = config.awayDelay || 0
    config.muteMoveBack = config.muteMoveBack || false
    config.muteDelay = config.muteDelay || 0
    config.deafMoveBack = config.deafMoveBack || false
    config.deafDelay = config.deafDelay || 0
    config.idleThreshold = config.idleThreshold || 0
    config.notifyEnabled = config.notifyEnabled || false
    config.notifyType = config.notifyType || 0
    engine.saveConfig(config)

    var log = new Logger()
    log.debug = false
    var idleThreshold = config.idleThreshold * 60 * 1000
    var afkChannel = backend.getChannelByID(config.afkChannel)
    var afk = []
    var queue = []
    var lastMoveEvent = {}

    // check whether afk channel is set
    if (!config.afkChannel) {
        engine.notify('You need to specify an afk channel in the config.')
        log.e('You need to specify an afk channel in the config.')
        return
    }

    // check whether afk channel is valid
    if (!afkChannel) {
        log.w('Unable to find afk channel.')
    }

    event.on('connect', function() {
        var channel = backend.getChannelByID(config.afkChannel)
        if (channel) {
            afkChannel = channel
        } else {
            log.w('AFK Channel not found on connect.')
        }
    })

    event.on('load', function() {
        var channel = backend.getChannelByID(config.afkChannel)
        if (channel) {
            afkChannel = channel
        } else {
            log.w('AFK Channel not found on load.')
        }
    })

    // log info on startup
    log.i('debug messages are ' + (log.debug ? 'en' : 'dis') + 'abled')
    log.i(info.name + ' v' + info.version + ' by ' + info.author + ' loaded successfully.')

    /*** away ***/

    if (config.awayEnabled) {
        log.d('away move is enabled')

        event.on('clientAway', function (client) {
            log.d('clientAway: ' + client.nick())

            if (!(hasBlacklistedGroup(client, config.awaySgBlacklist) || inBlacklistedChannel(client, config.awayChBlacklist))) {
                var afkClient = getFromAFK(client)
                if (afkClient) {
                    log.d('ignoring event since ' + client.nick() + ' is already afk (' +
                        (timestamp() - afkClient.timestamp) + 's, ' + afkClient.event + ')')
                    return
                }

                if (config.awayDelay) {
                    log.d('delay enabled (' + config.awayDelay + '), pushing client to queue...')

                    queue.push({
                        event: 'away',
                        uid: client.uid(),
                        timestamp: timestamp()
                    })
                } else {
                    afk.push({
                        event: 'away',
                        uid: client.uid(),
                        prevChannel: client.getChannels()[0].id(),
                        timestamp: timestamp()
                    })

                    moveToAFKchannel(client, 'away')
                }
            } else {
                log.d('blacklisted, ignoring')
            }

        })

        event.on('clientBack', function (client) {
            log.d('clientBack: ' + client.nick())

            var afkClient = getFromAFK(client)
            if (afkClient && afkClient.event == 'away') {
                removeFromAFK(client, config.awayMoveBack)
            }
        })
    }

    /*** mute ***/

    if (config.muteEnabled) {
        log.d('mute move is enabled')

        event.on('clientMute', function (client) {
            log.d('clientMute: ' + client.nick())

            if (!(hasBlacklistedGroup(client, config.muteSgBlacklist) || inBlacklistedChannel(client, config.muteChBlacklist))) {
                var afkClient = getFromAFK(client)
                if (afkClient) {
                    log.d('ignoring event since ' + client.nick() + ' is already afk (' +
                        (timestamp() - afkClient.timestamp) + 's, ' + afkClient.event + ')')
                    return
                }

                if (config.muteDelay) {
                    log.d('delay enabled (' + config.muteDelay + '), pushing client to queue...')

                    queue.push({
                        event: 'mute',
                        uid: client.uid(),
                        timestamp: timestamp()
                    })
                } else {
                    afk.push({
                        event: 'mute',
                        uid: client.uid(),
                        prevChannel: client.getChannels()[0].id(),
                        timestamp: timestamp()
                    })

                    moveToAFKchannel(client, 'mute')
                }
            } else {
                log.d('blacklisted, ignoring')
            }
        })

        event.on('clientUnmute', function (client) {
            log.d('clientUnmute: ' + client.nick())

            var afkClient = getFromAFK(client)
            if (afkClient && afkClient.event == 'mute') {
                removeFromAFK(client, config.muteMoveBack)
            }
        })
    }

    /*** deaf ***/

    if (config.deafEnabled) {
        log.d('deaf move is enabled')

        event.on('clientDeaf', function (client) {
            log.d('clientDeaf: ' + client.nick())

            if (!(hasBlacklistedGroup(client, config.deafSgBlacklist) || inBlacklistedChannel(client, config.deafChBlacklist))) {
                var afkClient = getFromAFK(client)
                if (afkClient) {
                    log.d('ignoring event since ' + client.nick() + ' is already afk (' +
                        (timestamp() - afkClient.timestamp) + 's, ' + afkClient.event + ')')
                    return
                }

                if (config.deafDelay) {
                    log.d('delay enabled (' + config.deafDelay + '), pushing client to queue...')

                    queue.push({
                        event: 'deaf',
                        uid: client.uid(),
                        timestamp: timestamp()
                    })
                } else {
                    afk.push({
                        event: 'deaf',
                        uid: client.uid(),
                        prevChannel: client.getChannels()[0].id(),
                        timestamp: timestamp()
                    })

                    moveToAFKchannel(client, 'deaf')
                }
            } else {
                log.d('blacklisted, ignoring')
            }
        })

        event.on('clientUndeaf', function (client) {
            log.d('clientUndeaf: ' + client.nick())

            var afkClient = getFromAFK(client)
            if (afkClient != null && afkClient.event == 'deaf') {
                removeFromAFK(client, config.deafMoveBack)
            }
        })
    }

    function checkQueue() {
        queue.forEach(function (queuedAFKclient, index) {
            var removeFromQueue = false
            var client = backend.getClientByUID(queuedAFKclient.uid)

            if (client) {
                if (queuedAFKclient.event == 'away') {
                    if (client.isAway()) {
                        var awayFor = timestamp() - queuedAFKclient.timestamp

                        if (awayFor >= config.awayDelay) {
                            log.d(client.nick() + ' reached delay (' + awayFor + '/' + config.awayDelay + ')')
                            moveToAFKchannel(client, 'away queue')

                            afk.push({
                                event: 'away',
                                uid: client.uid(),
                                prevChannel: client.getChannels()[0].id(),
                                timestamp: timestamp()
                            })

                            removeFromQueue = true
                        }
                    } else {
                        log.d(client.nick() + ' is not away anymore')
                        removeFromQueue = true
                    }
                } else if (queuedAFKclient.event == 'mute') {
                    if (client.isMuted()) {
                        var mutedFor = timestamp() - queuedAFKclient.timestamp

                        if (mutedFor >= config.muteDelay) {
                            log.d(client.nick() + ' reached delay (' + mutedFor + '/' + config.muteDelay + ')')
                            moveToAFKchannel(client, 'mute queue')

                            afk.push({
                                event: 'mute',
                                uid: client.uid(),
                                prevChannel: client.getChannels()[0].id(),
                                timestamp: timestamp()
                            })

                            removeFromQueue = true
                        }
                    } else {
                        log.d(client.nick() + ' is not muted anymore')
                        removeFromQueue = true
                    }
                } else if (queuedAFKclient.event == 'deaf') {
                    if (client.isDeaf()) {
                        var deafFor = timestamp() - queuedAFKclient.timestamp

                        if (deafFor >= config.deafDelay) {
                            log.d(client.nick() + ' reached delay (' + deafFor + '/' + config.deafDelay + ')')
                            moveToAFKchannel(client, 'deaf queue')

                            afk.push({
                                event: 'deaf',
                                uid: client.uid(),
                                prevChannel: client.getChannels()[0].id(),
                                timestamp: timestamp()
                            })

                            removeFromQueue = true
                        }
                    } else {
                        log.d(client.nick() + ' is not deaf anymore')
                        removeFromQueue = true
                    }
                } else {
                    log.e('Unknown event: ' + event)
                    removeFromQueue = true
                }
            } else {
                log.d('Error: client not found')
                removeFromQueue = true
            }

            if (removeFromQueue) {
                log.d('removing from queue')
                queue.splice(index, 1)
            }
        })
    }

    // check queue every 2s
    setInterval(checkQueue, 2 * 1000)

    if (config.idleEnabled) {
        log.d('idle move is enabled')

        // check for idle clients every minute
        setInterval(checkIdle, 1 * 60 * 1000)

        // workaround to improve idle time accuracy
        event.on('clientMove', function (ev) {
            lastMoveEvent[ev.client.uid()] = timestamp()
        })
    }

    function checkIdle() {
        backend.getClients().forEach(function (client) {
            if (afkChannel.equals(client.getChannels()[0])) {
                // client is already in afk channel
                return
            }

            if (client.getIdleTime() > idleThreshold && lastMoveEvent[client.uid()] < timestamp() - idleThreshold) {

                if (!(hasBlacklistedGroup(client, config.idleSgBlacklist) || inBlacklistedChannel(client, config.idleChBlacklist))) {
                    log.d('client idle: ' + client.nick())
                    log.d('not blacklisted')

                    var afkClient = getFromAFK(client)
                    if (afkClient) {
                        log.d('ignoring event since ' + client.nick() + ' is already afk (' +
                            (timestamp() - afkClient.timestamp) + 's, ' + afkClient.event + ')')
                        return
                    }

                    afk.push({
                        event: 'idle',
                        uid: client.uid(),
                        prevChannel: client.getChannels()[0].id(),
                        timestamp: timestamp()
                    })

                    moveToAFKchannel(client, 'idle')
                }
            }
        })
    }

    /**
     * Gets client from AFK array
     * 
     * @param {Client} client
     * @return {Object?} AFKclientEntry or null if not found
     */
    function getFromAFK(client) {
        var afkClient = null

        afk.some(function (afkClientElement) {
            if (afkClientElement.uid == client.uid()) {
                afkClient = afkClientElement
                return true
            }
            return false
        })

        if (!afkClient) {
            log.d('Error: client ' + client.nick() + ' not in array')
            return null
        }

        return afkClient
    }

    /**
     * Removes client from AFK array
     * 
     * @param {Client} client
     * @param {boolean} moveBack Whether the client should be moved back or not
     */
    function removeFromAFK(client, moveBack) {
        var afkClient = null

        afk.some(function (afkClientElement, index) {
            if (afkClientElement.uid == client.uid()) {
                afkClient = afkClientElement
                afk.splice(index, 1)
                return true
            }
            return false
        })

        if (afkClient) {
            log.d(client.nick() + 'was away for ' + (timestamp() - afkClient.timestamp) + 's')
            log.d('moveBack: ' + moveBack)

            if (moveBack) {
                var prevChannel = backend.getChannelByID(afkClient.prevChannel)
                log.d('moving client back to prev channel (' + prevChannel.id() + '/' + prevChannel.name() + ')')

                client.moveTo(prevChannel)
            }
        } else {
            log.d('Client ' + client.nick() + ' not in array')
        }
    }

    /**
     * Returns the current timestamp in ms
     * 
     * @return {number} timestamp
     */
    function timestamp() {
        return Date.now()
    }

    /**
     * Moves a client to the afk channel
     * 
     * @param {Client} client
     * @param {string} reason away/mute/deaf/idle [queue]
     */
    function moveToAFKchannel(client, reason) {
        client.moveTo(afkChannel)
        log.d('moved ' + client.nick() + ' to afk channel, reason: ' + reason)

        if (config.notifyEnabled) {
            var msg = 'You were moved to the afk channel, reason: ' + reason

            switch (config.notifyType) {
                case 0:
                    client.chat(msg)
                    break
                case 1:
                    client.poke(msg)
                    break
            }
        }
    }

    /**
     * Checks if a client has a servergroup that is blacklisted
     * 
     * @param {Client} client
     * @param {Array} blacklist blacklist config array
     * @return {boolean}
     */
    function hasBlacklistedGroup(client, blacklist) {
        if (!blacklist)
            return false
        
        return client.getServerGroups().some(function (servergroup) {
            return blacklist.some(function (blacklistItem) {
                return servergroup.id() == blacklistItem.servergroup
            })
        })
    }
 
    /**
     * Checks if a client is in a channel that is blacklisted
     *
     * @param {Client} client
     * @param {Array} blacklist blacklist config array
     * @return {boolean}
     */
    function inBlacklistedChannel(client, blacklist) {
        if (!blacklist)
            return false
        
        return client.getChannels().some(function (channel) {
            return blacklist.some(function (blacklistItem) {
                return channel.id() == blacklistItem.channel
            })
        })
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