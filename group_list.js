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
    vars: []
}, (_, config, meta) => {
    const event = require('event')
    const engine = require('engine')
    const backend = require('backend')
    const format = require('format')

    engine.log(`Loaded ${meta.name} v${meta.version} by ${meta.author}.`)

    event.on('load', () => {
        const command = require('command')
        if (!command)
            throw new Error('Command.js library not found! Please download Command.js and enable it to be able use this script!')

        command.createCommand('groups')
        .help('Lists the servers groups and their IDs')
        .manual('Lists the servers groups and their IDs')
        .exec((/** @type {Client} */client, /** @type {object} */args, /** @type {(msg:string)=>void} */reply) => {
            var resp = format.bold('Groups:')
            // TODO: split into multiple messages if too long
            backend.getServerGroups().forEach(function (group) {
                resp += '\n * `' + group.name() + '`, ID: `' + group.id() + '`'
            })

            reply(resp)
        })

        //TODO: maybe add a command to search for groups?
        //TODO: add permissions to commands? via settings or sinusbot permissions?
    })
})