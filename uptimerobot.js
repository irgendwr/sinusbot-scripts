/**
 * Forum:  https://forum.sinusbot.com/resources/uptimerobot.127/
 * GitHub: https://github.com/irgendwr/sinusbot-scripts
 */

registerPlugin({
    name: 'Uptimerobot - Server Status/Uptime Monitoring',
    version: '3.0.1',
    description: 'Informs you about the status of a server configured on uptimerobot.com',
    author: 'Jonas Bögle (irgendwr)',
    engine: '>= 1.0.0',
    backends: ['ts3'],
    requiredModules: ['http'],
    vars: [
        {
            name: 'info',
            title: 'Placeholders: \n%name%, %uptime%, %url%, %port%, %type%, %status%, %id%, %created%, %avg_response_time%, %last_response_time%, %ssl.brand%, %ssl.product%, %ssl.expires%'
        },
        {
            name: 'servers',
            title: 'Servers',
            type: 'array',
            vars: [
                {
                    name: 'channelEnabled',
                    title: 'Show status in channel',
                    type: 'checkbox'
                },
                {
                    name: 'channel',
                    title: 'Channel',
                    type: 'channel',
                    indent: 3,
                    conditions: [{ field: 'channelEnabled', value: true }]
                },
                {
                    name: 'channelName',
                    title: 'Channel Name',
                    type: 'string',
                    placeholder: '[cspacer]%name% is %status%',
                    default: '[cspacer]%name% is %status%',
                    indent: 3,
                    conditions: [{ field: 'channelEnabled', value: true }]
                },
                {
                    name: 'channelDescription',
                    title: 'Channel Description',
                    type: 'multiline',
                    placeholder: '[SIZE=12][B]%name%[/B][/SIZE]\n[B]Status[/B]: %status%\n[B]Uptime[/B]: %uptime%',
                    default: '[SIZE=12][B]%name%[/B][/SIZE]\n[B]Status[/B]: %status%\n[B]Uptime[/B]: %uptime%',
                    indent: 3,
                    conditions: [{ field: 'channelEnabled',  value: true }]
                },
                {
                    name: 'chatEnabled',
                    title: 'Send a server-message if a servers status changes',
                    type: 'checkbox'
                },
                {
                    name: 'chatMessage',
                    title: 'Message',
                    type: 'string',
                    placeholder: '[B]%name%[/B] is [B]%status%[/B]',
                    default: '[B]%name%[/B] is [B]%status%[/B]',
                    indent: 3,
                    conditions: [{ field: 'chatEnabled', value: true }]
                },
                {
                    name: 'apikey',
                    title: 'Monitor-specific API key',
                    type: 'string'
                }
            ]
        },
        {
            name: 'interval',
            title: 'Refresh interval (in seconds)',
            type: 'number',
            placeholder: '60',
            default: 60
        },
        {
            name: 'customText',
            title: 'Show/hide custom text options',
            type: 'checkbox'
        },
        {
            name: 'textUp',
            title: '"up"',
            type: 'string',
            placeholder: 'up',
            default: 'up',
            conditions: [{ field: 'customText', value: true }]
        },
        {
            name: 'textDown',
            title: '"down"',
            type: 'string',
            placeholder: 'down',
            default: 'down',
            conditions: [{ field: 'customText', value: true }]
        },
        {
            name: 'textPaused',
            title: '"paused"',
            type: 'string',
            placeholder: 'paused',
            default: 'paused',
            conditions: [{ field: 'customText', value: true }]
        },
        {
            name: 'textUnknown',
            title: '"unknown"',
            type: 'string',
            placeholder: 'unknown',
            default: 'unknown',
            conditions: [{ field: 'customText', value: true }]
        }
    ]
}, (_, config, meta) => {
    const engine = require('engine')
    const backend = require('backend')
    const http = require('http')

    let servers = config.servers
    if (!servers || servers.length == 0) {
        engine.log('No servers configured.')
        return
    }

    engine.log(`Loaded ${meta.name} v${meta.version} by ${meta.author}.`)

    // uncomment the following lines if you want to enable the status command:

    // const event = require('event')
    // event.on('load', () => {
    //     // @ts-ignore
    //     const command = require("command")
    //     if (!command) return engine.log("Command.js not found! Please be sure to install and enable Command.js")
    //     // @ts-ignore
    //     const {createCommand, createArgument} = command
        
    //     createCommand('status')
    //     .help('Shows uptimerobot status')
    //     .manual('Shows uptimerobot status')
    //     //.checkPermission((/** @type {Client} */client) => client.uid() === '')
    //     .exec((client, args, reply, /** @implements {Message} */ev) => {
    //         servers.forEach(function (server) {
    //             fetchData(server, function (data) {
    //                 reply(parse(server.chatMessage, data, true, 1024))
    //             })
    //         })
    //     })
    // })

    refresh()
    setInterval(refresh, (config.interval || 60) * 1000)

    function refresh() {
        for (let server of servers) {
            fetchData(server, data => {
                if (server.chatEnabled && server.lastStatus != data.status) {
                    backend.chat(parse(server.chatMessage, data, true, 1024))
                    server.lastStatus = data.status
                }

                if (server.channelEnabled) {
                    if (server.channel == null) {
                        engine.log('[Error] You enabled "Show status in channel" but didn\'t set a channel.')
                        server.channelEnabled = false
                        return
                    }

                    const channel = backend.getChannelByID(server.channel)
                    if (!channel) {
                        engine.log(`[Error] Unable to get channel with ID: ${server.channel}`)
                        return
                    }

                    channel.setName(parse(server.channelName, data, false, 40))
                    channel.setDescription(parse(server.channelDescription, data, true, 8192))
                }
            })
        }
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

        http.simpleRequest({
            method:  'POST',
            url:     'https://api.uptimerobot.com/v2/getMonitors',
            timeout: 6000,
            body:    params,
            headers: {
                'Content-Type': 'application/json'
            }
        }, (error, response) => {
            // check whether request was successfull
            if (error || response.statusCode != 200) {
                engine.log(`[Error] API request failed: ${(error || 'HTTP '+response.statusCode)}`)
                return
            }

            var data
            try {
                data = JSON.parse(response.data.toString())
            } catch (err) {
                engine.log(`[Error] Unable to parse data: ${err}`)
                engine.log(`Response: ${response.data}`)
            }

            // check whether response is valid
            if (!data) {
                return
            } else if (data.stat == 'fail') {
                engine.log(`[Error] API Request failed: ${JSON.stringify(data.error)}`)
                return
            }

            // engine.log(`Data: ${response.data}`)

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

    const types = [
        '',
        'HTTP(s)',
        'Keyword',
        'Ping',
        'Port'
    ]
    const UP = config.textUp || 'up';
    const DOWN = config.textDown || 'down';
    const PAUSED = config.textPaused || 'paused';
    const UNKNOWN = config.textUnknown || 'unknown';

    /**
     * Replaces placeholders
     * @param {string} str String
     * @param {Object} data Data
     * @param {boolean} fmt Set to true if string should be formatted
     * @returns {string}
     */
    function replacePlaceholders(str, data, fmt) {
        if (!str || !data) return '';

        let status = [
            fmt ? `[color=#000000]${PAUSED}[/color]` : PAUSED,
            fmt ? `[color=#464646]${UNKNOWN}[/color]` : UNKNOWN,
            fmt ? `[color=#4da74d]${UP}[/color]` : UP,
        ]
        status[9] = fmt ? `[color=#ff2121]${DOWN}[/color]` : DOWN
        status[8] = status[9] // "seems down"

        str = str.replace(/%name%/gi, data.friendly_name)
        .replace(/%uptime%/gi, data.all_time_uptime_ratio + '%')
        .replace(/%(url|ip)%/gi, data.url)
        .replace(/%port%/gi, data.port)
        .replace(/%type%/gi, types[data.type])
        .replace(/%status%/gi, status[data.status])
        .replace(/%id%/gi, data.id)
        .replace(/%ssl\.brand%/gi, data.ssl && data.ssl.brand ? data.ssl.brand : '')
        .replace(/%ssl\.product%/gi, data.ssl && data.ssl.product ? data.ssl.product : '' || '')
        .replace(/%last_response_time%/gi, data.response_times && data.response_times.length == 1 ? data.response_times[0].value + 'ms' : '')
        .replace(/%avg_response_time%/gi, data.average_response_time ? data.average_response_time + 'ms' : '')

        // don't use Date() with sinusbot alpha 6 or lower due to bug
        if (engine.version() >= '1.0.0-alpha.7') {
            str = str.replace(/%ssl\.expires%/gi, data.ssl && data.ssl.expires ? new Date(data.ssl.expires * 1000).toLocaleString() : '')
            .replace(/%created%/gi, new Date(data.create_datetime * 1000).toLocaleString())
        } else {
            str = str.replace(/%ssl\.expires%/gi, '').replace(/%created%/gi, '')
        }

        return str
    }

    /**
     * Truncates a string to a specified length
     * @param {string} str String
     * @param {number} len Max. length of the string
     * @returns {string}
     */
    function trunc(str, len) {
        return (str.length > len) ? str.substr(0, len - 1) + '…' : str
    }
})