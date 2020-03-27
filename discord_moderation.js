/**
 * Forum:  
 * GitHub: https://github.com/irgendwr/sinusbot-scripts
 */

registerPlugin({
    name: 'Discord Moderation',
    version: '1.0.0',
    description: 'Adds commands for moderators on discord.',
    author: 'Jonas Bögle (irgendwr)',
    engine: '>= 1.0.0',
    backends: ['discord'],
    requiredModules: ['discord-dangerous'],
    vars: [{
        name: "admins",
        title: "UIDs of users which have access to admin commands",
        type: "strings",
        default: []
    }]
}, (_, config, meta) => {
    const event = require('event')
    const engine = require('engine')
    const backend = require('backend')

    engine.log(`Loaded ${meta.name} v${meta.version} by ${meta.author}.`)

    event.on('load', () => {
        const command = require("command")
        if (!command) {
            engine.log('command.js library not found! Please download command.js to your scripts folder and restart the SinusBot, otherwise this script will not work.');
            engine.log('command.js can be found here: https://github.com/Multivit4min/Sinusbot-Command/blob/master/command.js');
            return;
        }
        const {createCommand, createArgument} = command
        
        createCommand('clear')
        .help('Clears messages')
        .manual('Clears messages')
        .checkPermission(allowAdminCommands)
        // @ts-ignore
        .addArgument(createArgument("number").setName("amount").min(1).max(100).optional(10))
        .exec((client, { amount }, reply, /** @implements {Message} */ev) => {
            let msg = ev.message
            if (!msg) return engine.log('no message object found, update command.js or something')
            
            backend.extended().rawCommand('GET', `/channels/${msg.channelID()}/messages?before=${msg.ID()}&limit=${amount}`, null, (err, data) => {
                if (err) {
                    reply('Error: ' + err)
                    engine.log(err)
                    return;
                }

                let res = JSON.parse(data);
                if (!res || !res.length) {
                    reply('Error: Invalid API repsonse')
                    engine.log('Invalid response: '+data)
                }


                let old = [];
                const twoWeeks = 2 * 7 * 24 * 60 * 60 * 1000//ms
                res = res.filter(msg => {
                    if (Date.now()-Date.parse(msg.timestamp) >= twoWeeks) {
                        old.push(msg)
                        return false
                    }
                    return true
                })
                
                let ids = res.map(msg => msg.id)
                if (ids.length < 100 && ids.length !== 0) {
                    ids.push(msg.ID())
                } else {
                    msg.delete()
                }

                backend.extended().rawCommand('POST', `/channels/${msg.channelID()}/messages/bulk-delete`, {messages: ids}, err => {
                    if (err) {
                        reply('Error: ' + err)
                        engine.log(err)
                    }
                })

                if (old.length !== 0) {
                    msg.reply('Messages older than two weeks cannot be deleted in bulk.')
                }
            })
        })
    })

    /**
     * Checks if a client is allowed to use admin commands.
     * @param {Client} client
     * @returns {boolean}
     */
    function allowAdminCommands(client) {
        return config.admins.includes(client.uid().split("/")[1])
    }

    /**
     * Get a guild Member
     * @param {Client} client
     * @returns {Promise<object>}
     */
    function getGuildMember(client) {
        let [guildId, userId] = client.id().split('/');

        return discord('POST', `/guilds/${guildId}/members/${userId}`)
    }

    /**
     * Executes a discord API call
     * @param {string} method http method
     * @param {string} path path
     * @param {object} [data] json data
     * @param {boolean} [repsonse] `true` if you're expecting a json response, `false` otherwise
     * @return {Promise<object>}
     */
    function discord(method, path, data, repsonse=true) {
        return new Promise((resolve, reject) => {
            backend.extended().rawCommand(method, path, data, (err, data) => {
                if (err) return reject(err)
                if (repsonse) {
                    let res
                    try {
                        res = JSON.parse(data)
                    } catch (err) {
                        return reject(err)
                    }
                    
                    if (res === undefined) {
                        return reject('Invalid Response')
                    }

                    return resolve(res)
                }
                resolve()
            })
        })
    }
})