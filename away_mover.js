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
        /*{
            name: 'idleMoveBack',
            title: 'Move users back',
            type: 'checkbox',
            indent: 3,
            conditions: [{ field: 'idleEnabled', value: true }]
        },*/
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
            options: [
                'chat',
                'poke'
            ],
            indent: 3,
            conditions: [{ field: 'notifyEnabled', value: true }]
        },
    ]
}, function (sinusbot, config, info) {

    // include modules
    var event = require('event');
    var engine = require('engine');
    var backend = require('backend');

    // set to true for more output
    var DEBUG = false;

    // check if afk channel is not set
    if (config.afkChannel == null) {
        logmsg('E', 'You need to specify an afk channel in the config.');
        return;
    }

    // get afk channel obj.
    var AKFchannel = backend.getChannelByID(config.afkChannel);

    var AFKclients = [];
    var AFKclients_queue = [];
    var lastMoveEvent = {};

    // set default config values
    config.awayMoveBack = config.awayMoveBack || false;
    config.awayDelay = config.awayDelay || 0;

    config.muteMoveBack = config.muteMoveBack || false;
    config.muteDelay = config.muteDelay || 0;

    config.deafMoveBack = config.deafMoveBack || false;
    config.deafDelay = config.deafDelay || 0;

    config.notifyEnabled = config.notifyEnabled || false;
    config.notifyType = config.notifyType || 0;

    engine.saveConfig(config);

    /*** away ***/

    if (config.awayEnabled) {
        logmsg('D', 'away move is enabled');

        event.on('clientAway', function (client) {
            logmsg('D', 'clientAway: ' + client.nick());

            if (!(hasBlacklistedGroup(client, config.awaySgBlacklist) || inBlacklistedChannel(client, config.awayChBlacklist))) {
                logmsg('D', 'not blacklisted');

                var AFKclientEntry = getFromAFK(client);
                if (AFKclientEntry != null) {
                    logmsg('D', 'ignoring event since ' + client.nick() + ' is already afk (' +
                        (currTimestamp() - AFKclientEntry.timestamp) + 's, ' + AFKclientEntry.event + ')');
                    return;
                }

                if (config.awayDelay) {
                    logmsg('D', 'delay enabled (' + config.awayDelay + '), pushing client to queue...');

                    AFKclients_queue.push({
                        event: 'away',
                        uid: client.uid(),
                        timestamp: currTimestamp()
                    });
                } else {
                    AFKclients.push({
                        event: 'away',
                        uid: client.uid(),
                        prevChannel: client.getChannels()[0].id(),
                        timestamp: currTimestamp()
                    });

                    moveToAFKchannel(client, 'away');
                }
            } else {
                logmsg('D', 'blacklisted, ignoring');
            }

        });

        event.on('clientBack', function (client) {
            logmsg('D', 'clientBack: ' + client.nick());

            var AFKclientEntry = getFromAFK(client);

            if (AFKclientEntry != null && AFKclientEntry.event == 'away') {
                removeFromAFK(client, config.awayMoveBack);
            }
        });
    }

    /*** mute ***/

    if (config.muteEnabled) {
        logmsg('D', 'mute move is enabled');

        event.on('clientMute', function (client) {
            logmsg('D', 'clientMute: ' + client.nick());

            if (!(hasBlacklistedGroup(client, config.muteSgBlacklist) || inBlacklistedChannel(client, config.muteChBlacklist))) {
                logmsg('D', 'not blacklisted');

                var AFKclientEntry = getFromAFK(client);
                if (AFKclientEntry != null) {
                    logmsg('D', 'ignoring event since ' + client.nick() + ' is already afk (' +
                        (currTimestamp() - AFKclientEntry.timestamp) + 's, ' + AFKclientEntry.event + ')');
                    return;
                }

                if (config.muteDelay) {
                    logmsg('D', 'delay enabled (' + config.muteDelay + '), pushing client to queue...');

                    AFKclients_queue.push({
                        event: 'mute',
                        uid: client.uid(),
                        timestamp: currTimestamp()
                    });
                } else {
                    AFKclients.push({
                        event: 'mute',
                        uid: client.uid(),
                        prevChannel: client.getChannels()[0].id(),
                        timestamp: currTimestamp()
                    });

                    moveToAFKchannel(client, 'mute');
                }
            } else {
                logmsg('D', 'blacklisted, ignoring');
            }
        });

        event.on('clientUnmute', function (client) {
            logmsg('D', 'clientUnmute: ' + client.nick());

            var AFKclientEntry = getFromAFK(client);

            if (AFKclientEntry != null && AFKclientEntry.event == 'mute') {
                removeFromAFK(client, config.muteMoveBack);
            }
        });
    }

    /*** deaf ***/

    if (config.deafEnabled) {
        logmsg('D', 'deaf move is enabled');

        event.on('clientDeaf', function (client) {
            logmsg('D', 'clientDeaf: ' + client.nick());

            if (!(hasBlacklistedGroup(client, config.deafSgBlacklist) || inBlacklistedChannel(client, config.deafChBlacklist))) {
                logmsg('D', 'not blacklisted');

                var AFKclientEntry = getFromAFK(client);
                if (AFKclientEntry != null) {
                    logmsg('D', 'ignoring event since ' + client.nick() + ' is already afk (' +
                        (currTimestamp() - AFKclientEntry.timestamp) + 's, ' + AFKclientEntry.event + ')');
                    return;
                }

                if (config.deafDelay) {
                    logmsg('D', 'delay enabled (' + config.deafDelay + '), pushing client to queue...');

                    AFKclients_queue.push({
                        event: 'deaf',
                        uid: client.uid(),
                        timestamp: currTimestamp()
                    });
                } else {
                    AFKclients.push({
                        event: 'deaf',
                        uid: client.uid(),
                        prevChannel: client.getChannels()[0].id(),
                        timestamp: currTimestamp()
                    });

                    moveToAFKchannel(client, 'deaf');
                }
            } else {
                logmsg('D', 'blacklisted, ignoring');
            }
        });

        event.on('clientUndeaf', function (client) {
            logmsg('D', 'clientUndeaf: ' + client.nick());

            var AFKclientEntry = getFromAFK(client);

            if (AFKclientEntry != null && AFKclientEntry.event == 'deaf') {
                removeFromAFK(client, config.deafMoveBack);
            }
        });
    }

    function checkQueue() {
        AFKclients_queue.forEach(function (queuedAFKclient, index) {
            var removeFromQueue = false;
            var client = backend.getClientByUID(queuedAFKclient.uid);

            if (client) {
                if (queuedAFKclient.event == 'away') {
                    if (client.isAway()) {
                        var awayFor = currTimestamp() - queuedAFKclient.timestamp;

                        if (awayFor >= config.awayDelay) {
                            logmsg('D', client.nick() + ' reached delay (' + awayFor + '/' + config.awayDelay + ')');
                            moveToAFKchannel(client, 'away queue');

                            AFKclients.push({
                                event: 'away',
                                uid: client.uid(),
                                prevChannel: client.getChannels()[0].id(),
                                timestamp: currTimestamp()
                            });

                            removeFromQueue = true;
                        }
                    } else {
                        logmsg('D', client.nick() + ' is not away anymore');
                        removeFromQueue = true;
                    }
                } else if (queuedAFKclient.event == 'mute') {
                    if (client.isMuted()) {
                        var mutedFor = currTimestamp() - queuedAFKclient.timestamp;

                        if (mutedFor >= config.muteDelay) {
                            logmsg('D', client.nick() + ' reached delay (' + mutedFor + '/' + config.muteDelay + ')');
                            moveToAFKchannel(client, 'mute queue');

                            AFKclients.push({
                                event: 'mute',
                                uid: client.uid(),
                                prevChannel: client.getChannels()[0].id(),
                                timestamp: currTimestamp()
                            });

                            removeFromQueue = true;
                        }
                    } else {
                        logmsg('D', client.nick() + ' is not muted anymore');
                        removeFromQueue = true;
                    }
                } else if (queuedAFKclient.event == 'deaf') {
                    if (client.isDeaf()) {
                        var deafFor = currTimestamp() - queuedAFKclient.timestamp;

                        if (deafFor >= config.deafDelay) {
                            logmsg('D', client.nick() + ' reached delay (' + deafFor + '/' + config.deafDelay + ')');
                            moveToAFKchannel(client, 'deaf queue');

                            AFKclients.push({
                                event: 'deaf',
                                uid: client.uid(),
                                prevChannel: client.getChannels()[0].id(),
                                timestamp: currTimestamp()
                            });

                            removeFromQueue = true;
                        }
                    } else {
                        logmsg('D', client.nick() + ' is not deaf anymore');
                        removeFromQueue = true;
                    }
                } else {
                    logmsg('E', 'unknown event \'' + event + '\'');
                    removeFromQueue = true;
                }
            } else {
                logmsg('D', 'Error: client not found');
                removeFromQueue = true;
            }

            if (removeFromQueue) {
                logmsg('D', 'removing from queue');
                AFKclients_queue.splice(index, 1);
            }
        });
    }

    // check queue every 2s
    setInterval(checkQueue, 2 * 1000);

    function checkIdle() {
        backend.getClients().forEach(function (client) {
            if (client.getChannels()[0].id() == config.afkChannel) {
                //logmsg('D', 'client idle but already in afk channel: ' + client.nick());
                return;
            }

            if (client.getIdleTime() > config.idleThreshold * 60 * 1000 && lastMoveEvent[client.uid()] < currTimestamp() - (config.idleThreshold * 60)) {
                //logmsg('D', 'client idle: ' + client.nick());

                if (!(hasBlacklistedGroup(client, config.idleSgBlacklist) || inBlacklistedChannel(client, config.idleChBlacklist))) {
                    logmsg('D', 'client idle: ' + client.nick());
                    logmsg('D', 'not blacklisted');

                    var AFKclientEntry = getFromAFK(client);
                    if (AFKclientEntry != null) {
                        logmsg('D', 'ignoring event since ' + client.nick() + ' is already afk (' +
                            (currTimestamp() - AFKclientEntry.timestamp) + 's, ' + AFKclientEntry.event + ')');
                        return;
                    }

                    /* AFKclients.push({
                         event: 'idle',
                         uid: client.uid(),
                         prevChannel: client.getChannels()[0].id(),
                         timestamp: currTimestamp()
                     });*/

                    moveToAFKchannel(client, 'idle');
                } else {
                    //logmsg('D', 'blacklisted, ignoring');
                }
            }
        });
    }

    if (config.idleEnabled) {
        logmsg('D', 'idle move is enabled');

        // check for idle clients every minute
        setInterval(checkIdle, 1 * 60 * 1000);

        event.on('clientMove', function (moveInfo) {
            lastMoveEvent[moveInfo.client.uid()] = currTimestamp();
        });
    }

    /**
     * Gets client from AFK array
     * 
     * @param {Client} client
     * @return {Object} AFKclientEntry or null on error
     */
    function getFromAFK(client) {
        var AFKclientEntry = null;

        AFKclients.forEach(function (AFKclient) {
            if (AFKclient.uid == client.uid()) {
                AFKclientEntry = AFKclient;
            }
        });

        if (AFKclientEntry != null) {
            return AFKclientEntry;
        }

        logmsg('D', 'Error: client ' + client.nick() + ' not in array');
        return null;
    }

    /**
     * Removes client from AFK array
     * 
     * @param {Client} client
     * @param {Boolean} moveBack whether the client should be moved back or not
     * @return {Object} AFKclientEntry or null on error
     */
    function removeFromAFK(client, moveBack) {
        var AFKclientEntry = null;

        AFKclients.forEach(function (AFKclient, index) {
            if (AFKclient.uid == client.uid()) {
                AFKclientEntry = AFKclient;
                AFKclients.splice(index, 1);
            }
        });

        if (AFKclientEntry != null) {
            logmsg('D', client.nick() + 'was away for ' + (currTimestamp() - AFKclientEntry.timestamp) + 's');
            logmsg('D', 'moveBack: ' + moveBack);

            if (moveBack) {
                var prevChannel = backend.getChannelByID(AFKclientEntry.prevChannel);
                logmsg('D', 'moving client back to prev channel (' + prevChannel.id() + '/' + prevChannel.name() + ')');

                client.moveTo(prevChannel);
            }
        } else {
            logmsg('D', 'Error: client ' + client.nick() + ' not in array');
        }
    }

    /**
     * Returns the current timestamp
     * 
     * @return {int} timestamp
     */
    function currTimestamp() {
        return Math.floor(Date.now() / 1000);
    }

    /**
     * Moves a client to the afk channel
     * 
     * @param {Client} client
     * @param {String} cause away/mute/deaf/idle [queue]
     */
    function moveToAFKchannel(client, cause) {
        client.moveTo(AKFchannel);
        logmsg('D', 'moved ' + client.nick() + ' to afk channel, cause: ' + cause);

        var msg = 'You were moved to the afk channel, reason: ' + cause;

        if (config.notifyEnabled) {
            if (config.notifyType == 0) {
                client.chat(msg);
            } else if (config.notifyType == 1) {
                client.poke(msg);
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
        var blacklisted = false;

        if (typeof blacklist != 'undefined') {
            client.getServerGroups().forEach(function (servergroup) {
                blacklist.forEach(function (blacklistItem) {
                    if (servergroup.id() == blacklistItem.servergroup) {
                        logmsg('D', 'client ' + client.nick() + ' has blacklisted servergroup ' + servergroup.id());
                        blacklisted = true;
                    }
                });
            });
        }

        return blacklisted;
    }
 
    /**
     * Checks if a client is in a channel that is blacklisted
     *
     * @param {Client} client
     * @param {Array} blacklist blacklist config array
     * @return {boolean}
     */
    function inBlacklistedChannel(client, blacklist) {
        var isInBlacklistedChannel = false;
 
        if (typeof blacklist != 'undefined') {
            client.getChannels().forEach(function(inChannel) {
                blacklist.forEach(function (blacklistItem) {
                    if(inChannel.id() === blacklistItem.channel) {
                        isInBlacklistedChannel = true;
                    }
                });
            });
        }
 
        return isInBlacklistedChannel;
    }

    /**
     * Loggs a message, requires engine
     * 
     * @param {String} level DEBUG, INFO or ERROR
     * @param {String} msg Message
     */
    function logmsg(level, msg) {
        switch (level) {
            case 'D':
            case 'DBG':
                level = 'DEBUG';
                break;
            case 'I':
            case 'INF':
                level = 'INFO';
                break;
            case 'E':
            case 'ERR':
                level = 'ERROR';
                break;
            case 'W':
            case 'WARN':
                level = 'WARN';
                break;
        }

        if (level == 'DEBUG' || level == 'INFO' || level == 'ERROR' || level == 'WARN') {
            if (DEBUG || level != 'DEBUG') {
                engine.log('[' + level + '] ' + msg);
            }
        } else {
            engine.log('[ERROR] unknown loglevel "' + level + '"; msg: ' + msg);
        }
    }

    // log info on startup
    logmsg('I', 'debug messages are ' + (DEBUG ? 'en' : 'dis') + 'abled');
    logmsg('I', info.name + ' v' + info.version + ' by ' + info.author + ' loaded successfully!');
});