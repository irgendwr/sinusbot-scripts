/**
 * Forum:  https://forum.sinusbot.com/resources/group-list.388/
 * GitHub: https://github.com/irgendwr/sinusbot-scripts
 */

registerPlugin({
    name: 'Group List',
    version: '1.1.0',
    description: 'List the servers groups and their IDs with the `!groups` command.',
    author: 'Jonas Bögle (irgendwr)',
    backends: ['ts3', 'discord'],
    vars: [{
        name: 'admins',
        title: 'UIDs of users which have access to the command',
        type: 'strings',
        default: []
    }]
}, (_, config, meta) => {
    const event = require('event')
    const engine = require('engine')
    const backend = require('backend')
    const format = require('format')

    engine.log(`Loaded ${meta.name} v${meta.version} by ${meta.author}.`)

    event.on('load', () => {
        const command = require('command')
        if (!command) {
            engine.log('command.js library not found! Please download command.js to your scripts folder and restart the SinusBot, otherwise this script will not work.');
            engine.log('command.js can be found here: https://github.com/Multivit4min/Sinusbot-Command/blob/master/command.js');
            return;
        }

        command.createCommand('groups')
        .alias('grouplist')
        .help('Lists the servers groups and their IDs')
        .manual('Lists the servers groups and their IDs')
        .checkPermission(allowAdminCommands)
        .addArgument(command.createArgument('string').setName('name').optional())
        .exec((/** @type {Client} */client, /** @type {object} */args, /** @type {(msg:string)=>void} */reply) => {
            let resp = format.bold('Groups:')
            if (args.name && args.name  !== '') {
                // TODO: split into multiple messages if too long
                backend.getServerGroups().forEach(group => {
                    if (group.name().includes(args.name)) {
                        resp += '\n * `' + group.name() + '`, ID: `' + group.id() + '`'
                    }
                })
            } else {
                // TODO: split into multiple messages if too long
                backend.getServerGroups().forEach(group => {
                    resp += '\n * `' + group.name() + '`, ID: `' + group.id() + '`'
                })
            }

            reply(resp)
        })
    })

    /**
     * Checks if a client is allowed to use admin commands.
     * @param {Client} client
     * @returns {boolean}
     */
    function allowAdminCommands(client) {
        switch (engine.getBackend()) {
            case "discord":
                return config.admins.includes(client.uid().split("/")[1])
            case "ts3":
                return config.admins.includes(client.uid())
            default:
                throw new Error(`Unknown backend ${engine.getBackend()}`)
        }
    }
})