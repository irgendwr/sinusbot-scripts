/**
 * Forum:  
 * GitHub: https://github.com/irgendwr/sinusbot-scripts
 */

registerPlugin({
    name: 'Join/Leave',
    version: '1.0.1',
    description: 'Let the bot join or leave your channel via commands.',
    author: 'Jonas Bögle (irgendwr)',
    engine: '>= 1.0.0',
    backends: ['discord'],
    //requiredModules: ['discord-dangerous'],
    vars: []
}, (_, config, meta) => {
    const event = require('event')
    const engine = require('engine')
    const backend = require('backend')

    engine.log(`Loaded ${meta.name} v${meta.version} by ${meta.author}.`)

    let bot = backend.getBotClient()

    event.on('load', () => {
        // @ts-ignore
        const command = require('command')
        if (!command)
            throw new Error('Command.js library not found! Please download Command.js and enable it to be able use this script!')

        command.createCommand('join')
        .help('Moves the SinusBot to your channel')
        .manual('This will move the SinusBot into your channel')
        .checkPermission(hasPermission)
        .exec((/** @type {Client} */client, /** @type {object} */args, /** @type {(msg:string)=>void} */reply) => {
            var channel = client.getChannels()[0]
            if (!channel) {
                return reply('Unable to join your channel')
            }

            bot = backend.getBotClient() || bot
            if (!bot) {
                return reply('The bot is not connected. Set a *Default Channel* in the webinterface and click save.')
            }
            bot.moveTo(channel)
        })

        command.createCommand('leave')
        .help('Disconnects the SinusBot')
        .manual('This will disconnect the SinusBot from the voice channel')
        .checkPermission(hasPermission)
        .exec((/** @type {Client} */client, /** @type {object} */args, /** @type {(msg:string)=>void} */reply) => {
            bot = backend.getBotClient() || bot
            if (!bot) {
                return reply('The bot is not connected. Set a *Default Channel* in the webinterface and click save.')
            }

            // @ts-ignore
            bot.moveTo('')
        })
    })

    /**
     * Checks if a client has the necessary permissons
     * @param {Client} client
     * @returns {Boolean} true if client has permission
     * @requires engine
     */
    function hasPermission(client) {
        // try to find a sinusbot user that matches
        let matches = engine.getUsers().filter(user =>
            // does the UID match?
            user.tsUid() == client.uid() ||
            // or does a group ID match?
            client.getServerGroups().map(group => group.id()).includes(user.tsGroupId())
        )

        return matches.some(user => {
            // either start/stop or edit bot settings permissions?
            return (user.privileges() & (1 << 8 | 1 << 16)) != 0
        })
    }
})