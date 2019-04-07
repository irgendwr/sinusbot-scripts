/**
 * Forum:  https://forum.sinusbot.com/resources/join-leave-commands.423/
 * GitHub: https://github.com/irgendwr/sinusbot-scripts
 */

registerPlugin({
    name: 'Join/Leave',
    version: '1.0.1',
    description: 'Let the bot join or leave your channel via commands.',
    author: 'Jonas Bögle (irgendwr)',
    engine: '>= 1.0.0',
    backends: ['discord'],
    vars: [{
        title: `The commands !join and !leave can be used by any user that has start/stop or edit bot settings permission.
To add the start/stop permission you need to enable it for a user account that is bound to the discord identity of your user.
This can be done under Settings -> User Accounts.`
    }]
}, (_, config, meta) => {
    const event = require('event')
    const engine = require('engine')
    const backend = require('backend')

    engine.log(`Loaded ${meta.name} v${meta.version} by ${meta.author}.`)

    const ERROR_BOT_NULL = 'Unable to change channel :frowning:\nTry to set a *Default Channel* in the webinterface and click save.'

    let bot = backend.getBotClient()

    event.on('load', () => {
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
                return reply('I\'m unable to join your channel :frowning:')
            }

            bot = backend.getBotClient() || bot
            if (!bot) {
                return reply(ERROR_BOT_NULL)
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
                return reply(ERROR_BOT_NULL)
            }

            // @ts-ignore
            bot.moveTo('')
        })
    })

    /**
     * Checks if a client has the necessary permissons
     * @param {Client} client
     * @returns {boolean} true if client has permission
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