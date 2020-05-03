registerPlugin({
    name: "Exec",
    version: "0.1.0",
    description: "Evaluates chat commands",
    author: "Multivitamin <david.kartnaller@gmail.com",
    backends: ["ts3", "discord"],
    requiredModules: ["http"],
    vars: [{
        name: "admins",
        title: "UIDs of users which have access to admin commands",
        type: "strings",
        default: []
    }]
}, (_, config) => {
    const engine = require("engine")
    const event = require("event")
    const format = require("format")
    // import modules for quick use in exec:
    /* eslint-disable */
    const backend = require("backend")
    const helpers = require("helpers")
    const media = require("media")
    const audio = require("audio")
    const store = require("store")
    const http = require("http")
    /* eslint-enable */

    const codeBlockPattern = /^ *```(javascript *\r?\n?)?(?<code>.*)``` *$/si

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

    // eslint-disable-next-line no-unused-vars
    function evaluate(code, ev, reply) {
        const start = Date.now()
        let data = null
        let error = null
        try {
            const client = ev.client
            // eslint-disable-next-line no-eval
            data = eval(code)
        } catch (e) {
            error = e
        }
        return {
            error,
            data,
            duration: Date.now() - start
        }
    }

    event.on("load", () => {
        const command = require("command")
        if (!command) {
            engine.log('command.js library not found! Please download command.js to your scripts folder and restart the SinusBot, otherwise this script will not work.');
            engine.log('command.js can be found here: https://github.com/Multivit4min/Sinusbot-Command/blob/master/command.js');
            return;
        }
        const {createCommand} = command

        createCommand("exec")
            .alias('eval', 'run')
            .help("Executes a raw command within Sinusbot")
            .addArgument(arg => arg.rest.setName("code"))
            .checkPermission(allowAdminCommands)
            .exec((client, {code}, reply, ev) => {
                if (engine.getBackend() === "discord") {
                    const match = code.match(codeBlockPattern)
                    if (match) code = match.groups.code
                    const res = evaluate(code, ev, reply)
                    const duration = `Duration: ${res.duration}ms`
                    if (res.error) return reply(`Error:\n${format.code(res.error.stack)}\n${duration}`)
                    if (res.data !== null) {
                        if (res.data === '') return reply(`Empty string returned.\n${duration}`)
                        let msg = `${format.code(res.data)}\nType: ${typeof res.data}, ${duration}`
                        if (msg.length >= 2000) {
                            reply(`Data is too long to post, see log.\n${duration}`)
                            engine.log(res.data)
                            return;
                        }
                        return reply(msg)
                    }
                    reply(`No data returned.\n${duration}`)
                } else {
                    const res = evaluate(code, ev, reply)
                    const duration = `Duration: ${res.duration}ms`
                    if (res.error) return reply(`Error:\n${res.error.stack}\n${duration}`)
                    if (res.data) reply(`${res.data}\n${duration}`)
                }
            })
    })
})