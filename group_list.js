/**
 * Forum:  https://forum.sinusbot.com/resources/group-list.388/
 * GitHub: https://github.com/irgendwr/sinusbot-scripts
 */

registerPlugin({
    name: 'Group List',
    version: '1.0.0',
    description: 'List the servers groups and their IDs with the `!groups` command.',
    author: 'Jonas Bögle (irgendwr)',
    backends: ['ts3', 'discord'],
    vars: []
}, function (sinusbot, config, info) {

    // include modules
    var event = require('event')
    var engine = require('engine')
    var backend = require('backend')
    var format = require('format')

    var log = new Logger()
    log.debug = false

    // log info on startup
    log.i('debug messages are ' + (log.debug ? 'en' : 'dis') + 'abled')
    log.i(info.name + ' v' + info.version + ' by ' + info.author + ' loaded successfully.')
    log.d('backend: ' + engine.getBackend())

    event.on('chat', function (ev) {
        if (ev.text === '!groups') {
            // FIXME: workaround for discord
            if (ev.mode == 2 && ev.channel == undefined) {
                ev.mode = 1
                log.d('[workaround] detected message type: ' + ev.mode)
            }

            var resp = format.bold('Groups:')
            backend.getServerGroups().forEach(function (group) {
                resp += '\n * `' + group.name() + '`, ID: `' + group.id() + '`'
            })

            switch (ev.mode) {
                case 1: ev.client.chat(resp); break
                case 2: ev.channel.chat(resp); break
                case 3: backend.chat(resp); break
            }
        }
    })

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