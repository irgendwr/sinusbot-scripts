/**
 * Forum:  https://forum.sinusbot.com/resources/uptimerobot.127/
 * GitHub: https://github.com/irgendwr/sinusbot-scripts
 */

registerPlugin({
    name: 'Uptimerobot - Server Status/Uptime Monitoring',
    version: '2.0',
    description: 'Informs you about the status of a server configured on uptimerobot.com',
    author: 'Jonas Bögle <dev@sandstorm-projects.de>',
    vars: [
        {
            name: 'info',
            title: 'Placeholders: \n%name%, %uptime%, %url%, %port%, %type%, %status%, %id%, %created%, %avg_response_time%, %last_response_time%, %ssl.brand%, %ssl.product%, %ssl.expires%',
            description: 'bar'
        }, {
            name: 'servers',
            title: 'Servers',
            type: 'array',
            vars: [
                {
                    name: 'channelEnabled',
                    title: 'Show status in channel',
                    type: 'checkbox'
                }, {
                    name: 'channel',
                    title: 'Channel',
                    type: 'channel',
                    indent: 3,
                    conditions: [{ field: 'channelEnabled', value: true }]
                }, {
                    name: 'channelName',
                    title: 'Channel Name',
                    type: 'string',
                    placeholder: '[cspacer]%name% is %status%',
                    indent: 3,
                    conditions: [{ field: 'channelEnabled', value: true }]
                }, {
                    name: 'channelDescription',
                    title: 'Channel Description',
                    type: 'multiline',
                    placeholder: '[SIZE=12][B]%name%[/B][/SIZE]\n[B]Status[/B]: %status%\n[B]Uptime[/B]: %uptime%',
                    indent: 3,
                    conditions: [{ field: 'channelEnabled',  value: true }]
                }, {
                    name: 'chatEnabled',
                    title: 'Send a server-message if a servers status changes',
                    type: 'checkbox'
                }, {
                    name: 'chatMessage',
                    title: 'Message',
                    type: 'string',
                    placeholder: '[B]%name%[/B] is [B]%status%[/B]',
                    indent: 3,
                    conditions: [{ field: 'chatEnabled', value: true }]
                }, {
                    name: 'apikey',
                    title: 'Monitor-specific API key',
                    type: 'string'
                }
            ]
        }, {
            name: 'interval',
            title: 'Refresh interval (in seconds)',
            type: 'number',
            placeholder: '60'
        }
    ]
}, function (sinusbot, config, info) {

    // include modules
    var event = require('event')
    var engine = require('engine')
    var backend = require('backend')
    var format = require('format')

    // set default config values
    config.interval = config.interval || 60
    engine.saveConfig(config)

    var servers = config.servers
    var log = new Logger()
    log.debug = false

    // check config
    if (!servers || servers.length == 0) {
        log.e('No servers configured.')
        return
    }

    // initialize
    servers.forEach(function (server, i) {
        if (server.channelEnabled) {
            servers[i].channel = backend.getChannelByID(server.channel)

            if (!servers[i].channel) {
                log.w('Invalid channel in ' + (i + 1) + '. server, ignoring...')
                servers[i].channelEnabled = false
            }
            servers[i].channelName = server.channelName || '[cspacer]%name% is %status%'
            servers[i].channelDescription = server.channelDescription || '[SIZE=12][B]%name%[/B][/SIZE]\n[B]Status[/B]: %status%\n[B]Uptime[/B]: %uptime%'
        }
        servers[i].chatMessage = server.chatMessage || '[B]%name%[/B] is [B]%status%[/B]'
    })

    // log info on startup
    log.d(servers.length + ' servers configured')
    log.i('debug messages are ' + (log.debug ? 'en' : 'dis') + 'abled')
    log.i(info.name + ' v' + info.version + ' by ' + info.author + ' loaded successfully.')

    event.on('chat', function (ev) {
        if (ev.text == '.uptimerobot') {
            servers.forEach(function (server) {
                fetchData(server, function (data) {
                    ev.client.chat(
                        parse(server.chatMessage, data, true, 1024)
                    )
                })
            })
        }
    })

    refresh()
    setInterval(refresh, config.interval * 1000)

    function refresh() {
        servers.forEach(function (server, i) {
            fetchData(server, function (data) {
                if (server.channelEnabled) {
                    server.channel.setName(
                        parse(server.channelName, data, false, 40)
                    )
                    server.channel.setDescription(
                        parse(server.channelDescription, data, true, 8192)
                    )
                }

                if (server.chatEnabled && server.lastStatus != data.status) {
                    backend.chat(
                        parse(server.chatMessage, data, true, 1024)
                    )
                }

                servers[i].lastStatus = data.status
            })
        })
    }

    /**
     * Fetches data from uptimerobot
     * @param {Object} server Server Config
     * @param {function} callback Callback
     */
    function fetchData(server, callback) {
        var params = JSON.stringify({
            format:  'json',
            api_key: server.apikey,
            all_time_uptime_ratio: 1,
            response_times: 1,
            response_times_limit: 1,
            response_times_average: 1
        })

        sinusbot.http({
            method:  'POST',
            url:     'https://api.uptimerobot.com/v2/getMonitors',
            timeout: 6000,
            body:    params,
            headers: {
                'Content-Type': 'application/json'
            }
        }, function (error, response) {
            // check whether request was successfull
            if (response.statusCode != 200) {
                log.e('API request failed: ' + (error || response.statusCode))
                return
            }

            var data
            try {
                data = JSON.parse(response.data)
            } catch (err) {
                log.e('Unable to parse data: ' + err.message)
                log.d('Response: ' + response.data)
            }

            // check whether response is valid
            if (data == undefined) {
                return
            } else if (data.stat == 'fail') {
                log.e('API Request failed: ' + JSON.stringify(data.error))
                return
            }

            // log.d('Data: ' + response.data)

            data = data.monitors[0]

            callback(data)
        })
    }

    /**
     * Replaces placeholders and limits string lenght
     * @param {string} str String
     * @param {Object} data Data
     * @param {boolean} fmt Set to true if string should be formatted
     * @param {number} len Max. length of the string
     * @returns {string}
     */
    function parse(str, data, fmt, len) {
        return trunc(replacePlaceholders(
            str, data, fmt
        ), len)
    }

    /**
     * Replaces placeholders
     * @param {string} str String
     * @param {Object} data Data
     * @param {boolean} fmt Set to true if string should be formatted
     * @returns {string}
     */
    function replacePlaceholders(str, data, fmt) {
        var types = [
            '',
            'HTTP(s)',
            'Keyword',
            'Ping',
            'Port'
        ]
        var status = [
            fmt ? format.color('paused',  '#000000') : 'paused',
            fmt ? format.color('unknown', '#464646') : 'unknown',
            fmt ? format.color('up',      '#4da74d') : 'up',
        ]
        status[8] = fmt ? format.color('down', '#ff5e21') : 'down' // seems down
        status[9] = fmt ? format.color('down', '#ff2121') : 'down'

        str = str.replace(/%name%/gi, data.friendly_name)
        .replace(/%uptime%/gi, data.all_time_uptime_ratio + '%')
        .replace(/%(url|ip)%/gi, data.url)
        .replace(/%port%/gi, data.port)
        .replace(/%type%/gi, types[data.type])
        .replace(/%status%/gi, status[data.status])
        .replace(/%id%/gi, data.id)
        .replace(/%ssl\.brand%/gi, data.ssl.brand)
        .replace(/%ssl\.product%/gi, data.ssl.product || '')
        .replace(/%ssl\.expires%/gi, data.ssl.expires ? new Date(data.ssl.expires * 1000).toLocaleString() : '')
        .replace(/%created%/gi, new Date(data.create_datetime * 1000).toLocaleString())
        .replace(/%last_response_time%/gi, data.response_times && data.response_times.length == 1 ? data.response_times[0].value + 'ms' : '')
        .replace(/%avg_response_time%/gi, data.average_response_time ? data.average_response_time + 'ms' : '')

        return str
    }

    /**
     * Shortens a string to a specified length
     * @param {string} str String
     * @param {number} len Max. length of the string
     * @returns {string}
     */
    function trunc(str, len) {
        return (str.length > len) ? str.substr(0, len - 1) + '…' : str
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